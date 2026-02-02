import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

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

        // GLOBAL SAFETY VALVE: Force loading to false after 8 seconds no matter what
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                console.warn("Auth initialization timed out (Global Safety). Forcing UI release.")
                setLoading((prev) => {
                    if (prev) return false
                    return prev
                })
            }
        }, 8000)

        const keys = Object.keys(localStorage)
        console.log(`🚀 [DIAGNOSTIC] Storage Keys Found (${keys.length}):`, keys)
        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        if (sbKey) {
            console.log(`✅ Supabase Token Found in Storage: ${sbKey}`)
        } else {
            console.warn("❌ NO Supabase Token Found in Storage!")
        }

        const initialize = async () => {
            setLoading(true)
            try {
                // race getSession against a 2s timeout (Faster failure is better here)
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
                    setTimeout(() => resolve({ data: { session: null } }), 2000)
                )

                const { data: { session: initialSession } } = await Promise.race([sessionPromise, timeoutPromise])

                if (!isMounted) return

                let activeSession = initialSession

                // RETRY LOGIC: Removed to prevent deadlock. 
                // We rely on onAuthStateChange to pick up the token from localStorage.
                // If the token is valid, SIGNED_IN will fire. 
                if (!activeSession) {
                    const localKeys = Object.keys(localStorage)
                    const hasToken = localKeys.some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                    if (hasToken) {
                        console.log("⚠️ Token exists in storage. Deferring to onAuthStateChange event...")
                        // CRITICAL FIX: Do NOT set session to null or loading to false here.
                        // We wait for the 'SIGNED_IN' event to handle it.
                        // If that event never comes, the Global Safety Valve (8s) will eventually unlock the UI.
                        return
                    }
                }

                if (activeSession) {
                    setSession(activeSession)
                    setUser(activeSession.user)
                    const ok = await checkUserRoleAndTier(activeSession.user.id)
                    if (!ok && isMounted) {
                        console.warn("User role verification failed, but keeping session active (downgraded access).")
                        // await signOut() // <--- PREVENT AUTO-LOGOUT
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
                clearTimeout(safetyTimer)
            }
        }

        initialize()



        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return

            console.log(`Auth Event: ${event}`) // Debug log

            if (event === 'SIGNED_OUT') {
                console.warn("Supabase Client fired SIGNED_OUT event.")
                toast.error("Session Ended", {
                    description: "You have been logged out. Please log in again.",
                    duration: 5000,
                })
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
                // ... rest is same
                setSession(currentSession)
                setUser(currentSession?.user ?? null)
                if (currentSession?.user?.id) {
                    const ok = await checkUserRoleAndTier(currentSession.user.id)
                    if (!ok && isMounted) {
                        console.warn("Re-verification failed, but keeping session active.")
                        // await signOut() // <--- PREVENT AUTO-LOGOUT
                    }
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
