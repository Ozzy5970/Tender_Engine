import { useState, useEffect } from 'react'
import { AdminService } from "@/services/api"
import {
    Activity, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, Server, Shield, Database,
    Cpu, Globe, Terminal, ArrowLeft
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
                        <Activity className="w-8 h-8 text-indigo-600" />
                        System Health Report
                    </h1>
                    <p className="text-gray-500 mt-1">Real-time diagnosis and incident logs</p>
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
            <div className={`p-8 rounded-2xl border-l-8 shadow-sm mb-8 bg-white ${health.status === 'CRITICAL' ? 'border-red-500' :
                    health.status === 'DEGRADED' ? 'border-orange-500' :
                        'border-emerald-500'
                }`}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {health.status === 'CRITICAL' ? <AlertTriangle className="w-8 h-8 text-red-600" /> :
                                health.status === 'DEGRADED' ? <AlertTriangle className="w-8 h-8 text-orange-600" /> :
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                            <h2 className="text-2xl font-bold text-gray-900">{health.summary}</h2>
                        </div>
                        <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                            Automated diagnosis indicates {health.status === 'HEALTHY' ? 'normal operation' : 'issues requiring attention'}.
                            Verification checked {timeWindow} hours of log data across all subsystems.
                        </p>

                        {/* Next Actions */}
                        {health.nextActions && health.nextActions.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recommended Actions</h4>
                                <div className="flex flex-wrap gap-2">
                                    {health.nextActions.map((action: string, i: number) => (
                                        <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            {action}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Signal Metrics */}
                    <div className="grid grid-cols-2 gap-4 min-w-[300px]">
                        <MetricCard label="Total Errors" value={health.signals.errors24h} color="text-gray-900" />
                        <MetricCard label="Critical Failures" value={health.signals.criticalErrors24h} color="text-red-600" />
                        <MetricCard label="RPC Failures" value={health.signals.rpcFailures24h} color="text-orange-600" />
                        <MetricCard label="Auth Events" value={health.signals.authFailures24h} color="text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Incidents List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Incident Log</h3>
                    <span className="text-xs font-mono text-gray-400">Showing {health.incidents.length} events</span>
                </div>

                {health.incidents.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-200 mb-4" />
                        <p>No incidents recorded in this period.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {health.incidents.map((inc: any) => (
                            <div key={inc.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Icon based on Layer */}
                                    <div className={`p-3 rounded-lg shrink-0 ${inc.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {inc.where.layer === 'DB' ? <Database className="w-5 h-5" /> :
                                            inc.where.layer === 'RPC' ? <Server className="w-5 h-5" /> :
                                                inc.where.layer === 'AUTH' ? <Shield className="w-5 h-5" /> :
                                                    inc.where.layer === 'EDGE_FUNCTION' ? <Globe className="w-5 h-5" /> :
                                                        <Terminal className="w-5 h-5" />}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{inc.title}</h4>
                                                <p className="text-sm text-gray-600 mt-1">{inc.whatHappened}</p>
                                            </div>
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(inc.lastSeenAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                                <span className="text-gray-400 text-xs uppercase font-bold px-1">Impact</span>
                                                <p className="text-gray-700 mt-1">{inc.impact}</p>
                                            </div>
                                            <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                                                <span className="text-indigo-400 text-xs uppercase font-bold px-1">Fix</span>
                                                <ul className="mt-1 list-disc list-inside text-indigo-900">
                                                    {inc.recommendedFix.map((step: string, j: number) => (
                                                        <li key={j}>{step}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Technical Context */}
                                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono">
                                            {inc.where.route && <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">Route: {inc.where.route}</span>}
                                            {inc.where.table && <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">Table: {inc.where.table}</span>}
                                            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">Layer: {inc.where.layer}</span>
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
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{label}</p>
        </div>
    )
}
