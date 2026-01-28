import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

type AuthContextType = {
    session: Session | null
    user: User | null
    isAdmin: boolean
    tier: "Free" | "Standard" | "Pro"
    companyName: string | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAdmin: false,
    tier: "Free",
    companyName: null,
    loading: true,
    signOut: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [tier, setTier] = useState<"Free" | "Standard" | "Pro">("Free")
    const [companyName, setCompanyName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const checkUserRoleAndTier = async (userId: string | undefined) => {
        if (!userId) {
            setIsAdmin(false)
            setTier("Free")
            setCompanyName(null)
            return
        }

        // 1. Check Profile (Admin + Company Info)
        const { data: profile } = await supabase.from('profiles').select('is_admin, company_name').eq('id', userId).single()
        setIsAdmin(profile?.is_admin || false)
        setCompanyName(profile?.company_name || null)

        // 2. Check Tier
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan_name')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle()

        if (sub?.plan_name) {
            // Normalize plan name
            const p = sub.plan_name.toLowerCase()
            if (p.includes('enterprise') || p.includes('pro')) setTier("Pro")
            else if (p.includes('standard')) setTier("Standard")
            else setTier("Free")
        } else {
            setTier("Free")
        }
    }

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            checkUserRoleAndTier(session?.user?.id)
            setLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            checkUserRoleAndTier(session?.user?.id)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setTier("Free")
        setCompanyName(null)
    }

    const value = {
        session,
        user,
        isAdmin,
        tier,
        companyName,
        loading,
        signOut,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
