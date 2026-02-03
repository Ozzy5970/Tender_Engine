import { createContext, useContext, useEffect, useState, useRef } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"


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
    const checkUserRoleAndTier = async (userId: string | undefined): Promise<boolean> => {
        if (!userId) {
            setStatus('UNAUTHENTICATED')
            return false
        }

        if (verificationInProgress.current) return true
        verificationInProgress.current = true

        try {
            // 0. GOLD STANDARD VERIFICATION
            const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser()

            // Extension Resilience:
            // If authError is 401/403 -> Invalid Token -> Logout
            // If authError is Network/Unknown -> Assume Extension Block -> LIMITED Mode (Stay logged in)
            if (authError || !verifiedUser) {
                console.warn("⚠️ Server verification warning:", authError)

                const isCriticalAuthError = authError?.status === 401 ||
                    authError?.message?.includes("token") ||
                    authError?.message?.includes("JWT")

                if (isCriticalAuthError) {
                    console.error("⛔ Critical Auth Failure. Session Invalid. Logging out.")
                    // FIX: signOut is defined above now, or hoisted?
                    // To be safe, we just call the logic directly or rely on React hoisting (const isn't hoisted).
                    // We moved signOut DEFINITION above this function to fix "used before declaration".
                    await signOut()
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
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin, company_name, full_name')
                .eq('id', userId)
                .maybeSingle()

            if (profile) {
                setIsAdmin(profile.is_admin || false)
                setCompanyName(profile.company_name || null)
                setFullName(profile.full_name || null)
            } else {
                // RLS or specific table block shouldn't kill the session
                console.warn("⚠️ Profile not found or RLS blocked. User stays authenticated.")
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
