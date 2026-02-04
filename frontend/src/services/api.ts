import { supabase } from "@/lib/supabase"
import type { ApiResponse } from "@/types/api"

/**
 * Standardized response handler
 */
// --- Timeout Helper ---
// Robust timeout that handles PromiseLike (Supabase Builders)
const timeoutPromise = <T,>(promise: Promise<T> | PromiseLike<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
};

/**
 * Standardized response handler with Timeout Protection
 */
async function handleRequest<T>(request: PromiseLike<any>): Promise<ApiResponse<T>> {
    try {
        // Create a synthetic "timeout" error object
        const timeoutError = {
            data: null,
            error: {
                message: "Request timed out (Network/Extension Block)",
                code: "TIMEOUT",
                details: "The request took too long. Check for blocking extensions.",
                hint: "Try disabling ad blockers or reloading.",
                name: "TimeoutError"
            },
            status: 408
        };

        // Wrap the request in a 8000ms timeout
        // @ts-ignore - Supabase types are complex, but runtime this works.
        const response: any = await timeoutPromise(request, 8000, timeoutError);

        const { data, error, status } = response;

        if (error) {
            // Self-healing: If we hit a missing profile (PGRST116) on any authenticated query,
            // something is wrong with the session/profile sync.
            if (error.code === 'PGRST116') {
                console.warn("Authenticated request failed (Profile Missing). User remains logged in.")
                // Do NOT logout. Just let the UI handle the missing data (e.g. show "Complete Profile").
            }
            return { data: null, error: error.message, status: status || 500 }
        }

        return { data: data as T, error: null, status: status || 200 }
    } catch (err: any) {
        return { data: null, error: err.message || "Unknown error", status: 500 }
    }
}

// --- Interfaces ---

export interface Tender {
    id: string
    user_id: string
    title: string
    client_name: string
    closing_date: string
    status: 'ANALYZING' | 'DRAFT' | 'READY' | 'SUBMITTED' | 'ARCHIVED'
    compliance_score: number
    readiness: 'RED' | 'AMBER' | 'GREEN'
    created_at: string
    updated_at: string
    compliance_requirements?: {
        id: string
        rule_category: string
        description: string
        target_value: string | number | boolean
        is_killer: boolean
    }[]
    risks?: string[]
    strategy_tips?: string
}

export interface ManualTenderData {
    title: string
    client_name: string
    closing_date: string
    requirements: {
        cidb_grade?: string
        cidb_class?: string
        min_bbbee_level?: string
        mandatory_docs?: boolean
    }
}

export interface Template {
    id: string
    code: string
    title: string
    description: string
    category: string
    file_url: string
    download_count: number
    is_active: boolean
    created_at: string
}

/**
 * Tender Service
 */
