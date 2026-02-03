import { createContext, useContext, useEffect, useState } from "react"
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

    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        // setIsVerified(false) // <--- DISABLED: Don't invalidate session during background checks
        if (!userId) {
            setIsAdmin(false)
            setTier("Free")
            setCompanyName(null)
            return false
        }

        try {
            console.time("AuthVerify")
            // 0. SERVER-SIDE VERIFICATION
            const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser()

            console.timeLog("AuthVerify", "getUser complete")

            if (authError || !verifiedUser) {
                console.warn("Server-side auth verification failed (non-fatal):", authError)
            }

            // 1. Check Profile (with timeout)
            const dbPromise = (async () => {
                console.time("ProfileFetch")
                const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin, company_name, full_name').eq('id', userId).single()
                console.timeEnd("ProfileFetch")

                if (profileError) {
                    if (profileError.code === 'PGRST116') {
                        // Ghost session logic
                    }
                    console.warn("Profile fetch error (non-fatal):", profileError)
                }

                setIsAdmin(profile?.is_admin || false)
                setCompanyName(profile?.company_name || null)
                setFullName(profile?.full_name || null)

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

            const timeoutPromise = new Promise<'TIMEOUT'>(resolve => setTimeout(() => resolve('TIMEOUT'), 5000))

            const result = await Promise.race([dbPromise, timeoutPromise])
            console.timeEnd("AuthVerify")

            if (result === 'TIMEOUT') {
                console.warn("Auth check timed out - assuming Free/Non-Admin to unblock UI")
                setIsAdmin(false)
                setTier("Free")
            } else if (result === 'GHOST') {
                return false
            }

            setIsVerified(true)
            return true
        } catch (e) {
            console.error("Auth check failed (non-fatal):", e)
            setIsVerified(true)
            return true
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
                    console.log("✅ Session found. Loading UI immediately (Optimistic).")
                    setSession(initialSession)
                    setUser(initialSession.user)

                    // 2. NON-BLOCKING VERIFICATION
                    checkUserRoleAndTier(initialSession.user.id).then(ok => {
                        if (isMounted) console.log(`🔍 Background Verification Complete: ${ok ? 'OK' : 'Failed'}`)
                    })
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
                        window.location.hash.includes('error_description');

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

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return

            console.log(`Auth Event: ${event}`)

            if (event === 'SIGNED_OUT') {
                // SAFETY: Double-check if this is a real logout or a "glitch" (extension interference).
                // If we can still retrieve a valid user from the server, we ignore the local event.
                const { data: verifyData } = await supabase.auth.getUser()

                if (verifyData?.user) {
                    console.warn(`⚠️ [AuthContext] intercepted false 'SIGNED_OUT' event. Session is valid. ignoring.`)
                    // Optionally refresh the session in context just to be sure
                    setSession(previousSession => previousSession)
                    return
                }

                console.log("🔒 [AuthContext] Verified Logout. Clearing state.")
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

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
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
        signOut,
        refreshProfile,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
