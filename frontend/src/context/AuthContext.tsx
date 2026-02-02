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

        const initialize = async () => {
            setLoading(true)
            try {
                // 1. Get initial session based on storage
                const { data: { session: initialSession } } = await supabase.auth.getSession()

                if (!isMounted) return

                if (initialSession) {
                    setSession(initialSession)
                    setUser(initialSession.user)
                    // Optimistic verification
                    await checkUserRoleAndTier(initialSession.user.id)
                }
            } catch (err) {
                console.error("Auth init error:", err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        initialize()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return

            console.log(`Auth Event: ${event}`)

            if (event === 'SIGNED_OUT') {
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
                    // Update Role/Tier in background
                    await checkUserRoleAndTier(currentSession.user.id)
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
