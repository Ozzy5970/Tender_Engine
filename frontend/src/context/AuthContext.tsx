import { createContext, useContext, useEffect, useState, useRef } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"


type AuthContextType = {
    session: Session | null
    user: User | null
    isAdmin: boolean
    tier: "Free" | "Standard" | "Pro"
    companyName: string | null
    fullName: string | null
    loading: boolean
    isVerified: boolean // Flag indicating server-side verification is complete
    safeMode: boolean // Flag indicating we are in a degraded state due to network/extension interference
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAdmin: false,
    tier: "Free",
    companyName: null,
    fullName: null,
    loading: true,
    isVerified: false,
    safeMode: false,
    signOut: async () => { },
    refreshProfile: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [tier, setTier] = useState<"Free" | "Standard" | "Pro">("Free")
    const [companyName, setCompanyName] = useState<string | null>(null)
    const [fullName, setFullName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [isVerified, setIsVerified] = useState(false)
    const [safeMode, setSafeMode] = useState(false)

    // Concurrency Guard: Prevent overlapping verifications
    const verificationInProgress = useRef(false)

    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        if (!userId) {
            setIsAdmin(false)
            setTier("Free")
            setCompanyName(null)
            return false
        }

        // Prevent double-checking if we are already busy verifying this same user
        if (verificationInProgress.current) {
            return true
        }

        verificationInProgress.current = true
        const start = performance.now()

        try {
            // 0. SERVER-SIDE VERIFICATION
            const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser()

            // console.log(`AuthVerify Step 1: ${Math.round(performance.now() - start)}ms`)

            if (authError || !verifiedUser) {
                console.warn("Server-side auth verification failed (non-fatal):", authError)
                // If getUser fails, we might have a stale token. Try ONE refresh.
                const { error: refreshError } = await supabase.auth.refreshSession()
                if (refreshError) {
                    console.error("Session refresh failed:", refreshError)
                    return false
                }
            }

            // 1. Check Profile (with retry and timeout)
            const dbPromise = (async () => {
                let profileData = null

                // First Attempt
                const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin, company_name, full_name').eq('id', userId).single()

                if (profileError) {
                    console.warn("Profile fetch error (Attempt 1):", profileError)
                    // RETRY LOGIC: Wait 1s and try again (helps with race conditions/extensions)
                    await new Promise(r => setTimeout(r, 1000))
                    const { data: profileRetry, error: retryError } = await supabase.from('profiles').select('is_admin, company_name, full_name').eq('id', userId).single()

                    if (retryError) {
                        console.error("Profile fetch error (Attempt 2 - Give Up):", retryError)
                    } else {
                        profileData = profileRetry
                    }
                } else {
                    profileData = profile
                }

                setIsAdmin(profileData?.is_admin || false)
                setCompanyName(profileData?.company_name || null)
                setFullName(profileData?.full_name || null)

                // 2. Check Tier
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

                return 'OK'
            })()

            const timeoutPromise = new Promise<'TIMEOUT'>(resolve => setTimeout(() => resolve('TIMEOUT'), 8000)) // Bumped to 8s for retry

            const result = await Promise.race([dbPromise, timeoutPromise])
            const duration = Math.round(performance.now() - start)
            console.log(`✅ Auth Verification Complete in ${duration}ms`)

            if (result === 'TIMEOUT') {
                console.warn("Auth check timed out - assuming Free/Non-Admin to unblock UI")
                setIsAdmin(false)
                setTier("Free")
                // Don't fully fail, just let them in as free user
            }

            setIsVerified(true)
            return true
        } catch (e) {
            console.error("Auth check failed (non-fatal):", e)
            setIsVerified(true)
            return true
        } finally {
            verificationInProgress.current = false
        }
    }

    const refreshProfile = async () => {
        if (user?.id) {
            await checkUserRoleAndTier(user.id)
        }
    }

    useEffect(() => {
        let isMounted = true
        console.log("🚀 AuthProvider MOUNTED - App has started/restarted")

        // 1. SAFETY NET: If everything hangs, release the UI after 5 seconds.
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                console.warn("⚠️ Auth Init Safety Timeout (5s). Forcing UI load.")
                setLoading(false)
            }
        }, 5000)

        const initialize = async () => {
            setLoading(true)
            let initialSession = null
            try {
                // 1. Get initial session based on storage
                const { data } = await supabase.auth.getSession()
                initialSession = data.session

                if (!isMounted) return

                if (initialSession) {
                    console.log("✅ Session found. Verifying profile...")
                    setSession(initialSession)
                    setUser(initialSession.user)

                    // 2. BLOCKING VERIFICATION (Production Safety)
                    // We await this to ensure 'isVerified' is true before releasing the UI.
                    // This prevents ProtectedRoute from bouncing the user back to login.
                    await checkUserRoleAndTier(initialSession.user.id)
                    console.log("✅ Verification finished. Releasing UI.")
                }
            } catch (err) {
                console.error("Auth init error:", err)
            } finally {
                if (isMounted) {
                    // CRITICAL FIX: Do NOT release UI if we are processing a Magic Link
                    // If we do, ProtectedRoute will redirect to /auth before Supabase verifies the token
                    const isMagicLink = window.location.hash.includes('access_token') ||
                        window.location.hash.includes('type=recovery') ||
                        window.location.hash.includes('type=magiclink') ||
                        window.location.hash.includes('error_description') ||
                        window.location.search.includes('code=');

                    if (!initialSession && isMagicLink) {
                        console.log("🔗 Magic Link detected. Holding UI for verification...")
                        // We do NOT set loading(false) here. 
                        // We rely on the 'SIGNED_IN' event (or the Safety Timer) to unlock the UI.
                    } else {
                        setLoading(false)
                        clearTimeout(safetyTimer) // Clear safety net if we finished successfully
                    }
                }
            }
        }

        initialize()

        // FLOOD PROTECTION START
        // Track last 10 event timestamps to detect infinite loops
        const eventTimestamps: number[] = []

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            const now = Date.now()
            eventTimestamps.push(now)
            // Keep only last 10
            if (eventTimestamps.length > 10) eventTimestamps.shift()

            // Check if last 10 events happened in < 2 seconds (Infinite Loop)
            if (eventTimestamps.length >= 10 && (now - eventTimestamps[0] < 2000)) {
                console.error(`🚨 [AuthContext] INFINITE LOOP DETECTED. Unsubscribing to save browser.`)
                // Enable SAFE MODE - This is the "Graceful Fallback"
                setSafeMode(true)
                subscription.unsubscribe()
                return
            }
            // FLOOD PROTECTION END

            if (!isMounted) return

            console.log(`Auth Event: ${event}`)

            if (event === 'SIGNED_OUT') {
                // CRITICAL FIX: Ignore SIGNED_OUT if we are in the middle of a PKCE flow (Google OAuth)
                // Supabase fires SIGNED_OUT *before* processing the 'code' param, causing premature redirect.
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.hash.includes('type=magiclink') ||
                    window.location.hash.includes('error_description') ||
                    window.location.search.includes('code=');

                if (isMagicLink) {
                    console.log("🔒 [AuthContext] Ignoring SIGNED_OUT (Pending PKCE/MagicLink Flow)")
                    return
                }

                console.log("🔒 [AuthContext] Signed Out Event Received.")
                setSession(null)
                setUser(null)
                setIsAdmin(false)
                setTier("Free")
                setCompanyName(null)
                setFullName(null)
                setIsVerified(false)
                setLoading(false)
                return
            }

            if (event === 'TOKEN_REFRESHED') {
                // SAFETY: Just update the session. Do NOT re-verify (calls getUser which might refresh again -> loop)
                setSession(currentSession)
                setUser(currentSession?.user ?? null)
                setLoading(false)
            }

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                setSession(currentSession)
                setUser(currentSession?.user ?? null)
                if (currentSession?.user?.id) {
                    // Update Role/Tier in background (Optimistic - don't block login)
                    checkUserRoleAndTier(currentSession.user.id).then(ok => {
                        console.log(`🔍 Listener Verification Complete: ${ok ? 'OK' : 'Failed'}`)
                    })
                }
                setLoading(false)
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])


    const signOut = async () => {
        setLoading(true)
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setIsAdmin(false)
        setTier("Free")
        setCompanyName(null)
        setFullName(null)
        setIsVerified(false)
        setLoading(false)
    }

    const value = {
        session,
        user,
        isAdmin,
        tier,
        companyName,
        fullName,
        loading,
        isVerified,
        safeMode,
        signOut,
        refreshProfile,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
