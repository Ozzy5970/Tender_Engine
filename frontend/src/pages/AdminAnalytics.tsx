import { useState, useEffect } from 'react'
import { AdminService } from "@/services/api"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Users } from 'lucide-react'
import type { AdminAnalyticsMetrics } from "@/types/api"

export default function AdminAnalytics() {
    const [data, setData] = useState<AdminAnalyticsMetrics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                // In a real app, you might want to cache this too, but for analytics, 
                // fresh data is usually preferred over instant load.
                const { data: analyticsData } = await AdminService.getAnalytics()
                setData(analyticsData)
            } catch (error) {
                console.error("Failed to load analytics", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto animate-pulse">
                <div className="h-8 w-48 bg-gray-200 rounded mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
                </div>
                <div className="h-96 bg-gray-100 rounded-xl" />
            </div>
        )
    }

    if (!data) return <div className="p-8 text-center text-gray-500">Failed to load analytics data.</div>

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Analytics & Growth</h1>
                <p className="text-gray-500 mt-2">Financial performance and user acquisition metrics.</p>
            </header>

            {/* Debug Panel (Only visible with ?debug=1) */}
            {new URLSearchParams(window.location.search).get('debug') === '1' && (
                <div className="mb-8 p-4 bg-gray-900 rounded-lg text-green-400 font-mono text-xs overflow-auto max-h-96">
                    <h4 className="font-bold text-white mb-2 uppercase tracking-wider">Debug: Raw RPC Response</h4>
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 font-medium text-sm">Lifetime Revenue</h3>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(data.lifetimeRevenuePaid)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-2 flex items-center font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" /> Total Paid (All Time)
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 font-medium text-sm">MRR (Active)</h3>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(data.mrrActiveSubscriptions)}
                    </p>
                    <p className="text-xs text-blue-600 mt-2 flex items-center font-medium">
                        Active Subscriptions Value
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 font-medium text-sm">Active Subscriptions</h3>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{data.activeSubscriptions?.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-2">Paid accounts</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">User Growth</h3>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button className="px-3 py-1 text-xs font-bold bg-white shadow-sm rounded-md text-gray-900">30 Days</button>
                        <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-900">90 Days</button>
                    </div>
                </div>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.userGrowthSeries || []}>
                            <defs>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#9ca3af' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#9ca3af' }}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="users"
                                stroke="#4f46e5"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorUsers)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
