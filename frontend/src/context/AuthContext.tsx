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

type AuthContextType = {
    session: Session | null
    user: User | null
    status: AuthStatus
    isAdmin: boolean
    tier: "Free" | "Standard" | "Pro"
    companyName: string | null
    fullName: string | null
    isVerified: boolean
    loading: boolean // <--- Added for compatibility
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    status: 'LOADING',
    isAdmin: false,
    tier: "Free",
    companyName: null,
    fullName: null,
    isVerified: false,
    loading: true, // <--- Added default
    signOut: async () => { },
    refreshProfile: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [status, setStatus] = useState<AuthStatus>('LOADING')

    // Profile Data
    const [isAdmin, setIsAdmin] = useState(false)
    const [tier, setTier] = useState<"Free" | "Standard" | "Pro">("Free")
    const [companyName, setCompanyName] = useState<string | null>(null)
    const [fullName, setFullName] = useState<string | null>(null)

    // Legacy flag for compatibility, equivalent to (status === 'AUTHENTICATED' || status === 'LIMITED')
    const isVerified = status === 'AUTHENTICATED' || status === 'LIMITED'

    const signOut = async () => {
        // Optimistic Logout
        setSession(null)
        setUser(null)
        setStatus('UNAUTHENTICATED')
        await supabase.auth.signOut()
    }

    // Concurrency Guard
    const verificationInProgress = useRef(false)

    /**
     * SENIOR PRINCIPLE 2: "Reconcile server + client state"
     * We don't just trust the token. We ask the server.
     * BUT: We don't punish network/extension failures with logout.
     */
    const checkUserRoleAndTier = async (userId: string | undefined, currentUser?: User | null): Promise<boolean> => {
        if (!userId) {
            setStatus('UNAUTHENTICATED')
            return false
        }

        // --- 0. SUPER ADMIN WHITELIST (NETWORK BYPASS) ---
        // Critical for "Perfect Refresh" when Extensions block DB calls.
        // We trust the email from the restored session (which is signed by Supabase).
        // This only controls UI routing. Real data is RLS protected.
        const ADMIN_WHITELIST = ['austin.simonsps@gmail.com', 'austin.simonsps+test@gmail.com'];
        let forcedAdmin = false;
        if (currentUser?.email && ADMIN_WHITELIST.includes(currentUser.email)) {
            console.log("👑 Super Admin Detected (Whitelist). Forcing Admin UI.");
            forcedAdmin = true;
            setIsAdmin(true); // Immediate UI Update
        }

        if (verificationInProgress.current) return true
        verificationInProgress.current = true

        try {
            // 0. GOLD STANDARD VERIFICATION with TIMEOUT
            // FIX: SES/Metamask can freeze getUser() indefinitely. We enforce a 2s timeout.
            const verifiedUserPromise = supabase.auth.getUser()
            const verificationTimeoutPromise = new Promise<{ data: { user: null }, error: any }>((resolve) =>
                setTimeout(() => resolve({ data: { user: null }, error: { message: "Verification Timed Out" } }), 2000)
            )

            const { data: { user: verifiedUser }, error: authError } = await Promise.race([
                verifiedUserPromise,
                verificationTimeoutPromise
            ])

            // Extension Resilience:
            // If authError is 401/403 -> Invalid Token -> Logout
            // If authError is Network/Unknown/Timeout -> Assume Extension Block -> LIMITED Mode (Stay logged in)
            if (authError || !verifiedUser) {
                console.warn("⚠️ Server verification warning:", authError)

                const isCriticalAuthError = authError?.status === 401 ||
                    authError?.message?.includes("token") ||
                    authError?.message?.includes("JWT")

                if (isCriticalAuthError) {
                    console.error("⛔ Critical Auth Failure. Session Invalid. Logging out.")
                    // FIX: Disable logout for "Ghost Logout" debugging
                    console.warn("🛑 DEBUG: Would have logged out here, but blocked for testing.")
                    // await signOut()
                    return false
                } else {
                    console.log("🛡️ Extension/Network Block Detected. Entering LIMITED mode (Cushioned).")
                    // We trust the optimistic session because the server is unreachable/blocked
                    setStatus('LIMITED')
                    // We can still try to fetch profile if RLS allows
                }
            } else {
                // Happy Path
                // if (status !== 'AUTHENTICATED') setStatus('AUTHENTICATED') // <-- DELAYED to end
            }

            // 1. Fetch Profile (Decoupled from Auth)
            // If this fails, we effectively degrade to LIMITED mode features (UI handles missing profile)
            // FIX: Try to fetch from DB -> Save to Cache. If Fail -> Read from Cache.
            let profile = null;
            let profileError = null;

            try {
                // Try Live DB
                // Wrap in timeout to prevent hanging
                const profilePromise = supabase
                    .from('profiles')
                    .select('is_admin, company_name, full_name')
                    .eq('id', userId)
                    .maybeSingle();

                const dbResult = await timeoutPromise(profilePromise, 2000, {
                    data: null,
                    error: {
                        message: "Profile Timeout",
                        details: "",
                        hint: "",
                        code: "TIMEOUT",
                        name: "TimeoutError"
                    },
                    count: null,
                    status: 408,
                    statusText: "Timeout"
                } as any);
                profile = dbResult.data;
                profileError = dbResult.error;

                if (profile) {
                    // Success! Cache it for resilience
                    // (We don't await this to keep UI snappy)
                    if (resilientStorage.setProfile) resilientStorage.setProfile(userId, profile)
                }
            } catch (e) { profileError = e }

            if (profileError) console.warn("Profile fetch error:", profileError)

            // If Live DB Failed, Try Cache
            if (!profile && resilientStorage.getProfile) {
                console.log("⚠️ DB Profile missing. Trying Offline Cache.")
                try {
                    profile = await resilientStorage.getProfile(userId);
                    if (profile) console.log("✅ Restored Profile from Offline Cache.")
                } catch (e) { /* Ignore */ }
            }

            if (profile) {
                setIsAdmin(profile.is_admin || forcedAdmin) // Trust DB OR Whitelist
                setCompanyName(profile.company_name || null)
                setFullName(profile.full_name || null)
            } else {
                // RLS or specific table block shouldn't kill the session
                if (forcedAdmin) {
                    // If DB completely failed but we are Whitelisted, ensure we stay Admin
                    setIsAdmin(true);
                    console.log("👑 DB Failed, but Whitelist sustained Admin Status.");
                } else {
                    console.warn("⚠️ Profile not found or RLS blocked. User stays authenticated.")
                    setIsAdmin(false)
                }
                setCompanyName(null)
            }

            // 2. Check Tier
            // Similar logic for Subscription (Cache it too if needed, but profile is main redirect blocker)
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plan_name')
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle()

            if (sub?.plan_name) {
                const p = sub.plan_name.toLowerCase()
                if (p.includes('enterprise') || p.includes('pro')) setTier("Pro")
                else if (p.includes('standard')) setTier("Standard")
                else setTier("Free")
            } else {
                setTier("Free")
            }

            // 3. NOW we are ready to say "AUTHENTICATED"
            // This ensures logic downstream (like isAdmin check) has the latest data.
            if (status !== 'AUTHENTICATED') setStatus('AUTHENTICATED')
            return true
        } catch (e) {
            console.error("Auth check unexpected error:", e)
            // Safety Net: Don't logout on crash
            setStatus('LIMITED')
            return true
        } finally {
            verificationInProgress.current = false
        }
    }

    const refreshProfile = async () => {
        if (user?.id) {
            await checkUserRoleAndTier(user.id, user)
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

            // Safety Timeout: If Supabase hangs for > 3s, force completion
            const timeoutId = setTimeout(() => {
                console.warn("⚠️ Auth Initialization timed out (3s). Forcing resolution.")
                if (isMounted) {
                    // If we have a user in state, go LIMITED. If not, go UNAUTHENTICATED.
                    setStatus((prev) => (prev === 'LOADING' ? 'UNAUTHENTICATED' : prev))
                }
            }, 3000)

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
                clearTimeout(timeoutId)

                if (initialSession) {
                    console.log("✅ Optimistic Session Restored.")
                    setSession(initialSession)
                    setUser(initialSession.user)
                    // Verify (Status updated inside)
                    await checkUserRoleAndTier(initialSession.user.id, initialSession.user)
                } else if (!isMagicLink) {
                    // Only declare UNAUTHENTICATED if we are purely empty and not waiting for a swap
                    setStatus('UNAUTHENTICATED')
                }
                // If isMagicLink, we stay LOADING and let onAuthStateChange handle the event

            } catch (err) {
                console.error("Auth init error:", err)
                clearTimeout(timeoutId)
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
                setIsAdmin(false)
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
                    await checkUserRoleAndTier(currentSession.user.id, currentSession.user)
                }
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const value = {
        session,
        user,
        status,
        isAdmin,
        tier,
        companyName,
        fullName,
        // Helper accessors for legacy compatibility
        loading: status === 'LOADING',
        isVerified,
        signOut,
        refreshProfile,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
