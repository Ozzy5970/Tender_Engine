import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/Skeleton"
import { AdminService, FeedbackService, ErrorService } from "@/services/api"
import { DollarSign, Star, ShieldAlert, Loader2, Send, Trash2, Users } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from "framer-motion"

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [analytics, setAnalytics] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [broadcastLoading, setBroadcastLoading] = useState(false)
    const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', priority: 'INFO' })
    const [broadcasts, setBroadcasts] = useState<any[]>([])

    // State for User Tracker
    const [recentUsers, setRecentUsers] = useState<any[]>([])

    useEffect(() => {
        loadAnalytics()
        loadBroadcasts()
        loadRecentUsers()
    }, [])

    // Growth Chart State
    const [growthPeriod, setGrowthPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
    const [growthDataState, setGrowthDataState] = useState<any[]>([])

    useEffect(() => {
        const loadGrowth = async () => {
            const { data } = await AdminService.getUserGrowth(growthPeriod)
            if (data) setGrowthDataState(data as any[])
        }
        loadGrowth()
    }, [growthPeriod])

    const loadAnalytics = async () => {
        const { data, error } = await AdminService.getAnalytics()
        const { data: feedbackStats } = await FeedbackService.getStats()
        const { data: errorStats } = await ErrorService.getStats()

        if (data) {
            const d = data as any
            setAnalytics({
                revenue: {
                    total: d.revenue,
                    trend: null,
                    trendDir: 'neutral'
                },
                users: {
                    total: d.total_users,
                    active: d.active_subscriptions,
                    trend: "+0%",
                    trendDir: "neutral"
                },
                user_growth: d.user_growth,
                feedback: feedbackStats,
                errors: errorStats,
                compliance: d.compliance_split
            })
        }
        else {
            console.error(error)
            setErrorMsg(typeof error === 'string' ? error : JSON.stringify(error))
        }
        setLoading(false)
    }

    const loadRecentUsers = async () => {
        const { data } = await AdminService.getUsers()
        if (data) {
            // Sort by last active (sign in) or created if null
            const sorted = data.sort((a: any, b: any) => {
                const dateA = new Date(a.last_sign_in_at || a.created_at).getTime()
                const dateB = new Date(b.last_sign_in_at || b.created_at).getTime()
                return dateB - dateA
            }).slice(0, 5) // Show top 5
            setRecentUsers(sorted)
        }
    }

    const loadBroadcasts = async () => {
        const { data } = await AdminService.getBroadcasts()
        if (data) setBroadcasts(data as any[])
    }

    const handleBroadcast = async () => {
        if (!broadcastForm.title || !broadcastForm.message) return alert("Please fill in title and message")
        if (!window.confirm("Are you sure you want to broadcast this message to ALL users?")) return

        setBroadcastLoading(true)
        const { error } = await AdminService.broadcast(broadcastForm.title, broadcastForm.message, broadcastForm.priority as any)

        if (error) {
            alert("Failed to send: " + error)
        } else {
            alert("Broadcast sent successfully!")
            setBroadcastForm({ title: '', message: '', priority: 'INFO' })
            loadBroadcasts()
        }
        setBroadcastLoading(false)
    }

    const handleDeleteBroadcast = async (id: string) => {
        if (!window.confirm("Delete this broadcast record?")) return
        const { error } = await AdminService.deleteBroadcast(id)
        if (error) alert("Failed: " + error)
        else loadBroadcasts()
    }

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
                {/* Header Skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
            </div>
        )
    }

    if (!analytics) return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600 mb-4">Are you an admin?</p>
            {errorMsg && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 inline-block text-left">
                    <p className="font-mono text-xs text-red-800 break-all">{errorMsg}</p>
                </div>
            )}
        </div>
    )



    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Overview</h1>
                <p className="text-gray-500 mt-1">Real-time business intelligence and performance metrics.</p>
            </div>

            {/* Broadcast Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-hidden relative">
                    <div className="relative z-10 flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                <ShieldAlert className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Broadcast System Alert</h3>
                                <p className="text-gray-500 text-sm">Send a mandatory notification to all active users immediately.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input
                                    type="text"
                                    placeholder="Alert Title"
                                    className="md:col-span-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={broadcastForm.title}
                                    onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                                />
                                <select
                                    className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={broadcastForm.priority}
                                    onChange={e => setBroadcastForm({ ...broadcastForm, priority: e.target.value })}
                                >
                                    <option value="INFO">Info (Blue)</option>
                                    <option value="WARNING">Warning (Amber)</option>
                                    <option value="CRITICAL">Critical (Red)</option>
                                </select>
                            </div>
                            <textarea
                                placeholder="Message content..."
                                className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none h-20 resize-none"
                                value={broadcastForm.message}
                                onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                            />
                            <button
                                disabled={broadcastLoading}
                                onClick={handleBroadcast}
                                className="self-end bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                            >
                                {broadcastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Send
                            </button>
                        </div>
                    </div>
                </div>

                {/* Broadcast History */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm overflow-hidden flex flex-col h-full max-h-[350px]">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                        Recent Alerts
                        <span className="text-xs font-normal text-gray-500">{broadcasts.length} total</span>
                    </h3>
                    <div className="overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                        {broadcasts.length === 0 && <p className="text-sm text-gray-400 italic">No alerts sent yet.</p>}
                        {broadcasts.map((b: any) => (
                            <div key={b.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 group relative">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${b.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                        b.priority === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                        {b.priority}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(b.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 truncate">{b.title}</h4>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{b.message}</p>

                                <button
                                    onClick={() => handleDeleteBroadcast(b.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-white rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete Record"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Total Revenue"
                    value={`R${analytics.revenue?.total?.toLocaleString() || 0}`}
                    icon={DollarSign}
                    theme="emerald"
                    trend={(analytics.revenue?.trend && analytics.revenue?.trend !== '+0%' && analytics.revenue?.trend !== 'New')
                        ? `${analytics.revenue.trend} vs last month`
                        : null}
                    onClick={() => navigate('/admin/revenue')}
                />
                <StatCard
                    label="Active Users"
                    value={analytics.users?.active || 0}
                    icon={Users}
                    theme="violet"
                    onClick={() => navigate('/admin/subscriptions')}
                />
                <StatCard
                    label="Avg. Satisfaction"
                    value={analytics.feedback?.average ? `${analytics.feedback.average}/5` : 'N/A'}
                    icon={Star}
                    theme="amber"
                    subtext={`${analytics.feedback?.count || 0} reviews`}
                    onClick={() => navigate('/admin/feedback')}
                    cursor="cursor-pointer hover:border-amber-300"
                />
                <StatCard
                    label="System Health"
                    value={analytics.errors?.critical_24h > 0 ? `${analytics.errors.critical_24h} Errors` : 'Healthy'}
                    icon={ShieldAlert}
                    theme={analytics.errors?.critical_24h > 0 ? "red" : "emerald"}
                    subtext={analytics.errors?.critical_24h > 0 ? "Critical issues in last 24h" : "System operating normally"}
                    onClick={() => navigate('/admin/errors')}
                    cursor="cursor-pointer hover:border-red-300"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Growth Chart */}
                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900">User Growth (New Accounts)</h3>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setGrowthPeriod(p)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${growthPeriod === p
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthDataState}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#cbd5e1' }}
                                />
                                <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity / User Tracker */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm overflow-hidden flex flex-col">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                        User Tracker
                        <span className="text-xs font-normal text-gray-500">Live Traffic</span>
                    </h3>
                    <div className="overflow-y-auto pr-2 scrollbar-thin">
                        <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-gray-50">
                                {recentUsers.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-gray-50/50 group">
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.profile_complete ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                                                <p className="font-bold text-gray-900 text-xs truncate max-w-[120px]">{u.company_name}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-500 ml-3.5 truncate max-w-[150px]">{u.full_name || u.email}</p>
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${u.sub_plan?.toLowerCase().includes('pro') ? 'bg-indigo-600 text-white' :
                                                        u.sub_plan?.toLowerCase().includes('standard') ? 'bg-blue-500 text-white' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {u.sub_plan || 'Free'}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex flex-col items-end leading-tight">
                                                    <p className="text-[9px] text-gray-500 font-medium">
                                                        Login: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                                    </p>
                                                    <p className="text-[8px] text-gray-400">
                                                        Active: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {recentUsers.length === 0 && (
                                    <tr><td colSpan={2} className="text-center text-gray-400 text-xs py-4">No recent activity</td></tr>
                                )}
                            </tbody>
                        </table>
                        <button
                            onClick={() => navigate('/admin/users')}
                            className="w-full mt-4 text-xs text-center text-blue-600 hover:text-blue-800 font-medium py-2 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            View All Users
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, theme, onClick, trend, subtext, actionLabel }: any) {
    // Theme mapping
    const themes: any = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', hoverBg: 'hover:bg-emerald-600', border: 'hover:border-emerald-600' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', hoverBg: 'hover:bg-violet-600', border: 'hover:border-violet-600' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', hoverBg: 'hover:bg-blue-600', border: 'hover:border-blue-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', hoverBg: 'hover:bg-amber-600', border: 'hover:border-amber-600' },
        red: { bg: 'bg-red-50', text: 'text-red-600', hoverBg: 'hover:bg-red-600', border: 'hover:border-red-600' },
    }
    const t = themes[theme] || themes.blue

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`
                group relative overflow-hidden
                bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all duration-300
                ${onClick ? 'cursor-pointer' : ''}
                ${t.hoverBg} ${t.border}
            `}
        >
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-lg ${t.bg} transition-colors group-hover:bg-white/20`}>
                    <Icon className={`w-6 h-6 ${t.text} transition-colors group-hover:text-white`} />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-full border border-gray-100 group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent">
                        {trend}
                    </span>
                )}
                {actionLabel && (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-100 group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent transition-colors">
                        {actionLabel} ➞
                    </span>
                )}
            </div>
            <div className="relative z-10">
                <p className="text-base font-bold text-gray-500 group-hover:text-white/90 transition-colors uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold text-gray-900 tracking-tight mt-1 group-hover:text-white transition-colors capitalize">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                {subtext && <p className="text-xs text-gray-400 mt-2 font-medium group-hover:text-white/80 transition-colors">{subtext}</p>}
            </div>
        </motion.div>
    )
}
