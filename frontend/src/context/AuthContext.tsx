import { createContext, useContext, useEffect, useState, useRef } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { resilientStorage } from "@/lib/resilientStorage"

// --- Timeout Helper (Duplicated for Context Safety) ---
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
    isAppDirty: boolean
    setAppDirty: (dirty: boolean) => void
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
    isAppDirty: false,
    setAppDirty: () => {},
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
    const [isAppDirty, setAppDirty] = useState(false)

    // Legacy flag for compatibility, equivalent to (status === 'AUTHENTICATED' || status === 'LIMITED')
    const isVerified = status === 'AUTHENTICATED' || status === 'LIMITED'

    // Computed isAdmin for backward compat
    const isAdmin = adminStatus === 'ADMIN'

    // Concurrency & Loop Guard
    const verificationInProgress = useRef(false)
    const inFlightPromiseRef = useRef<Promise<boolean> | null>(null)
    const lastCheckedUserIdRef = useRef<string | null>(null)
    const initTimeoutRef = useRef<any>(null)

    const signOut = async () => {
        // Optimistic Logout
        setSession(null)
        setUser(null)
        setStatus('UNAUTHENTICATED')
        setAppDirty(false) // 4. explicitly reset on sign out

        // Reset Admin State
        setAdminStatus('UNKNOWN')
        lastCheckedUserIdRef.current = null
        setTier("Free")
        setCompanyName(null)
        setFullName(null)

        await supabase.auth.signOut()
    }

    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        if (!userId) {
            setStatus('UNAUTHENTICATED')
            lastCheckedUserIdRef.current = null
            setAdminStatus('UNKNOWN')
            return false
        }

        if (lastCheckedUserIdRef.current === userId) {
            console.log("🛡️ Skipping redundant check (already verified for this user).")
            return true
        }

        if (inFlightPromiseRef.current) {
            console.log("✈️ Auth verification already in flight. Waiting for result...")
            return inFlightPromiseRef.current
        }

        const verificationPromise = (async () => {
            verificationInProgress.current = true
            let serverVerified = false
            const startTime = Date.now()

            try {
                // PARALLEL BOOTSTRAP: Resolve all network calls concurrently to slash load times
                const userPromise = timeoutPromise(
                    supabase.auth.getUser().then(res => ({ data: { user: res.data.user }, error: res.error })),
                    10000,
                    { data: { user: null }, error: { message: "Verification Timed Out", status: 408 } as any }
                )

                const adminCheckPromise = timeoutPromise(
                    supabase.rpc('is_admin'), 
                    12000, 
                    { data: null, error: { message: "RPC Timeout" } } as any
                )

                const profilePromise = timeoutPromise(
                    supabase.from('profiles').select('company_name, full_name').eq('id', userId).maybeSingle(),
                    10000,
                    { data: null, error: { message: "Profile Timeout", code: "TIMEOUT" } as any, count: null, status: 408, statusText: "Timeout" } as any
                )

                const subPromise = timeoutPromise(
                    supabase.from('subscriptions').select('plan_name').eq('user_id', userId).eq('status', 'active').maybeSingle(),
                    10000,
                    { data: null } as any
                )

                const [authRes, adminResult, dbResult, subRes] = await Promise.all([
                    userPromise, adminCheckPromise, profilePromise, subPromise
                ])

                const { data: { user: verifiedUser }, error: authError } = authRes
                console.log(`⏱️ Parallel Verification took ${Date.now() - startTime}ms`)

                // 0. Server Verification
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
                        // Downgrade to LIMITED if optimistic UI was previously established
                        setStatus('LIMITED')
                    }
                } else {
                    serverVerified = true
                }

                // 1. Check Admin Status
                const { data: adminData, error: adminErr } = adminResult as any
                if (!adminErr && adminData === true) {
                    setAdminStatus('ADMIN');
                } else {
                    if (adminErr) console.warn("⚠️ [AuthContext] Admin check indeterminate. Defaulting to NOT_ADMIN.", adminErr);
                    setAdminStatus('NOT_ADMIN');
                }

                // 2. Fetch Profile
                let profile = dbResult.data;
                if (dbResult.error) console.warn("Profile fetch warning (Non-Fatal):", dbResult.error.message)

                if (!profile && resilientStorage.getProfile) {
                    try {
                        profile = await resilientStorage.getProfile(userId);
                    } catch (e) { /* Ignore */ }
                }

                if (profile) {
                    setCompanyName(profile.company_name || null)
                    setFullName(profile.full_name || null)
                    if (resilientStorage.setProfile) resilientStorage.setProfile(userId, profile)
                } else {
                    setCompanyName(null)
                }

                // 3. Fetch Subscription Tier
                const { data: sub } = subRes as any
                if (sub?.plan_name) {
                    const p = sub.plan_name.toLowerCase()
                    if (p.includes('enterprise') || p.includes('pro')) setTier("Pro")
                    else if (p.includes('standard')) setTier("Standard")
                    else setTier("Free")
                } else {
                    setTier("Free")
                }

                // Finalize Status
                lastCheckedUserIdRef.current = userId;

                if (serverVerified) {
                    setStatus('AUTHENTICATED')
                } else if (status !== 'AUTHENTICATED') {
                    setStatus('LIMITED')
                }
                
                return true

            } catch (e) {
                console.error("⛔ [AuthContext] Auth check unexpected error:", e)
                setAdminStatus('NOT_ADMIN')
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
            lastCheckedUserIdRef.current = null; 
            await checkUserRoleAndTier(user.id)
        }
    }

    const retryVerification = async () => {
        if (user?.id) {
            lastCheckedUserIdRef.current = null
            await checkUserRoleAndTier(user.id)
        }
    }

    useEffect(() => {
        let isMounted = true

        const initialize = async () => {
            initTimeoutRef.current = setTimeout(() => {
                supabase.auth.getSession().then(({ data }) => {
                    if (!isMounted) return
                    if (data.session) setStatus('LIMITED')
                    else setStatus('UNAUTHENTICATED')
                })
            }, 10000)

            try {
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.hash.includes('type=magiclink') ||
                    window.location.search.includes('code=');

                const { data } = await supabase.auth.getSession()
                let initialSession = data.session

                if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)

                if (initialSession) {
                    console.log("✅ Optimistic Session Restored. Bootstrapping UI.")
                    setSession(initialSession)
                    setUser(initialSession.user)
                    // Optimistic UI for fast perceived load time
                    setStatus('AUTHENTICATED')
                    // Silent background hydration
                    checkUserRoleAndTier(initialSession.user.id)
                } else if (!isMagicLink) {
                    setStatus('UNAUTHENTICATED')
                }

            } catch (err) {
                if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
                setStatus('UNAUTHENTICATED')
            }
        }

        initialize()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return

            if (event === 'SIGNED_OUT') {
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.search.includes('code=');

                if (isMagicLink) return;

                setSession(null)
                setUser(null)
                setAdminStatus('UNKNOWN') 
                lastCheckedUserIdRef.current = null 
                setTier("Free")
                setCompanyName(null)
                setFullName(null)
                setStatus('UNAUTHENTICATED')
                setAppDirty(false)
                return
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (currentSession) {
                    setSession(currentSession)
                    setUser(currentSession.user)
                    await checkUserRoleAndTier(currentSession.user.id)
                }
            }
        })

        return () => {
            isMounted = false
            if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
            subscription.unsubscribe()
        }
    }, [])

    const value = {
        session,
        user,
        status,
        isAdmin, 
        adminStatus, 
        tier,
        companyName,
        fullName,
        loading: status === 'LOADING',
        isVerified,
        isAppDirty,
        setAppDirty,
        signOut,
        refreshProfile,
        retryVerification,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