export const TenderService = {
    async getAll() {
        return handleRequest<Tender[]>(
            supabase.from('tenders').select('*').order('created_at', { ascending: false })
        )
    },

    async getById(id: string) {
        return handleRequest<Tender>(
            supabase.from('tenders').select('*, compliance_requirements(*)').eq('id', id).single()
        )
    },

    async deleteTender(id: string) {
        return handleRequest(
            supabase.from('tenders').delete().eq('id', id)
        )
    },

    async checkSubscriptionLimit() {
        // 1. Check User Subscription Status
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { allowed: false, reason: "Not authenticated" }

        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan_name, status')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single()

        const plan = sub?.plan_name?.toLowerCase() || 'free' // 'free', 'standard', 'enterprise'

        // ENTERPRISE: Unlimited
        if (plan.includes('enterprise') || plan.includes('pro')) return { allowed: true }

        // STANDARD: 20 Tenders
        // FREE: STRICTLY 1 Tender (Proof of Concept)
        const limit = plan.includes('standard') ? 20 : 1

        // 2. Count Tenders this Month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count, error } = await supabase
            .from('tenders')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString())
            .neq('status', 'ARCHIVED') // Only count active tenders against limit

        if (error) throw error

        if ((count || 0) >= limit) {
            const upgradeName = plan.includes('free') ? 'Standard' : 'Enterprise'
            return {
                allowed: false,
                reason: `You have reached your ${plan} plan limit (${limit} active tender${limit > 1 ? 's' : ''}). Upgrade to ${upgradeName} for more.`
            }
        }

        return { allowed: true }
    },

    async upload(file: File) {
        // Placeholder for storage upload logic
        const fileName = `${Date.now()}-${file.name}`
        return handleRequest(
            supabase.storage.from('tenders').upload(fileName, file)
        )
    },

    async getStats() {
        // Get count of active tenders (not archived)
        const { count, error } = await supabase
            .from('tenders')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'ARCHIVED')

        return { count: count || 0, error }
    },

    async getReadinessStats() {
        // Average readiness score of active tenders
        const { data, error } = await supabase
            .from('tenders')
            .select('compliance_score')
            .neq('status', 'ARCHIVED')

        if (error || !data || data.length === 0) return { avg: 0, error }

        const total = data.reduce((acc, curr) => acc + (curr.compliance_score || 0), 0)
        return { avg: Math.round(total / data.length), error: null }
    },

    async getRecent() {
        return handleRequest<Tender[]>(
            supabase.from('tenders')
                .select('*')
                .neq('status', 'ARCHIVED')
                .order('updated_at', { ascending: false })
                .limit(5)
        )
    },

    async createManualTender(data: ManualTenderData) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: "User not authenticated", status: 401 }

        // 1. Create Tender
        const { data: tender, error: tenderError } = await supabase
            .from('tenders')
            .insert({
                user_id: user.id,
                title: data.title,
                client_name: data.client_name,
                closing_date: data.closing_date,
                status: 'ANALYZING', // Will trigger readiness check (simulated) or just set to draft
                compliance_score: 0,
                readiness: 'RED'
            })
            .select()
            .single()

        if (tenderError || !tender) return { data: null, error: tenderError?.message, status: 500 }

        // 2. Create Requirements
        const requirements = []

        // CIDB Requirement
        if (data.requirements.cidb_grade && data.requirements.cidb_class) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'CIDB',
                description: `Minimum CIDB Grading of ${data.requirements.cidb_grade}${data.requirements.cidb_class}`,
                target_value: { grade: data.requirements.cidb_grade, class: data.requirements.cidb_class },
                is_killer: true
            })
        }

        // BBBEE Requirement
        if (data.requirements.min_bbbee_level) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'BBBEE',
                description: `Minimum B-BBEE Level ${data.requirements.min_bbbee_level}`,
                target_value: { min_level: parseInt(data.requirements.min_bbbee_level) },
                is_killer: false // Often preferencing, not always killer
            })
        }

        // Mandatory Docs (Simulated generic requirement for now)
        if (data.requirements.mandatory_docs) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'MANDATORY_DOC',
                description: `Standard Administrative Compliance`,
                target_value: { docs: ['cipc_cert', 'sars_pin', 'csd_summary', 'coid_letter', 'uif_reg', 'bank_letter'] },
                is_killer: true
            })
        }

        if (requirements.length > 0) {
            const { error: reqError } = await supabase
                .from('compliance_requirements')
                .insert(requirements)

            if (reqError) {
                // Return error but don't crash, trying to save partial data
                return { data: tender, error: "Tender created but requirement save failed: " + reqError.message, status: 206 }
            }
        }

        // 3. Trigger Analysis (or just update status to READY if we want to skip sim)
        await supabase.from('tenders').update({ status: 'DRAFT', compliance_score: 50, readiness: 'AMBER' }).eq('id', tender.id)

        return { data: tender, error: null, status: 201 }
    }
}

/**
 * Company Service
 */
