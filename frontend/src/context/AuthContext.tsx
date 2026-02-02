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
        setIsVerified(false)
        if (!userId) {
            setIsAdmin(false)
            setTier("Free")
            setCompanyName(null)
            return false
        }

        try {
            // 0. SERVER-SIDE VERIFICATION
            const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser()
            if (authError || !verifiedUser) {
                console.warn("Server-side auth verification failed.")
                return false
            }

            // 1. Check Profile
            const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin, company_name, full_name').eq('id', userId).single()

            if (profileError) {
                if (profileError.code === 'PGRST116') {
                    console.warn("Ghost session detected (missing profile).")
                    return false
                }
                console.warn("Profile fetch error (non-fatal):", profileError)
                // Do not sign out on transient DB errors; just degrade to non-admin/free
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

            setIsVerified(true)
            return true
        } catch (e) {
            console.error("Auth check failed (non-fatal):", e)
            // Safety: If an unexpected error occurs, don't kill the session, 
            // but the user might have limited access (Free/Non-Admin).
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

        const initialize = async () => {
            setLoading(true)
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession()

                if (!isMounted) return

                if (initialSession) {
                    setSession(initialSession)
                    setUser(initialSession.user)
                    const ok = await checkUserRoleAndTier(initialSession.user.id)
                    if (!ok && isMounted) {
                        await signOut()
                    }
                } else {
                    setSession(null)
                    setUser(null)
                    setIsVerified(false)
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

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setSession(currentSession)
                setUser(currentSession?.user ?? null)
                if (currentSession?.user?.id) {
                    const ok = await checkUserRoleAndTier(currentSession.user.id)
                    if (!ok && isMounted) await signOut()
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
