import { useState, useEffect } from "react"
import { ErrorService } from "@/services/api"
import { ArrowLeft, AlertTriangle, CheckCircle2, Download, Copy, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/Skeleton"

export default function AdminErrors() {
    const navigate = useNavigate()
    const [errors, setErrors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedError, setSelectedError] = useState<any | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        const { data } = await ErrorService.getAll()
        if (data) {
            setErrors(data as any[])
        }
        setLoading(false)
    }

    const downloadCSV = () => {
        const headers = ["Timestamp", "User", "Page", "Severity", "Error Description", "Stack Trace"]
        const rows = errors.map(e => [
            new Date(e.created_at).toLocaleString(),
            e.profiles?.email || 'Anonymous',
            e.page,
            e.severity,
            e.description?.replace(/,/g, ' '), // sanitize for CSV
            e.stack_trace?.replace(/,/g, ' ').replace(/\n/g, ' | ') // sanitize
        ])

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `system_errors_${new Date().toISOString()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (loading) {
        return (
            <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-white min-h-screen">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="border border-gray-100 rounded-2xl overflow-hidden p-4 space-y-4">
                    <Skeleton className="h-10 w-full bg-gray-50" />
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-12 w-24" />
                            <Skeleton className="h-12 flex-1" />
                            <Skeleton className="h-12 w-32" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-white min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate("/admin")}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Console
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                        System Health
                    </h1>
                    <p className="text-gray-500">Log of critical system errors and application crashes.</p>
                </div>
                <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export Log
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Status</th>
                                <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Timestamp</th>
                                <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Page</th>
                                <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">User</th>
                                <th className="px-6 py-4 text-right font-semibold tracking-wide text-xs uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {errors.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                                            </div>
                                            <span className="font-medium text-gray-600">All systems operational</span>
                                            <span className="text-xs text-gray-400 mt-1">No errors recorded in the logs.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                errors.map((err) => (
                                    <tr
                                        key={err.id}
                                        onClick={() => setSelectedError(err)}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            {err.severity === 'critical' && <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold uppercase">Critical</span>}
                                            {err.severity === 'warning' && <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-bold uppercase">Warning</span>}
                                            {err.severity === 'info' && <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold uppercase">Info</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            {new Date(err.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-blue-600">
                                            {err.page}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {err.profiles?.email || <span className="text-gray-300 italic">Anonymous</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Details &rarr;</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedError && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="bg-gray-900 text-white p-6 flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold font-mono text-red-400">
                                        {selectedError.description || "Unknown Error"}
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Occurred at {new Date(selectedError.created_at).toLocaleString()} on {selectedError.page}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedError(null)} className="text-gray-400 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 bg-gray-50 max-h-[60vh] overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold uppercase text-gray-500">Stack Trace</h3>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(selectedError.stack_trace)}
                                        className="flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        <Copy className="w-3 h-3 mr-1" /> Copy to Clipboard
                                    </button>
                                </div>
                                <pre className="bg-white border border-gray-200 p-4 rounded-lg text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {selectedError.stack_trace || "No stack trace available."}
                                </pre>

                                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                    <h4 className="text-sm font-bold text-blue-900 mb-1">Developer Note</h4>
                                    <p className="text-sm text-blue-800">
                                        Copy the stack trace above and provide it to Antigravity (me) to fix this issue immediately.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