export const CompanyService = {
    async getProfile() {
        return handleRequest(
            supabase.from('profiles').select('*').single()
        )
    },

    async getCompliance() {
        return handleRequest(
            supabase.from('view_compliance_summary').select('*')
        )
    },

    async getComplianceStats() {
        const { data, error } = await supabase.from('view_compliance_summary').select('computed_status')

        if (error || !data) return { score: 0, expiring: 0, error }

        const total = data.length
        if (total === 0) return { score: 0, expiring: 0, error: null }

        const validCount = data.filter(d => d.computed_status === 'valid').length
        const expiringCount = data.filter(d => d.computed_status === 'warning' || d.computed_status === 'expired').length

        // Total required documents (Hardcoded to 9 based on user feedback)
        const TOTAL_REQUIRED_DOCS = 9;

        // Cap status at 100%
        const score = Math.min(Math.round((validCount / TOTAL_REQUIRED_DOCS) * 100), 100)

        return { score, expiring: expiringCount, error: null }
    },

    async analyzeDocument(filePath: string, docType: string, validationRules: Record<string, unknown> = {}) {
        try {
            const { data, error } = await supabase.functions.invoke('analyze-document', {
                body: { file_path: filePath, doc_type: docType, validationRules }
            })

            if (error) throw error
            return { data, error: null, status: 200 }
        } catch (err: any) {
            // Fallback for when Edge Function server is not running (e.g. no Docker)
            // This unblocks the user to continue using the UI manually.
            return handleRequest(Promise.resolve({
                data: {
                    error: null,
                    code: "GENERAL",
                    title: "Document (Manual Entry)",
                    category: "General",
                    description: "AI Analysis unavailable. Please fill in details."
                }
            }))
        }
    },

    async uploadComplianceDoc(file: File, category: string, docType: string, metadata: Record<string, unknown> = {}) {
        // 0. Get User
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: "User not authenticated", status: 401 }

        const fileName = `${category}/${docType}/${Date.now()}_${file.name}`

        // 1. Upload File
        const { error: uploadError } = await supabase.storage
            .from('compliance')
            .upload(fileName, file)

        if (uploadError) return { data: null, error: uploadError.message, status: 500 }

        // 2 Create/Update Record
        let referenceNumber = null;
        if (metadata.registration_number) referenceNumber = metadata.registration_number;
        if (metadata.crs_number) referenceNumber = metadata.crs_number;
        if (metadata.tax_ref) referenceNumber = metadata.tax_ref;
        if (metadata.maaa_number) referenceNumber = metadata.maaa_number;
        if (metadata.vat_number) referenceNumber = metadata.vat_number;
        if (metadata.uif_number) referenceNumber = metadata.uif_number;
        if (metadata.coid_ref) referenceNumber = metadata.coid_ref;

        return handleRequest(
            supabase.from('compliance_documents').insert({
                user_id: user.id,
                category,
                doc_type: docType,
                title: file.name, // Fallback title
                file_name: file.name,
                file_url: fileName,
                status: 'valid', // Default to valid, backend trigger handles expiry later
                expiry_date: metadata.expiryDate || null,
                reference_number: referenceNumber,
                metadata: metadata,
                issue_date: new Date().toISOString()
            })
        )
    },

    async deleteComplianceDoc(id: string) {
        // 1. Fetch doc to get file_url
        const { data: doc, error: fetchError } = await supabase
            .from('compliance_documents')
            .select('file_url')
            .eq('id', id)
            .single()

        if (fetchError) return { data: null, error: fetchError.message, status: 500 }

        // 2. Delete file from storage
        if (doc && doc.file_url) {
            const { error: storageError } = await supabase.storage
                .from('compliance')
                .remove([doc.file_url])

            if (storageError) console.error("Failed to delete file from storage:", storageError)
            // Continue to delete record even if storage fails
        }

        // 3. Delete Record
        return handleRequest(
            supabase.from('compliance_documents').delete().eq('id', id)
        )
    },

    // --- Alerts ---
    async getAlerts() {
        try {
            // Trigger generation in background to avoid blocking UI
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // We use a standalone helper to avoid 'this' context issues
                // Fire and forget - don't await
                generateAlertsClientSide(user.id).catch(console.error)
            }

            return handleRequest(
                supabase.from('alerts')
                    .select('*')
                    .eq('user_id', user?.id)
                    .order('created_at', { ascending: false })
            )
        } catch (e) {
            console.error("Alert generation failed", e)
            // Even if generation fails, try to return existing alerts
            return handleRequest(
                supabase.from('alerts').select('*').order('created_at', { ascending: false })
            )
        }
    },

    async markAlertRead(id: string) {
        return handleRequest(
            supabase.from('alerts').update({ is_read: true }).eq('id', id)
        )
    },

    async markAllAlertsRead() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: 'No user', status: 401 }

        return handleRequest(
            supabase.from('alerts').update({ is_read: true }).eq('user_id', user.id)
        )
    }
}

