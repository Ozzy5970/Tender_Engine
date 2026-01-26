import { useState, useEffect } from "react"
import { AdminService } from "@/services/api"
import { Download, Calendar, Loader2, ArrowLeft, FileText, ChevronRight, ChevronDown } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function AdminRevenueHistory() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [months, setMonths] = useState<string[]>([])
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
    const [statementData, setStatementData] = useState<any>(null)
    const [loadingStatement, setLoadingStatement] = useState(false)

    useEffect(() => {
        loadMonths()
    }, [])

    const loadMonths = async () => {
        setLoading(true)
        const res = await AdminService.getAvailableMonths()
        if (res.data) {
            setMonths(res.data as string[])
        }
        setLoading(false)
    }

    const loadStatement = async (monthKey: string) => {
        if (selectedMonth === monthKey) {
            // Toggle off if already selected
            setSelectedMonth(null)
            setStatementData(null)
            return
        }

        setSelectedMonth(monthKey)
        setLoadingStatement(true)
        const [year, month] = monthKey.split('-')
        const res = await AdminService.getMonthlyStatement(parseInt(year), parseInt(month))
        setStatementData(res.data)
        setLoadingStatement(false)
    }

    const downloadStatementCSV = () => {
        if (!statementData || !statementData.transactions) return

        const headers = ["Business Name", "Email Address", "Tier", "Amount Paid", "Date", "Time"]
        const rows = statementData.transactions.map((t: any) => {
            const dateObj = new Date(t.date)
            return [
                t.company_name || "Unknown",
                t.user_email || "Unknown",
                t.plan || "Free",
                t.amount?.toFixed(2) || "0.00",
                dateObj.toLocaleDateString(),
                dateObj.toLocaleTimeString()
            ]
        })

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map((e: any[]) => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Statement_${selectedMonth}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const thClass = "px-4 py-2 border border-blue-200 bg-blue-50 text-left text-xs font-bold text-blue-900 uppercase tracking-wider select-none"
    const tdClass = "px-4 py-2 border border-gray-200 text-sm text-gray-700 whitespace-nowrap"

    return (
        <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-gray-50 min-h-screen">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate("/admin/revenue")}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <FileText className="w-8 h-8 text-blue-600" />
                    Monthly Statements
                </h1>
                <p className="text-gray-500">Access and download archival revenue reports.</p>
            </div>

            {/* List of Months */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-900">Available Statements</h3>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : months.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <p>No historical statements found.</p>
                        <p className="text-xs mt-1">Statements are generated automatically when transactions occur.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {months.map(monthKey => {
                            const [year, month] = monthKey.split('-')
                            const dateLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
                            const isSelected = selectedMonth === monthKey

                            return (
                                <div key={monthKey} className="group">
                                    <button
                                        onClick={() => loadStatement(monthKey)}
                                        className={`w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-lg">{dateLabel}</h4>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {year}-{month}</p>
                                            </div>
                                        </div>
                                        {isSelected ? <ChevronDown className="w-5 h-5 text-blue-600" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                    </button>

                                    {/* Expanded Statement View */}
                                    {isSelected && (
                                        <div className="p-6 bg-white border-t border-gray-100 animate-in slide-in-from-top-2">
                                            {loadingStatement ? (
                                                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                                            ) : statementData ? (
                                                <div className="space-y-6">
                                                    {/* Statement Header */}
                                                    <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Statement of Account</p>
                                                            <h2 className="text-2xl font-bold text-gray-900">{dateLabel}</h2>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
                                                            <p className="text-3xl font-mono font-bold text-gray-900">R{statementData.totalRevenue?.toFixed(2)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Statement Table */}
                                                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-blue-50">
                                                                <tr>
                                                                    <th className={thClass}>Date</th>
                                                                    <th className={thClass}>Company</th>
                                                                    <th className={thClass}>Tier</th>
                                                                    <th className={`${thClass} text-right`}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                                {statementData.transactions.map((t: any, idx: number) => (
                                                                    <tr key={idx}>
                                                                        <td className={tdClass}>{new Date(t.date).toLocaleDateString()}</td>
                                                                        <td className={tdClass}>
                                                                            <span className="font-bold block text-gray-900">{t.company_name}</span>
                                                                            <span className="text-xs text-gray-500">{t.user_email}</span>
                                                                        </td>
                                                                        <td className={tdClass}>{t.plan}</td>
                                                                        <td className={`${tdClass} text-right font-mono font-medium`}>R{t.amount.toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-gray-100 font-bold">
                                                                    <td colSpan={3} className="px-4 py-3 text-right uppercase text-xs tracking-wider text-gray-600 border-t-2 border-gray-300">Total</td>
                                                                    <td className="px-4 py-3 text-right text-gray-900 font-mono text-base border-t-2 border-gray-300 bg-yellow-50">R{statementData.totalRevenue.toFixed(2)}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex justify-end pt-2">
                                                        <button
                                                            onClick={downloadStatementCSV}
                                                            className="flex items-center px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                                                        >
                                                            <Download className="w-4 h-4 mr-2" />
                                                            Download Statement (CSV)
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-red-500">Failed to load statement.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
