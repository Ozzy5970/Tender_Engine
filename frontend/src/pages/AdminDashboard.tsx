import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/Skeleton"
import { AdminService, FeedbackService, ErrorService } from "@/services/api"
import { ArrowUpRight, DollarSign, CreditCard, Star, ShieldAlert } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from "framer-motion"

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [analytics, setAnalytics] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        loadAnalytics()
    }, [])

    const loadAnalytics = async () => {
        const { data, error } = await AdminService.getAnalytics()
        const { data: feedbackStats } = await FeedbackService.getStats()
        const { data: totalUsersCount } = await FeedbackService.getTotalUsers()
        const { data: errorStats } = await ErrorService.getStats()

        if (data) {
            setAnalytics({
                ...data,
                feedback: feedbackStats,
                total_registered_users: totalUsersCount,
                errors: errorStats
            })
        }
        else {
            console.error(error)
            setErrorMsg(typeof error === 'string' ? error : JSON.stringify(error))
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
                {/* Header Skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>

                {/* KPI Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="col-span-3 h-[300px] rounded-xl" />
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

    // Data Transformation for Charts
    const growthData = analytics.user_growth || []

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Overview</h1>
                <p className="text-gray-500 mt-1">Real-time business intelligence and performance metrics.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Total Revenue"
                    value={`R${analytics.revenue?.total?.toLocaleString() || 0}`}
                    icon={DollarSign}
                    theme="emerald"
                    // Only show trend if valid and not "New" or "+0%" (as per user request to hide if no history)
                    trend={(analytics.revenue?.trend && analytics.revenue?.trend !== '+0%' && analytics.revenue?.trend !== 'New')
                        ? `${analytics.revenue.trend} vs last month`
                        : null}
                    onClick={() => navigate('/admin/revenue')}
                />
                <StatCard
                    label="Active Subscriptions"
                    value={analytics.users?.active || 0}
                    icon={CreditCard}
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
                    theme={analytics.errors?.critical_24h > 0 ? "red" : "emerald"} // Red if errors, Green if good
                    subtext={analytics.errors?.critical_24h > 0 ? "Critical issues in last 24h" : "System operating normally"}
                    onClick={() => navigate('/admin/errors')}
                    cursor="cursor-pointer hover:border-red-300"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Growth Chart */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900">User Growth</h3>
                        <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>On Track</span>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#cbd5e1' }}
                                />
                                <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                            </AreaChart>
                        </ResponsiveContainer>
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
