import { useState, useEffect } from 'react'
import { AdminService } from "@/services/api"
import {
    AlertTriangle, CheckCircle2,
    Clock, RefreshCw, ServerCrash, ArrowLeft, Info
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminHealth() {
    const [health, setHealth] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [timeWindow, setTimeWindow] = useState(24)

    useEffect(() => {
        loadHealth()
    }, [timeWindow])

    const loadHealth = async () => {
        setLoading(true)
        const { data } = await AdminService.getSystemHealth(timeWindow)
        if (data) setHealth(data)
        setLoading(false)
    }

    if (loading) return (
        <div className="p-8 flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-gray-500">Diagnosing system status...</p>
            </div>
        </div>
    )

    if (!health) return <div className="p-8 text-red-600">Failed to load health report.</div>

    return (
        <div className="max-w-6xl mx-auto p-8 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link to="/admin" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ServerCrash className="w-8 h-8 text-indigo-600" />
                        System Diagnostics
                    </h1>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    {[1, 24, 168].map(h => (
                        <button
                            key={h}
                            onClick={() => setTimeWindow(h)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeWindow === h
                                ? 'bg-indigo-50 text-indigo-600 font-bold'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {h === 1 ? '1 Hour' : h === 168 ? '7 Days' : '24 Hours'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Status Card */}
            <div className={`p-8 rounded-2xl border-l-8 shadow-sm mb-8 bg-white ${health.summary.status === 'CRITICAL' ? 'border-red-500' :
                health.summary.status === 'DEGRADED' ? 'border-orange-500' :
                    'border-emerald-500'
                }`}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {health.summary.status === 'CRITICAL' ? <AlertTriangle className="w-8 h-8 text-red-600" /> :
                                health.summary.status === 'DEGRADED' ? <AlertTriangle className="w-8 h-8 text-orange-600" /> :
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                            <h2 className="text-2xl font-bold text-gray-900">
                                System is {health.summary.status}
                            </h2>
                        </div>
                        <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                            {health.summary.status === 'HEALTHY'
                                ? "All systems operational. No critical anomalies detected."
                                : "System performance is impacted by elevated error rates."}
                        </p>
                    </div>

                    {/* Signal Metrics */}
                    <div className="grid grid-cols-3 gap-4 min-w-[300px]">
                        <MetricCard label="Total Errors" value={health.summary.errorCount24h} color="text-gray-900" />
                        <MetricCard label="Critical" value={health.summary.criticalCount24h} color="text-red-600" />
                        <MetricCard label="Warnings" value={health.summary.warningCount24h} color="text-orange-600" />
                    </div>
                </div>
            </div>

            {/* Incidents List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Recent Incident Log</h3>
                    <span className="text-xs font-mono text-gray-400">Showing {health.recent.length} events</span>
                </div>

                {health.recent.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-200 mb-4" />
                        <p>No incidents recorded in this period.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {health.recent.map((inc: any) => (
                            <div key={inc.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg shrink-0 ${inc.severity === 'critical' ? 'bg-red-50 text-red-600' :
                                        inc.severity === 'warning' ? 'bg-orange-50 text-orange-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                        {inc.severity === 'critical' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 font-mono text-sm">{inc.message}</h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    ID: {inc.id} | User: {inc.userId || 'System/Anon'}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(inc.createdAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="mt-2 text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                            LOCATION: {inc.where || 'Unknown'} {inc.requestId && `| REQ: ${inc.requestId}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function MetricCard({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{label}</p>
        </div>
    )
}
