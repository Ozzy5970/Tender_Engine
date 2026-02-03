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

    // Concurrency Guard: Prevent overlapping verifications
    const verificationInProgress = useRef(false)

    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        if (!userId) {
            setIsAdmin(false)
            setTier("Free")
            setCompanyName(null)
            setIsVerified(true) // Verified as GUEST
            return false
        }

        // Prevent double-checking if we are already busy verifying this same user
        if (verificationInProgress.current) {
            return true
        }

        verificationInProgress.current = true

        try {
            // 0. SERVER-SIDE VERIFICATION
            const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser()

            if (authError || !verifiedUser) {
                console.warn("Server-side auth verification warning:", authError)

                // CRITICAL FIX: Only logout if it is definitely an AUTH error (401/Bad JWT).
                // If it is a network error (extensions blocking), we trust the local session (Soft Fallback).
                const isAuthError = authError?.status === 401 || authError?.message?.includes("token")

                if (isAuthError) {
                    console.error("⛔ Critical Auth Error. Logging out.")
                    setSession(null)
                    setUser(null)
                    setIsVerified(true)
                    return false
                }

                // If we are here, it might be a network glitch or extension block.
                // We proceed with the optimistic user from getSession().
                console.log("⚠️ Allowing access despite verification failure (Network/Extension resilience)")
            }

            // If we have no verified user but we passed the check above (resilience), use the optimistic user
            const targetId = verifiedUser?.id || userId
            if (!targetId) {
                // Should be impossible if userId was passed, but safe guard
                return false;
            }

            // 1. Check Profile (Simple fetch, no retries needed if auth is solid)
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin, company_name, full_name')
                .eq('id', targetId)
                .maybeSingle()

            // If profile is missing (RLS error or just not created), we DO NOT logout.
            // We just set nulls and let the UI handle the empty state.
            if (profile) {
                setIsAdmin(profile.is_admin || false)
                setCompanyName(profile.company_name || null)
                setFullName(profile.full_name || null)
            } else {
                console.warn("Profile not found or access denied via RLS. Rendering in limited mode.")
                setIsAdmin(false)
                setCompanyName(null)
            }

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
            // Even on error, we mark verified so we don't block the UI forever
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
        console.log("🚀 AuthProvider MOUNTED - Senior Mode V2")

        // 1. Initial Load Logic
        const initialize = async () => {
            setLoading(true)
            try {
                // Determine if we are in a Magic Link / PKCE flow
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.hash.includes('type=magiclink') ||
                    window.location.search.includes('code=');

                // Get current session from storage (optimistic)
                const { data } = await supabase.auth.getSession()
                let initialSession = data.session

                // If no session but we see a magic link code, wait a bit for the auto-exchange
                if (!initialSession && isMagicLink) {
                    console.log("🔗 PKCE/Magic Link detected. Waiting for auto-session exchange...")
                    // We don't force false yet. We rely on the listener.
                    // But we DO verify if we *have* a session.
                }

                if (initialSession) {
                    console.log("✅ Optimistic Session found. Verifying...")
                    setSession(initialSession)
                    setUser(initialSession.user)
                    // Verify with server to be sure
                    await checkUserRoleAndTier(initialSession.user.id)
                    // Release loading logic after verification
                    if (isMounted) setLoading(false)
                }

                // If we are NOT in a magic link flow, and result is null, we are done.
                if (!initialSession && !isMagicLink) {
                    if (isMounted) setLoading(false)
                }

            } catch (err) {
                console.error("Auth init error:", err)
                if (isMounted) setLoading(false)
            }
        }

        initialize()

        // 2. Auth State Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return
            console.log(`Auth Event: ${event}`)

            if (event === 'SIGNED_OUT') {
                // Ignore SIGNED_OUT if magic link is updating
                const isMagicLink = window.location.hash.includes('access_token') ||
                    window.location.hash.includes('type=recovery') ||
                    window.location.hash.includes('type=magiclink') ||
                    window.location.search.includes('code=');

                if (isMagicLink) {
                    // console.log("🔒 Keeping UI Clean during PKCE swap")
                    return;
                }

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

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    // Update Role/Tier (Optimistic)
                    checkUserRoleAndTier(currentSession.user.id).then(() => {
                        if (isMounted) setLoading(false)
                    })
                } else {
                    if (isMounted) setLoading(false)
                }
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