// Standalone Helper: Generate alerts client-side since migration might not be run
async function generateAlertsClientSide(userId: string) {
    try {
        const today = new Date()
        const next30Days = new Date(); next30Days.setDate(today.getDate() + 30)
        const next7Days = new Date(); next7Days.setDate(today.getDate() + 7)

        // 1. Check Compliance Docs
        const { data: docs } = await supabase.from('compliance_documents')
            .select('id, title, expiry_date, category')
            .eq('user_id', userId)

        if (docs) {
            for (const doc of docs) {
                if (!doc.expiry_date) continue
                const exp = new Date(doc.expiry_date)

                // A. Expiring Soon (0 < days < 30)
                if (exp > today && exp <= next30Days) {
                    const msg = `Document Expiring Soon: ${doc.title} (${doc.category}) expires on ${doc.expiry_date.split('T')[0]}`
                    await _ensureAlert(userId, 'HIGH', msg)
                }

                // B. Expired
                if (exp < today) {
                    const msg = `EXPIRED: ${doc.title} has expired! Please renew immediately.`
                    await _ensureAlert(userId, 'HIGH', msg) // Ensure unique
                }
            }
        }

        // 2. Check Tenders
        const { data: tenders } = await supabase.from('tenders')
            .select('id, title, closing_date, status')
            .eq('user_id', userId)
            .in('status', ['DRAFT', 'ANALYZING', 'COMPLIANT'])
            .gte('closing_date', today.toISOString())
            .lte('closing_date', next7Days.toISOString())

        if (tenders) {
            for (const tender of tenders) {
                const msg = `Tender Closing Soon: ${tender.title} closes on ${tender.closing_date.split('T')[0]}`
                await _ensureAlert(userId, 'HIGH', msg)
            }
        }
    } catch (err) {
        console.error("Error generating alerts:", err)
    }
}

async function _ensureAlert(userId: string, priority: string, message: string) {
    // Simple deduplication: Check if unread alert with same message exists, or created recently?
    // Let's check if such an alert exists created in last 7 days.
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(new Date().getDate() - 7)

    const { count } = await supabase.from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('message', message)
        .gte('created_at', sevenDaysAgo.toISOString())

    if (!count || count === 0) {
        await supabase.from('alerts').insert({
            user_id: userId,
            priority,
            message,
            is_read: false
        })
    }
}

export const TemplateService = {
    async getAll(showArchived = false) {
        let query = supabase.from('templates').select('*').order('code', { ascending: true })
        if (!showArchived) {
            query = query.eq('is_active', true)
        }
        return handleRequest<Template[]>(query)
    },

    async download(template: Template) {
        // Increment download count using secure RPC in background (non-blocking)
        supabase.rpc('increment_template_download', { template_id: template.id }).then(({ error }) => {
            if (error) console.error("Failed to increment download count", error)
        })

        // Check if there is a public URL or if we need to sign it
        // Since bucket is public in our setup:
        const { data } = supabase.storage.from('templates').getPublicUrl(template.file_url)
        return data.publicUrl
    }
}

