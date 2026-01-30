import { useMemo, useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import {
    User, Bell, CreditCard, Loader2, Save, Shield,
    Gift,
    CheckCircle,
    FileText,
    X,
    AlertTriangle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

export default function Settings() {
    const { isAdmin } = useAuth()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    // Get initial tab from URL
    const currentTab = searchParams.get('tab') || 'profile'

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab })
    }

    // Redirect admins away from profile/billing if they land there
    const isOnboarding = searchParams.get('onboarding') === 'true'

    useEffect(() => {
        if (isOnboarding) {
            setActiveTab('profile')
        }
        // Admin Redirect: If they land on 'profile' or 'billing', bump them to notifications
        // Note: currentTab defaults to 'profile' now, so we catch that default case here too.
        if (isAdmin && (currentTab === 'profile' || currentTab === 'billing')) {
            setSearchParams({ tab: 'notifications' })
        }
    }, [isAdmin, currentTab, isOnboarding])

    const tabs = useMemo(() => {
        const allTabs = {
            profile: {
                icon: User,
                label: "Profile",
                description: "Update your personal and company information."
            },
            billing: {
                icon: CreditCard,
                label: "Billing & Plans",
                description: "Manage your subscription and payment methods."
            },
            notifications: {
                icon: Bell,
                label: "Notifications",
                description: "Control how and when you receive alerts."
            },
            security: {
                icon: Shield,
                label: "Security & Billing Policies",
                description: "Understand how we protect your data and billing terms."
            }
        }

        if (isAdmin) {
            // Remove Profile and Billing for admins
            const { profile, billing, ...adminTabs } = allTabs
            return adminTabs
        }

        return allTabs
    }, [isAdmin])

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Settings</h1>

            <div className="flex flex-col lg:flex-row gap-8">
                {isOnboarding && (
                    <div className="lg:col-span-2 bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r shadow-sm w-full">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-bold text-yellow-800">Profile Completion Required</h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>
                                        To ensure you get the most out of the platform (and so we can generate accurate documents for you), please complete your
                                        <b> Company Name</b> and <b>Registration Number</b> before continuing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sidebar Navigation */}
                <div className="lg:w-1/4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-fit">
                    <nav className="space-y-2">
                        {(Object.entries(tabs) as [string, any][]).map(([key, { icon: Icon, label, description }]) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center w-full p-3 rounded-lg text-left transition-colors duration-200
                                    ${currentTab === key
                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    } `}
                            >
                                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                                <div>
                                    <p className="text-sm">{label}</p>
                                    <p className="text-xs text-gray-500 hidden xl:block">{description}</p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Main Content Area */}
                <div className="lg:w-3/4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm min-h-[400px]"
                        >
                            {currentTab === 'profile' && <ProfileSettings />}
                            {currentTab === 'billing' && <BillingSettings navigate={navigate} />}
                            {currentTab === 'notifications' && <NotificationSettings />}
                            {currentTab === 'security' && <SecuritySettings />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>


        </div>
    )
}

function BillingSettings({ navigate }: any) {
    const { tier } = useAuth()

    const planDetails = {
        'Free': { label: 'Basic', desc: 'You are on the limited starter plan.', badge: 'gray' },
        'Standard': { label: 'Professional', desc: 'You are on the Standard plan (25 Tenders/mo).', badge: 'blue' },
        'Pro': { label: 'Enterprise', desc: 'You are on the Unlimited Pro plan.', badge: 'purple' }
    }
    const [loading, setLoading] = useState(false)
    const [subscription, setSubscription] = useState<any>(null)

    useEffect(() => {
        loadSubscription()
    }, [tier])

    const loadSubscription = async () => {
        const { data } = await supabase.from('subscriptions').select('*').eq('user_id', (await supabase.auth.getUser()).data.user?.id).eq('status', 'active').maybeSingle()
        if (data) setSubscription(data)
    }

    const toggleAutoRenew = async () => {
        setLoading(true)

        // If currently cancelling (true), we want to RESUME (false).
        // If currently active (false), we want to CANCEL (true).
        // Logic: currently true (off) -> toggle to false (on).
        // Wait, toggling "Auto Renew" implies:
        // Switch IS ON -> cancel_at_period_end = false.
        // Switch IS OFF -> cancel_at_period_end = true.
        // So if we click, we flip the boolean.

        const targetCancelState = !subscription?.cancel_at_period_end // Flip it

        const { error } = await supabase.from('subscriptions')
            .update({
                cancel_at_period_end: targetCancelState
            })
            .eq('id', subscription?.id)

        if (error) {
            toast.error("Failed to update subscription")
        } else {
            const status = targetCancelState ? "OFF" : "ON"
            toast.success(`Auto-renew turned ${status}`)
            loadSubscription()
        }
        setLoading(false)
    }

    const current = planDetails[tier as keyof typeof planDetails] || planDetails['Free']
    const isAutoRenewOn = !subscription?.cancel_at_period_end

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription & Billing</h2>
            </div>

            <div className={`bg-${current.badge}-50 border border-${current.badge}-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">Current Plan: {tier}</h3>
                        <span className={`bg-${current.badge}-200 text-${current.badge}-800 text-xs px-2 py-1 rounded font-bold uppercase`}>
                            {current.label}
                        </span>
                    </div>
                    <p className={`text-sm text-${current.badge}-700`}>{current.desc}</p>
                </div>
                {tier !== 'Pro' ? (
                    <button
                        onClick={() => navigate('/pricing')}
                        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Upgrade Plan
                    </button>
                ) : (
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${isAutoRenewOn ? 'text-green-600' : 'text-gray-500'}`}>
                                Auto-renew {isAutoRenewOn ? 'ON' : 'OFF'}
                            </span>
                            <button
                                onClick={toggleAutoRenew}
                                disabled={loading}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAutoRenewOn ? 'bg-green-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isAutoRenewOn ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            {isAutoRenewOn
                                ? `Renews on ${new Date(subscription?.current_period_end || Date.now()).toLocaleDateString()}`
                                : `Expires on ${new Date(subscription?.current_period_end || Date.now()).toLocaleDateString()}`
                            }
                        </p>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="text-xs text-blue-600 font-bold hover:underline mt-1"
                        >
                            Change Plan
                        </button>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Payment Methods</h3>
                <div className="border border-gray-200 rounded-xl p-8 text-center bg-white border-dashed">
                    <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No payment methods added.</p>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Billing History</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">Date</th>
                                <th className="px-6 py-3 font-medium">Description</th>
                                <th className="px-6 py-3 font-medium">Amount</th>
                                <th className="px-6 py-3 font-medium text-right">Invoice</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                                    No transaction history
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function ProfileSettings() {
    const { session, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        location: '',
        company_name: '',
        registration_number: '',
        tax_reference_number: ''
    })
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (session?.user) {
            loadProfile()
        }
    }, [session])

    const loadProfile = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('profiles')
            .select('full_name, phone, address, location, company_name, registration_number, tax_reference_number')
            .eq('id', session?.user.id)
            .single()

        if (data) {
            setFormData({
                full_name: data.full_name || '',
                email: session?.user.email || '',
                phone: data.phone || '',
                address: data.address || '',
                location: data.location || '',
                company_name: (data.company_name === 'New Company' ? '' : data.company_name) || '',
                registration_number: data.registration_number || '',
                tax_reference_number: data.tax_reference_number || ''
            })
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        // Validation Rules
        const taxRegex = /^\d{10}$/
        const regRegex = /^\d{4}\/\d{6}\/\d{2}$/
        const phoneRegex = /^(\+27|0)[6-8][0-9]{8}$/ // Basic SA Mobile or +27 International

        // 1. Tax Number Validation
        if (formData.tax_reference_number && !taxRegex.test(formData.tax_reference_number.replace(/\s/g, ''))) {
            setMessage("Error: Tax Reference Number must be exactly 10 digits.")
            setSaving(false)
            return
        }

        // 2. Registration Number Validation
        // Allow empty if they haven't filled it yet, but if filled, must be valid
        if (formData.registration_number && !regRegex.test(formData.registration_number.trim())) {
            setMessage("Error: Company Registration Number must be in format YYYY/NNNNNN/NN")
            setSaving(false)
            return
        }

        // 3. Phone Validation (Soft check)
        if (formData.phone && !phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
            setMessage("Error: Please enter a valid SA mobile number (e.g. 082 123 4567)")
            setSaving(false)
            return
        }

        // DUAL-SYNC: Update both public profile and internal Auth metadata
        const [profileResult, authResult] = await Promise.all([
            supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    phone: formData.phone,
                    address: formData.address,
                    location: formData.location,
                    company_name: formData.company_name,
                    registration_number: formData.registration_number,
                    tax_reference_number: formData.tax_reference_number
                })
                .eq('id', session?.user.id),

            supabase.auth.updateUser({
                data: {
                    full_name: formData.full_name,
                    company_name: formData.company_name
                }
            })
        ])

        const error = profileResult.error || authResult.error

        if (error) {
            setMessage("Error updating profile")
            toast.error("Failed to update profile")
        } else {
            setMessage("Profile updated successfully")
            // REFRESH APP CONTEXT
            await refreshProfile()
            toast.success("Profile saved and app updated!")
        }
        setSaving(false)
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Personal & Company Information</h2>
                <p className="text-sm text-gray-500">Manage your personal and business details.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full rounded-lg border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed shadow-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Phone Number</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            placeholder="+27 82 123 4567"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Location</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            placeholder="Cape Town, South Africa"
                        />
                    </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-gray-100">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Company Details</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Company Name</label>
                                <input
                                    type="text"
                                    value={formData.company_name}
                                    onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                                    className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                    placeholder="e.g. Apex Civil Engineering (Pty) Ltd"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Registration Number</label>
                                    <input
                                        type="text"
                                        value={formData.registration_number}
                                        onChange={e => setFormData({ ...formData, registration_number: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                        placeholder="e.g. 2023/123456/07"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Tax Reference Number</label>
                                    <input
                                        type="text"
                                        value={formData.tax_reference_number}
                                        onChange={e => setFormData({ ...formData, tax_reference_number: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                        placeholder="e.g. 9123456789 (10 digits)"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Physical Address</label>
                    <textarea
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="e.g. 123 Nelson Mandela Blvd, Cape Town, 8001"
                    />
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </button>
                    {message && (
                        <span className={`text - sm font - medium ${message.includes("Error") ? "text-red-600" : "text-green-600"} `}>
                            {message}
                        </span>
                    )}
                </div>
            </form>
        </div>
    )
}

function NotificationSettings() {
    const { session, isAdmin, tier } = useAuth()
    const [loading, setLoading] = useState(false)
    const [prefs, setPrefs] = useState({
        notify_email_tier_support: false, // Admin only
        notify_whatsapp_tier_reminders: false, // Pro only (Mobile Alerts)
        notify_email_critical_errors: false, // Admin only
        notify_tender_updates: true, // Standard+
        notify_compliance_expiry: true, // Standard+
        whatsapp_number: ''
    })

    useEffect(() => {
        if (session?.user) loadPrefs()
    }, [session])

    const loadPrefs = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('notify_email_tier_support, notify_whatsapp_tier_reminders, notify_email_critical_errors, notify_tender_updates, notify_compliance_expiry, whatsapp_number')
            .eq('id', session?.user.id)
            .single()

        if (data) {
            setPrefs({
                notify_email_tier_support: data.notify_email_tier_support || false,
                notify_whatsapp_tier_reminders: data.notify_whatsapp_tier_reminders || false,
                notify_email_critical_errors: data.notify_email_critical_errors || false,
                notify_tender_updates: data.notify_tender_updates ?? true,
                notify_compliance_expiry: data.notify_compliance_expiry ?? true,
                whatsapp_number: data.whatsapp_number || ''
            })
        } else if (error) {
            // clear error
        }
        setLoading(false)
    }

    const toggle = async (key: keyof typeof prefs) => {
        // Optimistic Update
        const oldVal = prefs[key]
        const newVal = !oldVal

        setPrefs(p => ({ ...p, [key]: newVal }))

        const { error } = await supabase.from('profiles').update({ [key]: newVal }).eq('id', session?.user.id)

        if (error) {
            toast.error(`Error: ${error.message || error.details || 'Unknown'}`)
            // Revert
            setPrefs(p => ({ ...p, [key]: oldVal }))
        } else {
            toast.success("Setting saved")
        }
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

    // Logic:
    // Tier 1 (Free): See all, but ALL external (Email/Mobile) are GREYED out.
    // Tier 2 (Standard): Email enabled. Mobile GREYED out.
    // Tier 3 (Pro) OR Admin: All enabled.

    // If Admin, force Pro behavior regardless of actual subscription
    const isFree = tier === 'Free' && !isAdmin
    const isStandard = tier === 'Standard'
    const isPro = tier === 'Pro' || isAdmin

    // Helpers to disable controls
    const canUseEmail = isStandard || isPro // Tier 2+ (Admin included in isPro)


    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Notification Preferences</h2>
                <p className="text-sm text-gray-500">Manage how and when you receive alerts.</p>
                {isFree && (
                    <div className="mt-4 p-4 rounded-r-lg border-l-4 border-orange-500 bg-white shadow-sm flex items-start gap-3">
                        <Gift className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-gray-900">Upgrade to Enable Notifications</p>
                            <p className="text-xs text-gray-600 mt-1">
                                On the Free plan, you receive In-App alerts only. Upgrade to correct tiers to enable Email and Mobile notifications.
                            </p>
                            <button className="mt-2 text-xs font-bold text-orange-600 underline hover:text-orange-800">View Plans</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Email Notifications (Standard+) - HIDDEN for Admins */}
            {!isAdmin && (
                <div className={`bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 ${!canUseEmail ? 'grayscale opacity-70 cursor-not-allowed' : ''}`}>
                    <div className="p-6 flex items-start justify-between relative overflow-hidden">
                        {/* Overlay for disabled interaction on entire block if needed, but per-button disabling is better UI */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-bold text-gray-900">Tender Deadline Reminders</h3>
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Email</span>
                            </div>
                            <p className="text-sm text-gray-500 max-w-md">
                                Receive alerts 7, 3, and 1 days before the closing date of tenders you are working on.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {!canUseEmail && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">Standard</span>}
                            <button
                                disabled={!canUseEmail}
                                onClick={() => toggle('notify_tender_updates')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_tender_updates && canUseEmail ? 'bg-green-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_tender_updates && canUseEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-bold text-gray-900">Compliance Expiry</h3>
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Email</span>
                            </div>
                            <p className="text-sm text-gray-500 max-w-md">
                                Get alerted 90, 60, and 30 days before any compliance document expires.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {!canUseEmail && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">Standard</span>}
                            <button
                                disabled={!canUseEmail}
                                onClick={() => toggle('notify_compliance_expiry')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_compliance_expiry && canUseEmail ? 'bg-green-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_compliance_expiry && canUseEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pro Features removed as per request - Tier 2 & 3 now uniform */}


            {/* Admin Only Controls */}
            {isAdmin && (
                <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div>
                        <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Admin Controls
                        </h3>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100">
                        <div className="p-6 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-gray-900">Tier 2 & 3 Assistance Alerts</h3>
                                    <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Admin</span>
                                </div>
                                <p className="text-sm text-gray-500 max-w-md">
                                    Receive alerts when high-tier customers request manual assistance.
                                </p>
                            </div>
                            <button
                                onClick={() => toggle('notify_email_tier_support')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_email_tier_support ? 'bg-blue-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_email_tier_support ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className="p-6 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-gray-900">Critical System Errors</h3>
                                    <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Admin</span>
                                </div>
                                <p className="text-sm text-gray-500 max-w-md">
                                    Receive alerts for red-level system failures.
                                </p>
                            </div>
                            <button
                                onClick={() => toggle('notify_email_critical_errors')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_email_critical_errors ? 'bg-red-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_email_critical_errors ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SecuritySettings() {
    const [showTerms, setShowTerms] = useState(false)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Security & Billing Policies</h2>
                <p className="text-sm text-gray-500">Transparency on how we handle your data and subscriptions.</p>
            </div>

            {/* Terms Agreement Status - Green Box */}
            <div className="bg-green-50 rounded-xl border border-green-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-full border border-green-100 shadow-sm shrink-0">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-green-900">Terms Agreed & Signed</h3>
                        <p className="text-sm text-green-800">
                            You accepted the Terms and Conditions upon registration. Your agreement is recorded and active.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowTerms(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 text-green-700 font-bold rounded-lg hover:bg-green-100 transition-colors shadow-sm whitespace-nowrap"
                >
                    <FileText className="w-4 h-4" />
                    View Terms
                </button>
            </div>



            {/* Billing Protocol Usage Explanation (Visible) */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-full border border-blue-100 shadow-sm shrink-0 mt-1">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-lg font-bold text-blue-900">Billing Protocol & Subscription Mechanics</h3>
                            <p className="text-sm text-blue-800/80 mt-1">
                                How your subscription works, tailored for transparency.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-900">
                            <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                <span className="font-bold block mb-1">Monthly Auto-Renewal</span>
                                Service renews automatically on the same day each month (e.g. 25th to 25th).
                            </div>
                            <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                <span className="font-bold block mb-1">Cancel Anytime</span>
                                Turn off auto-renewal instantly. You retain full access (Pro/Standard) until your paid period ends.
                            </div>
                            <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                <span className="font-bold block mb-1">No "Feb 30th" Glitches</span>
                                Our system automatically adjusts billing dates for shorter months to the last valid day.
                            </div>
                            <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                <span className="font-bold block mb-1">Secure Processing</span>
                                Payments are processed by a secure gateway. We never store your raw credit card data.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                <div className="p-6">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        Compliance Document Immunity
                    </h3>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        Your Compliance Documents (e.g., Tax Clearance, CIPC, BBBEE) are stored in an <span className="font-semibold text-gray-900">encrypted, private vault</span>.
                        We enforce strict <span className="font-semibold text-gray-900">Row Level Security (RLS)</span> policies, meaning that not even our system administrators can view or download your sensitive compliance files. They are accessible strictly by you and the software processes that validate them.
                    </p>
                </div>

                <div className="p-6">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        Tender Specification Analysis
                    </h3>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        Tender documents you upload for analysis are treated differently. To improve our AI matching algorithms and market insights, we may securely retain and analyze the technical specifications of these tenders.
                        This helps us train our models to better reject invalid tenders and improve success prediction rates for all users.
                        <br /><br />
                        <span className="italic text-xs text-gray-500">Note: User-specific business data remains confidential. Only widespread public tender specifications are used for aggregate analysis.</span>
                    </p>
                </div>

                <div className="p-6 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">Platform Security Standards</h3>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600">
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Data Encryption at Rest (AES-256) and in Transit (TLS/SSL).
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Authenticated Sessions managed by Secure Tokens.
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Regular Automated Security Audits.
                        </li>
                    </ul>
                </div>
            </div>

            {/* Terms Modal */}
            <AnimatePresence>
                {showTerms && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowTerms(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900">Terms & Conditions</h3>
                                <button onClick={() => setShowTerms(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-4 text-sm text-gray-600 leading-relaxed font-serif">
                                <h4 className="font-bold text-gray-900">1. Acceptance of Terms</h4>
                                <p>By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement.</p>

                                <h4 className="font-bold text-gray-900">2. Privacy Policy</h4>
                                <p>We are committed to protecting your privacy. Authorized employees within the company on a need to know basis only use any information collected from individual customers. We constantly review our systems and data to ensure the best possible service to our customers.</p>

                                <h4 className="font-bold text-gray-900">3. Data Security</h4>
                                <p>We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information.</p>

                                <h4 className="font-bold text-gray-900">4. Service Usage</h4>
                                <p>This platform is intended for professional use in managing tender compliance and bid preparation. You agree not to misuse the services or help anyone else do so.</p>

                                <h4 className="font-bold text-gray-900">5. Limitation of Liability</h4>
                                <p>The company shall not be liable for any direct, indirect, incidental, special or consequential damages resulting from the use or inability to use any of its services or for the cost of procurement of substitute services.</p>

                                <h4 className="font-bold text-gray-900">6. Subscription Cancellation Policy</h4>
                                <p>
                                    You may cancel your subscription at any time via the Settings page.
                                    <br /><br />
                                    <strong>Access Retention:</strong> Upon cancellation, your premium access (including Pro/Standard features) will remain active until the end of your current billing period.
                                    <br />
                                    <em>Example: If you subscribe on Jan 1st and cancel on Jan 15th, you will retain full access until Feb 1st.</em>
                                    <br /><br />
                                    <strong>Billing Cycle:</strong> Plans renew on the monthly anniversary of your subscription date. If you cancel before this date, you will not be charged for the following month.
                                </p>

                                <h4 className="font-bold text-gray-900">7. Plan Specific Terms</h4>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong>Free Plan:</strong> Limited to 1 Tender Analysis per month. Includes basic compliance checks.</li>
                                    <li><strong>Standard Plan:</strong> Includes 25 Tender Analyses per month, Email notifications, and Advanced Compliance tools.</li>
                                    <li><strong>Enterprise (Pro) Plan:</strong> Unlimited Tender Analyses, Priority Support, and Instant Mobile Alerts via WhatsApp.</li>
                                </ul>

                                <br />
                                <p className="text-xs text-gray-400">Last updated: January 2026</p>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => setShowTerms(false)}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    )
}
