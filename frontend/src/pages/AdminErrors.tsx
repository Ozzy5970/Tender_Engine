import { useState, useEffect } from "react"
import { ErrorService } from "@/services/api"
import { ArrowLeft, AlertTriangle, CheckCircle2, Download, Copy, X, Trash2, Eye, EyeOff, CheckSquare } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/Skeleton"
import { supabase } from "@/lib/supabase"

export default function AdminErrors() {
    const navigate = useNavigate()
    const [errors, setErrors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedError, setSelectedError] = useState<any | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    const [statusFilter, setStatusFilter] = useState("open")
    const [severityFilter, setSeverityFilter] = useState("all")

    useEffect(() => {
        loadData()
    }, [statusFilter, severityFilter])

    const loadData = async () => {
        setLoading(true)
        const { data } = await ErrorService.getAdminErrors({ status: statusFilter, severity: severityFilter })
        if (data) {
            setErrors(data as any[])
        }
        setSelectedIds(new Set())
        setLoading(false)
    }

    const handleSelectRow = (id: string, checked: boolean) => {
        const next = new Set(selectedIds)
        if (checked) next.add(id)
        else next.delete(id)
        setSelectedIds(next)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(errors.map(e => e.id)))
        else setSelectedIds(new Set())
    }

    const handleBulkAction = async (action: 'seen' | 'resolved' | 'ignored' | 'delete') => {
        const ids = Array.from(selectedIds)
        if (ids.length === 0) return

        if (action === 'delete') {
            if (!window.confirm(`Delete ${ids.length} selected error log(s)? This cannot be undone.`)) return
            const { error } = await ErrorService.deleteErrors(ids)
            if (error) alert("Failed to delete: " + error)
            else loadData()
            return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const updates: any = {
            status: action,
            updated_at: new Date().toISOString()
        }
        if (action === 'seen') {
            updates.seen_at = new Date().toISOString()
            updates.seen_by = user.id
        } else if (action === 'resolved') {
            updates.resolved_at = new Date().toISOString()
            updates.resolved_by = user.id
        } else if (action === 'ignored') {
            updates.ignored_at = new Date().toISOString()
            updates.ignored_by = user.id
        }

        const { error } = await ErrorService.updateErrors(ids, updates)
        if (error) alert("Failed to update status: " + error)
        else loadData()
    }

    const downloadCSV = () => {
        const headers = ["Timestamp", "Status", "Occurrence", "User", "Page", "Severity", "Error Description", "Stack Trace", "Fingerprint"]
        const rows = errors.map(e => [
            new Date(e.created_at).toLocaleString(),
            e.status,
            e.occurrence_count || 1,
            e.email || 'Anonymous',
            e.page,
            e.severity,
            e.description?.replace(/,/g, ' '),
            e.stack_trace?.replace(/,/g, ' ').replace(/\n/g, ' | '),
            e.fingerprint
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

    if (loading && errors.length === 0) {
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
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Premium Admin Header */}
            <div className="bg-slate-900 pb-24 pt-12 px-8 shadow-inner border-b border-indigo-900/50">
                <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate("/admin")}
                            className="flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Console
                        </button>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                            System Health
                        </h1>
                        <p className="text-indigo-200 mt-2">Log of critical system errors and application crashes.</p>
                    </div>
                    
                    <div className="flex gap-3 mt-4 md:mt-0">
                        <button
                            onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export Log
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 space-y-4">
                
                {/* Filters & Bulk Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
                    <div className="flex items-center gap-4">
                        <select 
                            value={statusFilter} 
                            onChange={e => setStatusFilter(e.target.value)}
                            className="border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="seen">Seen</option>
                            <option value="resolved">Resolved</option>
                            <option value="ignored">Ignored</option>
                        </select>

                        <select 
                            value={severityFilter} 
                            onChange={e => setSeverityFilter(e.target.value)}
                            className="border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                        </select>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 mr-2 font-medium">{selectedIds.size} selected</span>
                            <button onClick={() => handleBulkAction('seen')} className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"><Eye className="w-3 h-3"/> Mark Seen</button>
                            <button onClick={() => handleBulkAction('resolved')} className="px-3 py-1.5 text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-1"><CheckSquare className="w-3 h-3"/> Mark Fixed</button>
                            <button onClick={() => handleBulkAction('ignored')} className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"><EyeOff className="w-3 h-3"/> Ignore</button>
                            <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"><Trash2 className="w-3 h-3"/> Delete</button>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={errors.length > 0 && selectedIds.size === errors.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Severity</th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Status</th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Page</th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">User</th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Occurrences</th>
                                    <th className="px-6 py-4 font-semibold tracking-wide text-xs uppercase">Last Seen</th>
                                    <th className="px-6 py-4 text-right font-semibold tracking-wide text-xs uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {errors.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                </div>
                                                <span className="font-medium text-gray-600">All systems operational</span>
                                                <span className="text-xs text-gray-400 mt-1">No errors matching the current filters.</span>
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
                                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedIds.has(err.id)}
                                                    onChange={(e) => handleSelectRow(err.id, e.target.checked)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                {err.severity === 'critical' && <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold uppercase">Critical</span>}
                                                {err.severity === 'warning' && <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-bold uppercase">Warning</span>}
                                                {err.severity === 'info' && <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold uppercase">Info</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase ${
                                                    err.status === 'open' ? 'bg-red-50 text-red-600' : 
                                                    err.status === 'seen' ? 'bg-blue-50 text-blue-600' :
                                                    err.status === 'resolved' ? 'bg-green-50 text-green-600' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>{err.status}</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-blue-600">
                                                {err.page}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {err.email || <span className="text-gray-300 italic">Anonymous</span>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-medium">
                                                {err.occurrence_count || 1}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                {new Date(err.last_seen_at || err.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-xs mr-2">Details</span>
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
                                className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            >
                                <div className="bg-gray-900 text-white p-6 flex justify-between items-start shrink-0">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                selectedError.status === 'open' ? 'bg-red-500/20 text-red-300' : 
                                                selectedError.status === 'seen' ? 'bg-blue-500/20 text-blue-300' :
                                                selectedError.status === 'resolved' ? 'bg-green-500/20 text-green-300' :
                                                'bg-gray-500/20 text-gray-300'
                                            }`}>{selectedError.status}</span>
                                            <span className="text-gray-400 text-xs font-mono">{selectedError.fingerprint || 'No Fingerprint'}</span>
                                        </div>
                                        <h2 className="text-xl font-bold font-mono text-red-400">
                                            {selectedError.description || "Unknown Error"}
                                        </h2>
                                        <p className="text-gray-400 text-sm mt-1">
                                            First seen: {new Date(selectedError.created_at).toLocaleString()} | Last seen: {new Date(selectedError.last_seen_at || selectedError.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedError(null)} className="text-gray-400 hover:text-white">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="p-6 bg-gray-50 overflow-y-auto grow space-y-6">
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Occurrences</p>
                                            <p className="text-2xl font-bold text-gray-800">{selectedError.occurrence_count || 1}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">User Context</p>
                                            <p className="text-sm font-medium text-gray-800">{selectedError.email || 'Anonymous'}</p>
                                            {selectedError.company_name && <p className="text-xs text-gray-500">{selectedError.company_name}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Structured Metadata</h3>
                                        <pre className="bg-slate-800 border border-slate-700 p-4 rounded-lg text-xs font-mono text-green-400 whitespace-pre-wrap leading-relaxed shadow-inner overflow-x-auto">
                                            {selectedError.metadata ? JSON.stringify(selectedError.metadata, null, 2) : "No metadata available."}
                                        </pre>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xs font-bold uppercase text-gray-500">Stack Trace</h3>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(selectedError.stack_trace)}
                                                className="flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <Copy className="w-3 h-3 mr-1" /> Copy to Clipboard
                                            </button>
                                        </div>
                                        <pre className="bg-white border border-gray-200 p-4 rounded-lg text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner overflow-x-auto">
                                            {selectedError.stack_trace || "No stack trace available."}
                                        </pre>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
