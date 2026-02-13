import { createContext, useContext, useEffect, useState, useRef } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { resilientStorage } from "@/lib/resilientStorage"


// --- Timeout Helper (Duplicated for Context Safety) ---
// FIX: Use <T,> to prevent TSX generic from being parsed as JSX tag
const timeoutPromise = <T,>(promise: Promise<T> | PromiseLike<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
};

type AuthStatus = 'LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'LIMITED'
type AdminStatus = 'UNKNOWN' | 'ADMIN' | 'NOT_ADMIN'

type AuthContextType = {
    session: Session | null
    user: User | null
    status: AuthStatus
    isAdmin: boolean // Computed for backward compat: adminStatus === 'ADMIN'
    adminStatus: AdminStatus
    tier: "Free" | "Standard" | "Pro"
    companyName: string | null
    fullName: string | null
    isVerified: boolean
    loading: boolean // <--- Added for compatibility
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
    retryVerification: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    status: 'LOADING',
    isAdmin: false,
    adminStatus: 'UNKNOWN',
    tier: "Free",
    companyName: null,
    fullName: null,
    isVerified: false,
    loading: true, // <--- Added default
    signOut: async () => { },
    refreshProfile: async () => { },
    retryVerification: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [status, setStatus] = useState<AuthStatus>('LOADING')

    // Profile Data
    const [adminStatus, setAdminStatus] = useState<AdminStatus>('UNKNOWN')
    const [tier, setTier] = useState<"Free" | "Standard" | "Pro">("Free")
    const [companyName, setCompanyName] = useState<string | null>(null)
    const [fullName, setFullName] = useState<string | null>(null)

    // Legacy flag for compatibility, equivalent to (status === 'AUTHENTICATED' || status === 'LIMITED')
    const isVerified = status === 'AUTHENTICATED' || status === 'LIMITED'

    // Computed isAdmin for backward compat
    const isAdmin = adminStatus === 'ADMIN'

    // Concurrency & Loop Guard
    const verificationInProgress = useRef(false)
    const inFlightPromiseRef = useRef<Promise<boolean> | null>(null)
    const lastCheckedUserIdRef = useRef<string | null>(null)
    const initTimeoutRef = useRef<any>(null) // FIX #1: Store timeout for cleanup

    const signOut = async () => {
        // Optimistic Logout
        setSession(null)
        setUser(null)
        setStatus('UNAUTHENTICATED')

        // Reset Admin State
        setAdminStatus('UNKNOWN')
        lastCheckedUserIdRef.current = null
        setTier("Free")
        setCompanyName(null)
        setFullName(null)

        await supabase.auth.signOut()
    }

    /**
     * SENIOR PRINCIPLE 2: "Reconcile server + client state"
     * We don't just trust the token. We ask the server.
     * BUT: We don't punish network/extension failures with logout.
     */
    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        if (!userId) {
            setStatus('UNAUTHENTICATED')
            lastCheckedUserIdRef.current = null
            setAdminStatus('UNKNOWN')
            return false
        }

        // GRIDLOCK GUARD: Never re-check the same user ID in the same session lifecycle
        // unless explicitly forced (which we aren't doing here).
        // This prevents the "Infinite Profile Loop" if the DB is throwing 42703.
        if (lastCheckedUserIdRef.current === userId) {
            console.log("🛡️ Skipping redundant check (already verified for this user).")
            return true
        }

        // RE-ENTRANCY GUARD: If a check is already in flight, wait for it.
        if (inFlightPromiseRef.current) {
            console.log("✈️ Auth verification already in flight. Waiting for result...")
            return inFlightPromiseRef.current
        }

        // Start Verification
        const verificationPromise = (async () => {
            verificationInProgress.current = true
            let serverVerified = false
            const startTime = Date.now()

            try {
                // 0. GOLD STANDARD VERIFICATION with EXTENDED TIMEOUT (10s)
                // FIX: SES/Metamask can freeze getUser() indefinitely. 
                const verifiedUserPromise = supabase.auth.getUser()

                const { data: { user: verifiedUser }, error: authError } = await timeoutPromise(
                    verifiedUserPromise.then(res => ({ data: { user: res.data.user }, error: res.error })),
                    10000,
                    { data: { user: null }, error: { message: "Verification Timed Out", status: 408 } as any }
                )

                console.log(`⏱️ Gold Standard Verification took ${Date.now() - startTime}ms`)

                // Extension Resilience:
                if (authError || !verifiedUser) {
                    console.warn("⚠️ Server verification warning:", authError)

                    const isCriticalAuthError = authError?.status === 401 ||
                        authError?.message?.includes("token") ||
                        authError?.message?.includes("JWT")

                    if (isCriticalAuthError) {
                        console.error("⛔ Critical Auth Failure. Session Invalid. Logging out.")
                        return false
                    } else {
                        console.log("🛡️ Extension/Network Block Detected. Entering LIMITED mode (Cushioned).")
                        // We do NOT set serverVerified = true
                        if (status !== 'LIMITED') setStatus('LIMITED')
                    }
                } else {
                    // Happy Path: Server confirmed session is valid
                    serverVerified = true
                }

                // 1. Check Admin Status (Strict RPC ONLY)
                // We NO LONGER check profile.is_admin or a whitelist. We ask the database directly.
                // TRI-STATE LOGIC: UNKNOWN -> ADMIN | NOT_ADMIN. No defaulting to false on timeout.
                try {
                    const rpcStart = Date.now()
                    // Increased Timeout for Admin Check (12s) to handle slow cold starts
                    const adminCheckPromise = supabase.rpc('is_admin');
                    const adminResult = await timeoutPromise(adminCheckPromise, 12000, { data: null, error: { message: "RPC Timeout" } } as any);

                    console.log(`⏱️ Admin RPC took ${Date.now() - rpcStart}ms`)

                    const { data, error } = adminResult as any;

                    if (!error && data === true) {
                        console.log("👮 Admin status confirmed via RPC.");
                        setAdminStatus('ADMIN');
                    } else if (!error && data === false) {
                        console.log("👤 User is NOT an admin (RPC returned false).");
                        setAdminStatus('NOT_ADMIN');
                    } else {
                        // Error or Timeout: Keep UNKNOWN. Do NOT set NOT_ADMIN.
                        console.warn("⚠️ Admin check indeterminate (Timeout or Error). Status remains UNKNOWN.", error);
                        // We keep unknown so AdminRoute can show a spinner/retry instead of kicking them out.
                    }

                } catch (e) {
                    console.warn("Admin RPC check exception:", e);
                    // Keep UNKNOWN
                }

                // 2. Fetch Profile (Available Fields Only)
                // DO NOT query 'is_admin'. DO NOT retry loops.
                let profile = null;

                try {
                    // Try Live DB with 10s Timeout
                    const profilePromise = supabase
                        .from('profiles')
                        .select('company_name, full_name') // STRICTLY EXISTING COLUMNS
                        .eq('id', userId)
                        .maybeSingle();

                    const dbResult = await timeoutPromise(profilePromise, 10000, {
                        data: null,
                        error: { message: "Profile Timeout", code: "TIMEOUT" } as any,
                        count: null,
                        status: 408,
                        statusText: "Timeout"
                    } as any);

                    profile = dbResult.data;

                    if (dbResult.error) {
                        console.warn("Profile fetch warning (Non-Fatal):", dbResult.error.message)
                    }

                    if (profile) {
                        // Success! Cache it for resilience
                        if (resilientStorage.setProfile) resilientStorage.setProfile(userId, profile)
                    }
                } catch (e) {
                    console.warn("Profile fetch exception:", e)
                }

                // If Live DB Failed, Try Cache
                if (!profile && resilientStorage.getProfile) {
                    console.log("⚠️ DB Profile missing. Trying Offline Cache.")
                    try {
                        profile = await resilientStorage.getProfile(userId);
                        if (profile) console.log("✅ Restored Profile from Offline Cache.")
                    } catch (e) { /* Ignore */ }
                }

                if (profile) {
                    setCompanyName(profile.company_name || null)
                    setFullName(profile.full_name || null)
                } else {
                    setCompanyName(null)
                }

                // 2. Check Tier
                // Similar logic for Subscription (Cache it too if needed, but profile is main redirect blocker)
                // Added 10s Timeout
                const subPromise = supabase
                    .from('subscriptions')
                    .select('plan_name')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .maybeSingle()

                const { data: sub } = await timeoutPromise(subPromise, 10000, { data: null } as any)

                if (sub?.plan_name) {
                    const p = sub.plan_name.toLowerCase()
                    if (p.includes('enterprise') || p.includes('pro')) setTier("Pro")
                    else if (p.includes('standard')) setTier("Standard")
                    else setTier("Free")
                } else {
                    setTier("Free")
                }

                // 3. Status Finalization
                // Only set AUTHENTICATED if we server verified or completed happy path.
                // Keep LIMITED if verification failed but we didn't crash.
                lastCheckedUserIdRef.current = userId;

                if (serverVerified) {
                    if (status !== 'AUTHENTICATED') setStatus('AUTHENTICATED')
                } else {
                    // FIX #2: Robust Fallback
                    // If server verification failed but we have a session (userId exists),
                    // ensuring we don't leave the user in LOADING or UNAUTHENTICATED.
                    // We force LIMITED unless they are somehow already AUTHENTICATED.
                    if (status !== 'AUTHENTICATED') setStatus('LIMITED')
                }

                return true

            } catch (e) {
                console.error("Auth check unexpected error:", e)
                // Safety Net: Don't logout on crash
                if (status === 'LOADING') setStatus('LIMITED')
                return true
            } finally {
                verificationInProgress.current = false
                inFlightPromiseRef.current = null
            }
        })()

        inFlightPromiseRef.current = verificationPromise
        return verificationPromise
    }

    const refreshProfile = async () => {
        if (user?.id) {
            // Force re-check? No, checkUserRoleAndTier has guard.
            // If we want to FORCE refresh, we might need to clear ref.
            // But usually refreshProfile is called after manual updates.
            lastCheckedUserIdRef.current = null; // Allow re-check
            await checkUserRoleAndTier(user.id)
        }
    }

    const retryVerification = async () => {
        if (user?.id) {
            console.log("🔄 Manual Verification Retry Requested")
            lastCheckedUserIdRef.current = null
            await checkUserRoleAndTier(user.id)
        }
    }

    useEffect(() => {
        let isMounted = true
        console.log("🚀 AuthProvider MOUNTED - Senior Resilience Mode")

        const initialize = async () => {
            // SENIOR PRINCIPLE 1: "Delay decisions"
            // We start LOADING.
            // We check session.
            // We wait for verification.

            // Safety Timeout: If Supabase hangs for > 15s (User Req), force completion
            // FIX #1: Use ref for cleanup
            initTimeoutRef.current = setTimeout(() => {
                console.warn("⚠️ Auth Initialization timed out (15s). Forcing resolution.")
                supabase.auth.getSession().then(({ data }) => {
                    if (!isMounted) return
                    if (data.session) {
                        setStatus('LIMITED')
                    } else {
                        setStatus('UNAUTHENTICATED')
                    }
                })
            }, 15000)

            try {
                // 1. Check for Magic Link / OAuth Code
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.hash.includes('type=magiclink') ||
                    window.location.search.includes('code=');

                // 2. Get Session (Optimistic)
                const { data } = await supabase.auth.getSession()
                let initialSession = data.session

                // Clear timeout since we got a response
                if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)

                if (initialSession) {
                    console.log("✅ Optimistic Session Restored.")
                    setSession(initialSession)
                    setUser(initialSession.user)
                    // Verify (Status updated inside)
                    await checkUserRoleAndTier(initialSession.user.id)
                } else if (!isMagicLink) {
                    // Only declare UNAUTHENTICATED if we are purely empty and not waiting for a swap
                    setStatus('UNAUTHENTICATED')
                }
                // If isMagicLink, we stay LOADING and let onAuthStateChange handle the event

            } catch (err) {
                console.error("Auth init error:", err)
                if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
                setStatus('UNAUTHENTICATED')
            }
        }

        initialize()

        // 3. Auth Listener (The Source of Truth)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return
            console.log(`Auth Event: ${event}`)

            if (event === 'SIGNED_OUT') {
                // SENIOR PRINCIPLE 4: "Reconile state"
                // Ignore SIGNED_OUT if we are actually swapping tokens (PKCE)
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.search.includes('code=');

                if (isMagicLink) return;

                setSession(null)
                setUser(null)
                setAdminStatus('UNKNOWN') // Reset Admin Status
                lastCheckedUserIdRef.current = null // Reset Loop Guard
                setTier("Free")
                setCompanyName(null)
                setFullName(null)
                setStatus('UNAUTHENTICATED')
                return
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (currentSession) {
                    setSession(currentSession)
                    setUser(currentSession.user)
                    // Optimistic Update? No, stick to LOADING -> VERIFIED flow for robust UI
                    await checkUserRoleAndTier(currentSession.user.id)
                }
            }
        })

        return () => {
            isMounted = false
            // FIX #1: Cleanup timeout on unmount
            if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
            subscription.unsubscribe()
        }
    }, [])

    const value = {
        session,
        user,
        status,
        isAdmin, // Computed
        adminStatus, // Exposed for Tri-State Routing
        tier,
        companyName,
        fullName,
        // Helper accessors for legacy compatibility
        loading: status === 'LOADING',
        isVerified,
        signOut,
        refreshProfile,
        retryVerification,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
