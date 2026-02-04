import { useState, useEffect } from 'react'
import { AdminService, FeedbackService, ErrorService } from "@/services/api"
import {
    Users, DollarSign, ShieldAlert, RefreshCw,
    MessageSquare, AlertTriangle, TrendingUp, Trash2, Loader2
} from 'lucide-react'
import { useNavigate } from "react-router-dom"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'


export default function AdminDashboard() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true) // Initial "Shell" loading
    const [isRefreshing, setIsRefreshing] = useState(false) // Background refresh
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Decoupled Data States
    const [analytics, setAnalytics] = useState<any>(null)
    const [recentUsers, setRecentUsers] = useState<any[]>([])
    const [growthDataState, setGrowthDataState] = useState<any[]>([])
    const [broadcasts, setBroadcasts] = useState<any[]>([])

    // Broadcast Form
    const [broadcastLoading, setBroadcastLoading] = useState(false)
    const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', priority: 'INFO' })

    // Growth Chart Config
    const [growthPeriod, setGrowthPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

    useEffect(() => {
        loadAllData()
    }, [])

    useEffect(() => {
        loadGrowth()
    }, [growthPeriod])

    // Unified Loader
    const loadAllData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        else setIsRefreshing(true)

        // Don't clear error msg on background refresh to keep "Limited Mode" banner visible if issues persist
        if (!isBackground) setErrorMsg(null)

        try {
            await Promise.allSettled([
                loadAnalytics(),
                loadBroadcasts(),
                loadRecentUsers(),
                loadGrowth()
            ])
        } catch (e: any) {
            console.error("Dashboard Load Error:", e)
            setErrorMsg(e.message || "Failed to load some dashboard data")
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    // Manual Retry triggers background refresh
    const handleRetry = () => loadAllData(true)

    const loadGrowth = async () => {
        const { data } = await AdminService.getUserGrowth(growthPeriod)
        if (data) setGrowthDataState(data as any[])
    }

    const loadAnalytics = async () => {
        const { data, error } = await AdminService.getAnalytics()
        // These calls rarely block but can fail independently
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
            console.error("Analytics Error:", error)
            // Strict check for TIMEOUT to trigger Limited Mode
            if (typeof error === 'string' && (error.includes('TIMEOUT') || error.includes('Network'))) {
                setErrorMsg("Limited Connectivity Mode")
            }
        }
    }

    // ... (Other loaders remain same)

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

    // --- Render Logic ---

    // Data Optional: We ALWAYS render the shell.
    // Skeletons are used as placeholders for VALUES, not entire components.

    // Helper to detect if we are in "Limited Mode" (Network Blocked)
    const isLimitedMode = !!errorMsg && (errorMsg.includes('Limited') || errorMsg.includes('Network') || errorMsg.includes('Timeout'));

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans space-y-8">
            {/* Phase 3: Limited Mode Banner */}
            {isLimitedMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-amber-800">Limited Connectivity Mode</h3>
                        <p className="text-sm text-amber-700 mt-0.5">
                            We are experiencing network interference (possibly from browser extensions).
                            Some data may be outdated or unavailable.
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Overview</h1>
                    <p className="text-gray-500 mt-1">Real-time business intelligence and performance metrics.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRetry}
                        disabled={loading || isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Updating...' : 'Refresh Data'}
                    </button>
                </div>
            </div>

            {/* Analytics Grid - Data Optional Refactor */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Revenue Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">
                                {loading && !analytics ? (
                                    <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
                                ) : isLimitedMode && !analytics?.revenue ? (
                                    <span className="text-amber-500 text-lg">⚠ Unavailable</span>
                                ) : (
                                    analytics?.revenue?.total !== undefined ? `$${analytics.revenue.total.toLocaleString()}` : '—'
                                )}
                            </h3>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </div>

                {/* 2. Active Users Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Users</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">
                                {loading && !analytics ? (
                                    <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                                ) : isLimitedMode && !analytics?.users ? (
                                    <span className="text-amber-500 text-lg">⚠ Unavailable</span>
                                ) : (
                                    analytics?.users?.active !== undefined ? analytics.users.active : '—'
                                )}
                            </h3>
                            <div className="mt-1 flex items-center gap-1">
                                <span className="text-xs text-gray-500">
                                    of {loading && !analytics ? '...' : (analytics?.users?.total || '0')} total
                                </span>
                            </div>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </div>

                {/* 3. Feedback Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md cursor-pointer" onClick={() => navigate('/admin/feedback')}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">New Feedback</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">
                                {loading && !analytics ? (
                                    <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
                                ) : (
                                    analytics?.feedback?.total || 0
                                )}
                            </h3>
                            <p className="text-xs text-blue-600 mt-1 font-medium">View all &rarr;</p>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                </div>

                {/* 4. System Health Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md cursor-pointer" onClick={() => navigate('/admin/errors')}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">System Errors</p>
                            <h3 className={`text-2xl font-bold mt-2 ${analytics?.errors?.recent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {loading && !analytics ? (
                                    <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
                                ) : (
                                    analytics?.errors?.recent || 0
                                )}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
                        </div>
                        <div className={`p-2 rounded-lg ${analytics?.errors?.recent > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                            <AlertTriangle className={`w-5 h-5 ${analytics?.errors?.recent > 0 ? 'text-red-600' : 'text-green-600'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Growth Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">User Growth</h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setGrowthPeriod(p)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${growthPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[300px] w-full min-h-[300px] relative">
                        {/* ALWAYS render container. Overlay states. */}
                        {loading && (!growthDataState || growthDataState.length === 0) && (
                            <div className="absolute inset-0 z-10 bg-white/50 flex items-center justify-center backdrop-blur-[1px]">
                                <p className="text-gray-400 text-sm animate-pulse">Loading Growth Data...</p>
                            </div>
                        )}

                        {isLimitedMode && !loading && (!growthDataState || growthDataState.length === 0) && (
                            <div className="absolute inset-0 z-10 bg-gray-50/50 flex flex-col items-center justify-center border border-dashed border-amber-200 rounded-lg">
                                <ShieldAlert className="w-8 h-8 text-amber-400 mb-2" />
                                <p className="text-amber-700 text-sm font-medium">Data Unavailable (Limited Mode)</p>
                            </div>
                        )}

                        {!growthDataState || growthDataState.length === 0 ? (
                            // Empty State (True Empty)
                            !loading && !isLimitedMode && (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <TrendingUp className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-gray-500 text-sm">No growth data yet</p>
                                </div>
                            )
                        ) : (
                            // Chart Renders
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growthDataState}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#4f46e5"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorUsers)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Recent Users List */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Recent Sign-ups</h3>
                        <button onClick={() => navigate('/admin/users')} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">View All</button>
                    </div>
                    <div className="space-y-4">
                        {loading && recentUsers.length === 0 && (
                            [1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3 pb-3 border-b border-gray-50">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                                        <div className="h-2 w-16 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))
                        )}

                        {isLimitedMode && !loading && recentUsers.length === 0 && (
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
                                <p className="text-amber-700 text-sm">Cannot load users (Network Blocked)</p>
                            </div>
                        )}

                        {!loading && !isLimitedMode && recentUsers.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">No recent users found.</p>
                        )}

                        {recentUsers.map((user) => (
                            <div key={user.id} className="flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                    {(user.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user.email || 'Unknown User'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs text-gray-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </p>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${user.sub_plan?.toLowerCase().includes('pro') ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {user.sub_plan || 'Free'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Broadcasts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Send Broadcast</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                placeholder="e.g. Maintenance"
                                value={broadcastForm.title}
                                onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                            <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-24 resize-none"
                                placeholder="Enter alert message..."
                                value={broadcastForm.message}
                                onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                value={broadcastForm.priority}
                                onChange={e => setBroadcastForm({ ...broadcastForm, priority: e.target.value })}
                            >
                                <option value="INFO">Info (Blue)</option>
                                <option value="WARNING">Warning (Orange)</option>
                                <option value="CRITICAL">Critical (Red)</option>
                            </select>
                        </div>
                        <button
                            onClick={handleBroadcast}
                            disabled={broadcastLoading}
                            className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {broadcastLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Send Broadcast
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Active Broadcasts</h3>
                    <div className="space-y-3">
                        {loading && broadcasts.length === 0 && (
                            [1, 2].map(i => <div key={i} className="h-16 w-full bg-gray-50 rounded-lg animate-pulse" />)
                        )}

                        {isLimitedMode && !loading && broadcasts.length === 0 && (
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
                                <p className="text-amber-700 text-sm">Cannot load broadcasts (Network Blocked)</p>
                            </div>
                        )}

                        {!loading && !isLimitedMode && broadcasts.length === 0 && (
                            <p className="text-sm text-gray-500">No active broadcasts.</p>
                        )}

                        {broadcasts.map((b) => (
                            <div key={b.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        {b.priority === 'CRITICAL' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                                        {b.priority === 'WARNING' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                                        {b.priority === 'INFO' && <MessageSquare className="w-4 h-4 text-blue-500" />}
                                        <h4 className="font-bold text-gray-900 text-sm">{b.title}</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{b.message}</p>
                                    <p className="text-xs text-gray-400 mt-2">Sent: {new Date(b.created_at).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleDeleteBroadcast(b.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Delete Broadcast"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
