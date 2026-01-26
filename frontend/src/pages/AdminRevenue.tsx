import React, { useState, useEffect } from "react"
import { AdminService } from "@/services/api"
import { Download, Calendar, Loader2, AlertTriangle, FileText } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

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

function AdminRevenueContent() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<"7D" | "30D" | "90D" | "1Y">("30D")
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [period])

    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await AdminService.getRevenueData(period)
            // Robust check
            if (!res || !res.data) {
                setData({ totalRevenue: 0, graphData: [], transactions: [] })
            } else {
                setData(res.data)
            }
        } catch (e: any) {
            console.error("Failed to load revenue data", e)
            setError(e.message || "Unknown failed to load data")
            setData({ totalRevenue: 0, graphData: [], transactions: [] })
        }
        setLoading(false)
    }

    const downloadCSV = () => {
        if (!data || !data.transactions) return

        // Recalculate for CSV
        const txs = [...data.transactions]
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .reduce((acc: any[], t: any, index: number) => {
                const prevTotal = index > 0 ? acc[index - 1].runningTotal : 0
                acc.push({ ...t, runningTotal: prevTotal + (t.amount || 0) })
                return acc
            }, [])
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const headers = ["Business Name", "Email Address", "Tier", "Time", "Date", "Amount Paid", "Running Total"]
        const rows = txs.map((t: any) => {
            const dateObj = new Date(t.date)
            return [
                t.company_name || "Unknown",
                t.user_email || "Unknown",
                t.plan || "Free",
                dateObj.toLocaleTimeString(),
                dateObj.toLocaleDateString(),
                t.amount?.toFixed(2) || "0.00",
                t.runningTotal?.toFixed(2) || "0.00"
            ]
        })

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map((e: any[]) => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `revenue_report_${period}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (loading && !data) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

    if (error) {
        return (
            <div className="p-8 text-center text-red-600">
                <p>Error loading data: {error}</p>
                <button onClick={loadData} className="mt-2 text-blue-600 underline">Retry</button>
            </div>
        )
    }

    // Calculate Running Total
    // 1. Sort ascending to calculate
    const transactionsWithRunningTotal = [...(data?.transactions || [])]
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .reduce((acc: any[], t: any, index: number) => {
            const prevTotal = index > 0 ? acc[index - 1].runningTotal : 0
            acc.push({ ...t, runningTotal: prevTotal + (t.amount || 0) })
            return acc
        }, [])
        // 2. Sort descending for display (Newest first, seeing the high total at top)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Excel-like Table Styles
    const thClass = "px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none relative"
    const tdClass = "px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap"

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
                        onClick={() => navigate("/admin/revenue/history")}
                        className="flex items-center px-4 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium shadow-sm transition-colors"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Monthly Statements
                    </button>
                    <div className="bg-white border border-gray-200 rounded-md p-1 flex items-center shadow-sm">
                        {(["7D", "30D", "90D", "1Y"] as const).map((p) => (
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
                        Download Excel
                    </button>
                </div>
            </div>

            {/* Main Graph Card */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-gray-900">Revenue Trend</h3>
                        <p className="text-xs text-gray-500">Gross revenue over selected period</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">R{data?.totalRevenue?.toLocaleString() || 0}</p>
                    </div>
                </div>
                <div className="h-[300px]">
                    {(!data?.graphData || data.graphData.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm">No revenue data to display for this period</p>
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
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {transactionsWithRunningTotal.length || 0} ROWS
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={thClass}>Business Name</th>
                                <th className={thClass}>Email Address</th>
                                <th className={thClass}>Tier</th>
                                <th className={thClass}>Time</th>
                                <th className={thClass}>Date</th>
                                <th className={`${thClass} text-right`}>Amount In</th>
                                <th className={`${thClass} text-right bg-blue-100/50 border-blue-300`}>Running Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactionsWithRunningTotal.map((t: any, i: number) => {
                                const dateObj = new Date(t.date)
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className={`${tdClass} font-medium text-gray-900 group-hover:text-blue-700`}>
                                            {t.company_name}
                                        </td>
                                        <td className={tdClass}>{t.user_email}</td>
                                        <td className={tdClass}>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold border ${t.plan === 'Pro' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                t.plan === 'Standard' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {t.plan}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-gray-500 font-mono text-xs`}>{dateObj.toLocaleTimeString()}</td>
                                        <td className={tdClass}>{dateObj.toLocaleDateString()}</td>
                                        <td className={`${tdClass} text-right font-medium`}>R{t.amount?.toFixed(2)}</td>
                                        <td className={`${tdClass} text-right font-bold text-blue-900 bg-blue-50/30`}>R{t.runningTotal?.toFixed(2)}</td>
                                    </tr>
                                )
                            })}

                            {/* Total Footer Row */}
                            {transactionsWithRunningTotal.length > 0 && (
                                <tr className="bg-gray-100 border-t-2 border-gray-300">
                                    <td colSpan={5} className={`${tdClass} text-right font-bold text-gray-900 uppercase`}>
                                        Total Revenue
                                    </td>
                                    <td className={`${tdClass} font-bold text-gray-900 bg-yellow-50 text-right`}>
                                        R{data.transactions.reduce((acc: number, t: any) => acc + (t.amount || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="bg-gray-100"></td>
                                </tr>
                            )}

                            {(!data?.transactions || data.transactions.length === 0) && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-gray-400 bg-gray-50/30">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                <Calendar className="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p className="font-medium">No subscriber records found</p>
                                            <p className="text-xs max-w-xs mx-auto">Transactions will appear here once users subscribe.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer / Pagination Placeholder (Excel style) */}
                <div className="bg-gray-50 border-t border-gray-200 p-2 text-xs text-right text-gray-500 font-medium">
                    End of Report
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
