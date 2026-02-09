import React, { useState, useEffect } from "react"
import { AdminService } from "@/services/api"
import { Download, Calendar, Loader2, AlertTriangle, FileText, ChevronLeft, ChevronRight, RefreshCw, ArrowLeft } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from "react-router-dom"

// Simple Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }
    componentDidCatch(error: Error, errorInfo: any) {
        console.error("ErrorBoundary caught error", error, errorInfo)
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg m-8">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-lg font-bold">Something went wrong</h2>
                    <p className="text-sm font-mono mt-2 text-red-800">{this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Reload Page</button>
                </div>
            )
        }
        return this.props.children
    }
}

// Interfaces
interface Transaction {
    id: string
    date: string
    amount: number
    currency: string
    status: string
    plan: string
    userId: string
    userEmail: string
    companyName: string
}

interface RevenueData {
    totalRevenue: number
    totalCount: number
    graphData: { date: string, amount: number }[]
    transactions: Transaction[]
}

// const CACHE_KEY_PREFIX = 'admin_revenue_ledger_'
// const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

function AdminRevenueContent() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<"7D" | "30D" | "90D" | "1Y" | "ALL">("30D")

    // Pagination
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 50

    const [data, setData] = useState<RevenueData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isStale, setIsStale] = useState(false)

    useEffect(() => {
        // Reset to page 1 when period changes
        setPage(1)
    }, [period])

    useEffect(() => {
        loadData()
    }, [period, page])

    // const getCacheKey = () => `${CACHE_KEY_PREFIX}${period}_${page}`

    const loadData = async () => {
        setLoading(true)
        setError(null)
        setIsStale(false)

        let hadCached = false // Local tracking

        /* TEMPORARILY DISABLED CACHE FOR RELIABILITY
        const cacheKey = getCacheKey()
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
            try {
                const parsed = JSON.parse(cached)
                if (Date.now() - parsed.timestamp < CACHE_DURATION) {
                    setData(parsed.data)
                    // setIsStale(true) 
                    hadCached = true
                }
            } catch (e) {
                localStorage.removeItem(cacheKey)
            }
        }
        */

        try {
            const offset = (page - 1) * PAGE_SIZE
            const res = await AdminService.getRevenueData(period, PAGE_SIZE, offset)

            if (res.error) throw new Error(res.error)
            if (!res.data) throw new Error("No data received")

            setData(res.data)
            setIsStale(false) // Data is fresh
            hadCached = true

            // TEMPORARILY DISABLED CACHE WRITE
            /*
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: res.data
            }))
            */

        } catch (e: any) {
            console.error("Failed to load revenue data", e)

            // Fallback logic using local variable
            if (hadCached) {
                setIsStale(true)
                setError(`Network error. Showing cached data. (${e.message})`)
            } else {
                setError(e.message || "Failed to load data. Please check connection.")
                // Set empty structure so UI doesn't crash
                if (!data) setData({ totalRevenue: 0, totalCount: 0, graphData: [], transactions: [] })
            }
        } finally {
            setLoading(false)
        }
    }

    const downloadCSV = () => {
        if (!data || !data.transactions) return

        const headers = ["Business Name", "Email Address", "Tier", "Time", "Date", "Amount Paid"]
        const rows = data.transactions.map((t: any) => {
            const dateObj = new Date(t.date)
            return [
                t.companyName || "Unknown",
                t.userEmail || "Unknown",
                t.plan || "Free",
                dateObj.toLocaleTimeString(),
                dateObj.toLocaleDateString(),
                t.amount?.toFixed(2) || "0.00"
            ]
        })

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map((e: any[]) => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `revenue_report_${period}_page${page}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 1

    return (
        <div className="max-w-[1600px] mx-auto py-6 px-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate("/admin")}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Console
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Revenue</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => navigate("/admin/revenue/history")}
                        className="flex items-center px-4 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium shadow-sm transition-colors"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Monthly Statements
                    </button>
                    <div className="bg-white border border-gray-200 rounded-md p-1 flex items-center shadow-sm">
                        {(["7D", "30D", "90D", "1Y", "ALL"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === p ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={downloadCSV}
                        className="flex items-center px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white border border-transparent rounded-md text-sm font-medium shadow-sm transition-colors"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV
                    </button>
                </div>
            </div>

            {/* Error / Stale Banner */}
            {error && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${isStale ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Main Graph Card */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-gray-900">Revenue Trend</h3>
                        <p className="text-xs text-gray-500">Gross revenue over selected period (Top-level aggregation)</p>
                    </div>
                    <div className="text-right">
                        {loading && !data ? (
                            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                            <p className="text-2xl font-bold text-gray-900">R{data?.totalRevenue?.toLocaleString() || 0}</p>
                        )}
                    </div>
                </div>
                <div className="h-[300px]">
                    {(!data?.graphData || data.graphData.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                            {loading ? <Loader2 className="w-8 h-8 animate-spin text-gray-400" /> : <p className="text-gray-400 text-sm">No revenue data to display</p>}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.graphData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis
                                    dataKey="date"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tick={{ fill: '#6b7280' }}
                                    tickFormatter={(val) => val ? new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                />
                                <YAxis
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6b7280' }}
                                    tickFormatter={(val) => `R${val}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '6px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                    formatter={(val: any) => [`R${val}`, 'Revenue']}
                                    labelFormatter={(label) => label ? new Date(label).toLocaleDateString() : ''}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#059669"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Excel-like Table */}
            <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                        Transaction Log
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            {data?.totalCount || 0} TOTAL
                        </span>
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            PAGE {page} of {totalPages}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Business Name</th>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Email Address</th>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Tier</th>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Time</th>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Date</th>
                                <th className="px-4 py-2 border border-blue-200 bg-blue-50 text-right text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative">Amount In</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading && !data ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={6} className="px-4 py-4">
                                            <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                data?.transactions.map((t: Transaction, i: number) => {
                                    const dateObj = new Date(t.date)
                                    return (
                                        <tr key={t.id || i} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap font-medium group-hover:text-blue-700">
                                                {t.companyName}
                                            </td>
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap">{t.userEmail}</td>
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold border ${t.plan === 'Pro' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    t.plan === 'Standard' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {t.plan}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-500 font-mono text-xs whitespace-nowrap">{dateObj.toLocaleTimeString()}</td>
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap">{dateObj.toLocaleDateString()}</td>
                                            <td className="px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap text-right font-medium">R{t.amount?.toFixed(2)}</td>
                                        </tr>
                                    )
                                })
                            )}

                            {(!loading && (!data?.transactions || data.transactions.length === 0)) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-gray-400 bg-gray-50/30">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                <Calendar className="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p className="font-medium">No paid transactions in this period</p>
                                            <p className="text-xs max-w-xs mx-auto text-gray-400">Transactions will appear here once valid payments occur.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-gray-50 border-t border-gray-200 p-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500 pl-2">
                        Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, data?.totalCount || 0)} of {data?.totalCount || 0}
                    </p>
                    <div className="flex bg-gray-100 rounded-md p-0.5 gap-1">
                        <button
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded-sm text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                        >
                            <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                        </button>
                        <button
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded-sm text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                        >
                            Next <ChevronRight className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AdminRevenue() {
    return (
        <ErrorBoundary>
            <AdminRevenueContent />
        </ErrorBoundary>
    )
}
