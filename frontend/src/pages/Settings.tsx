import { useMemo, useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { User, Bell, CreditCard, Loader2, Save } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function Settings() {
    // const { session } = useAuth() // Unused
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    // Get initial tab from URL or default to 'profile'
    const currentTab = searchParams.get('tab') || 'profile'

    // Function to update URL and state
    const setActiveTab = (tab: string) => {
        setSearchParams({ tab })
    }

    const tabs = useMemo(() => ({
        profile: {
            icon: User,
            label: "Profile",
            description: "Update your personal information and preferences."
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
        }
    }), [])

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

            <div className="flex flex-col lg:flex-row gap-8">
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
                                    }`}
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
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

function BillingSettings({ navigate }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription & Billing</h2>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">Current Plan: Free</h3>
                        <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase">Basic</span>
                    </div>
                    <p className="text-sm text-gray-500">You are on the limited starter plan.</p>
                </div>
                <button
                    onClick={() => navigate('/pricing')}
                    className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-sm"
                >
                    Upgrade to Unlimited
                </button>
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
    const { session } = useAuth()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        location: ''
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
            .select('full_name, phone, address, location')
            .eq('id', session?.user.id)
            .single()

        if (data) {
            setFormData({
                full_name: data.full_name || '',
                email: session?.user.email || '',
                phone: data.phone || '',
                address: data.address || '',
                location: data.location || ''
            })
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: formData.full_name,
                phone: formData.phone,
                address: formData.address,
                location: formData.location
            })
            .eq('id', session?.user.id)

        if (error) {
            setMessage("Error updating profile")
        } else {
            setMessage("Profile updated successfully")
        }
        setSaving(false)
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                <p className="text-sm text-gray-500">Manage your public profile details.</p>
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

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Physical Address</label>
                    <textarea
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="123 Main Street..."
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
                        <span className={`text-sm font-medium ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                            {message}
                        </span>
                    )}
                </div>
            </form>
        </div>
    )
}

function NotificationSettings() {
    const { session } = useAuth()
    const [loading, setLoading] = useState(false)
    const [prefs, setPrefs] = useState({
        notify_email_tier_support: false,
        notify_whatsapp_tier_reminders: false,
        notify_email_critical_errors: false,
        whatsapp_number: ''
    })

    useEffect(() => {
        if (session?.user) loadPrefs()
    }, [session])

    const loadPrefs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('profiles')
            .select('notify_email_tier_support, notify_whatsapp_tier_reminders, notify_email_critical_errors, whatsapp_number')
            .eq('id', session?.user.id)
            .single()

        if (data) {
            setPrefs({
                notify_email_tier_support: data.notify_email_tier_support || false,
                notify_whatsapp_tier_reminders: data.notify_whatsapp_tier_reminders || false,
                notify_email_critical_errors: data.notify_email_critical_errors || false,
                whatsapp_number: data.whatsapp_number || ''
            })
        }
        setLoading(false)
    }

    const toggle = (key: keyof typeof prefs) => {
        const newVal = !prefs[key]
        setPrefs(p => ({ ...p, [key]: newVal }))
        supabase.from('profiles').update({ [key]: newVal }).eq('id', session?.user.id).then()
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-500">Manage how you receive critical alerts.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {/* Tier 2 & 3 Support */}
                <div className="p-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-gray-900">Tier 2 & 3 Assistance</h3>
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Email</span>
                        </div>
                        <p className="text-sm text-gray-500 max-w-md">
                            Receive an email immediately when a Tier 2 or Tier 3 customer requests support or flags an issue.
                        </p>
                    </div>
                    <button
                        onClick={() => toggle('notify_email_tier_support')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_email_tier_support ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_email_tier_support ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Tier 3 Reminders */}
                <div className="p-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-gray-900">Tier 3 Reminders</h3>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">WhatsApp</span>
                        </div>
                        <p className="text-sm text-gray-500 max-w-md">
                            Get WhatsApp/SMS notifications for all high-priority compliance reminders for Tier 3 holders.
                        </p>
                    </div>
                    <button
                        onClick={() => toggle('notify_whatsapp_tier_reminders')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notify_whatsapp_tier_reminders ? 'bg-green-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${prefs.notify_whatsapp_tier_reminders ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Critical System Errors */}
                <div className="p-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-gray-900">Critical System Errors</h3>
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Email - Critical</span>
                        </div>
                        <p className="text-sm text-gray-500 max-w-md">
                            Receive an immediate alert when a red (critical) system error occurs.
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

            {/* WhatsApp Bot Integration */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-lg border border-green-100 shadow-sm">
                        <svg viewBox="0 0 24 24" className="w-8 h-8 text-green-600 fill-current">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">WhatsApp Bot Integration</h3>
                        <p className="text-sm text-green-800 mt-1">
                            Configure the automated assistant for Tier 3 clients. The bot can handle common queries and document submission reminders.
                        </p>

                        <div className="mt-4 flex gap-3">
                            <input
                                type="text"
                                placeholder="Bot WhatsApp Number (e.g., +27...)"
                                value={prefs.whatsapp_number}
                                onChange={(e) => {
                                    setPrefs({ ...prefs, whatsapp_number: e.target.value })
                                    // Save on blur or add save button? Let's just update state to show interactivity.
                                }}
                                onBlur={() => supabase.from('profiles').update({ whatsapp_number: prefs.whatsapp_number }).eq('id', session?.user.id).then()}
                                className="flex-1 rounded-lg border-green-300 focus:ring-green-500 focus:border-green-500 text-sm"
                            />
                            <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm">
                                Configure Bot
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