export const AdminService = {
    async getStats() {
        return handleRequest(
            supabase.rpc('get_admin_stats')
        )
    },

    async broadcast(title: string, message: string, priority: 'INFO' | 'WARNING' | 'CRITICAL') {
        const { data: { user } } = await supabase.auth.getUser()
        return handleRequest(
            supabase.from('system_messages').insert({
                title,
                message,
                priority,
                created_by: user?.id
            })
        )
    },

    async getBroadcasts() {
        return handleRequest(
            supabase.from('system_messages').select('*').order('created_at', { ascending: false })
        )
    },

    async deleteBroadcast(id: string) {
        return handleRequest(
            supabase.from('system_messages').delete().eq('id', id)
        )
    },

    async getUsers() {
        return handleRequest<any[]>(
            supabase.rpc('get_admin_users')
        )
    },

    async getAnalytics() {
        return handleRequest(
            supabase.rpc('get_admin_analytics')
        )
    },

    async getUserGrowth(period: 'daily' | 'weekly' | 'monthly') {
        return handleRequest(
            supabase.rpc('get_user_growth', { period })
        )
    },

    async uploadTemplate(file: File, title: string, code: string, category: string, description: string) {
        // 1. Upload PDF
        const fileName = `public/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
            .from('templates')
            .upload(fileName, file)

        if (uploadError) return { data: null, error: uploadError.message, status: 500 }

        // 2. Insert Record
        return handleRequest(
            supabase.from('templates').insert({
                title,
                code,
                category,
                description,
                file_url: fileName,
                is_active: true
            })
        )
    },

    async updateTemplate(id: string, updates: any) {
        return handleRequest(
            supabase.from('templates').update(updates).eq('id', id)
        )
    },

    async archiveTemplate(id: string) {
        return handleRequest(
            supabase.from('templates').update({
                is_active: false,
                archive_date: new Date().toISOString()
            }).eq('id', id)
        )
    },

    async deleteTemplate(id: string, fileUrl: string) {
        // 1. Delete File
        await supabase.storage.from('templates').remove([fileUrl])

        // 2. Delete Record
        return handleRequest(
            supabase.from('templates').delete().eq('id', id)
        )
    },

    /**
     * Revenue & Subscriptions Analytics
     */
    async getRevenueData(period: "7D" | "30D" | "90D" | "1Y") {
        // 1. Try to fetch real history
        const endDate = new Date()
        const startDate = new Date()
        if (period === "7D") startDate.setDate(endDate.getDate() - 7)
        if (period === "30D") startDate.setDate(endDate.getDate() - 30)
        if (period === "90D") startDate.setDate(endDate.getDate() - 90)
        if (period === "1Y") startDate.setFullYear(endDate.getFullYear() - 1)

        const { data: realHistory, error } = await supabase
            .from('subscription_history')
            .select('*, profile:profiles(company_name)') // Joining public.profiles is safe
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false })
        // If we have real data (migration applied), use it.
        if (!error && realHistory && realHistory.length > 0) {

            // Fetch users to map Emails
            // Fetch users to map Emails
            const userMap = await _getAdminUserMap()

            // Aggregate for Graph
            const graphMap = new Map()
            let totalRevenue = 0

            // Fill empty days? Ideally yes. For now, just aggregate points.
            realHistory.forEach(tx => {
                const dateKey = tx.created_at ? tx.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
                graphMap.set(dateKey, (graphMap.get(dateKey) || 0) + Number(tx.amount || 0))
                totalRevenue += Number(tx.amount || 0)
            })

            const graphData = Array.from(graphMap.entries())
                .map(([date, amount]) => ({ date, amount }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

            const transactions = realHistory.map((tx: any) => {
                const mappedUser = userMap.get(tx.user_id)
                return {
                    date: tx.created_at,
                    user_email: mappedUser?.email || tx.user?.email || "Unknown Email",
                    company_name: mappedUser?.company_name || tx.profile?.company_name || "Unknown Company",
                    plan: tx.plan_name,
                    amount: Number(tx.amount || 0),
                    status: tx.status
                }
            })

            return { data: { totalRevenue, graphData, transactions }, error: null, status: 200 }
        }

        // Return empty if no data found (No Mocking)
        return {
            data: {
                totalRevenue: 0,
                graphData: [],
                transactions: []
            },
            error: null,
            status: 200
        }
    },

    /**
     * User Details & History
     */
    async getUserDetails(userId: string) {
        // 1. Profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()

        // 2. Docs
        const { data: docs } = await supabase.from('compliance_documents').select('*').eq('user_id', userId)

        // 3. Tenders Stats
        const { count: tenderCount } = await supabase.from('tenders').select('*', { count: 'exact', head: true }).eq('user_id', userId)

        // 4. Sub History (Real)
        const { data: history } = await supabase
            .from('subscription_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        return {
            data: {
                profile,
                docs: docs || [],
                tenderCount: tenderCount || 0,
                history: history || []
            },
            error: null,
            status: 200
        }
    },

    /**
     * Monthly Statements
     */
    async getAvailableMonths() {
        // We can't do distinct efficiently on client without RPC, but for low volume:
        const { data, error } = await supabase
            .from('subscription_history')
            .select('created_at')
            .order('created_at', { ascending: false })

        if (error) return { data: [], error: error.message }
        if (!data) return { data: [], error: null }

        // Extract unique Year-Month
        const months = new Set()
        data.forEach(item => {
            const d = new Date(item.created_at)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
            months.add(key)
        })

        return { data: Array.from(months), error: null }
    },

    async getMonthlyStatement(year: number, month: number) {
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59) // Last day of month

        const { data: realHistory, error } = await supabase
            .from('subscription_history')
            .select('*, profile:profiles(company_name), user:user_id(email)')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false })

        if (error) return { data: null, error: error.message }

        // Fetch emails via helper if join failed or for robustness
        const userMap = await _getAdminUserMap()

        const transactions = (realHistory || []).map((tx: any) => ({
            date: tx.created_at,
            user_email: userMap.get(tx.user_id) || tx.user?.email || "Unknown",
            company_name: tx.profile?.company_name || "Unknown Company",
            plan: tx.plan_name,
            amount: Number(tx.amount || 0),
            status: tx.status
        }))

        const total = transactions.reduce((acc: number, cur: any) => acc + cur.amount, 0)

        return {
            data: {
                year,
                month,
                transactions,
                totalRevenue: total,
                count: transactions.length
            },
            error: null
        }
    }
}

// Helper: Fetch Map of User ID -> Email
async function _getAdminUserMap() {
    const userMap = new Map<string, any>()
    try {
        const { data: users } = await supabase.rpc('get_admin_users')
        if (users) {
            users.forEach((u: any) => userMap.set(u.id, {
                email: u.email,
                company_name: u.company_name
            }))
        }
    } catch (e) {
        console.warn("Could not fetch admin users for email mapping", e)
    }
    return userMap
}

/**
 * Legal Service
 */
export const LegalService = {
    async hasAccepted(version: string) {
        // Check if a record exists for this user + version
        const { data, error } = await supabase
            .from('legal_consents')
            .select('id')
            .eq('version', version)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            return { accepted: false, error: error.message, status: status || 500 }
        }

        return { accepted: !!data, error: null, status: status || 200 }
    },

    async acceptTerms(version: string) {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: "User not authenticated", status: 401 }

        // 2. Insert with explicit user_id
        const { error } = await supabase.from('legal_consents').insert({
            version,
            user_id: user.id
        })

        // 3. Handle Duplicate (Already Accepted) -> Treat as success
        if (error) {
            // Postgres code 23505 = unique_violation
            if (error.code === '23505') {
                return { data: true, error: null, status: 200 }
            }
            return { data: null, error: error.message, status: 500 }
        }

        return { data: true, error: null, status: 200 }
    }
}

/**
 * Feedback Service
 */
export const FeedbackService = {
    async submit(tenderId: string, rating: number, message: string) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: "User not authenticated", status: 401 }

        // 1. Insert Feedback
        const { error } = await supabase.from('user_feedback').insert({
            user_id: user.id,
            tender_id: tenderId,
            rating,
            message
        })

        if (error) return { data: null, error: error.message, status: 500 }

        // 2. Mark Tender as Rated
        await supabase.from('tenders').update({ has_rated: true }).eq('id', tenderId)

        return { data: true, error: null, status: 201 }
    },

    async getStats() {
        return handleRequest(
            supabase.rpc('get_admin_feedback_stats')
        )
    },

    async getHistory() {
        return handleRequest(
            supabase.rpc('get_admin_feedback_history')
        )
    },

    async getTotalUsers() {
        return handleRequest(
            supabase.rpc('get_total_users_count')
        )
    }
}

/**
 * Error Logging Service
 */
export const ErrorService = {
    async logError(error: Error | string, page: string, severity: 'critical' | 'warning' | 'info' = 'critical') {
        const { data: { user } } = await supabase.auth.getUser()

        let description = ''
        let stack = ''

        if (error instanceof Error) {
            description = error.message
            stack = error.stack || ''
        } else {
            description = String(error)
        }

        const { error: dbError } = await supabase.from('error_logs').insert({
            user_id: user?.id || null, // Can be null if generic error
            page,
            description,
            stack_trace: stack,
            severity
        })

        if (dbError) console.error("Failed to log error to DB:", dbError)
    },

    async getAll() {
        return handleRequest(
            supabase.rpc('get_admin_errors')
        )
    },

    async getStats() {
        return handleRequest(
            supabase.rpc('get_error_stats')
        )
    },

    async deleteError(id: string) {
        return handleRequest(
            supabase.from('error_logs').delete().eq('id', id)
        )
    },

    async clearAll() {
        // Only deletes errors older than 7 days strictly, or all? 
        // For now, let's allow deleting ALL for cleanup.
        return handleRequest(
            supabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
        )
    }
}
