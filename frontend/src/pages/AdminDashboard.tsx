import { useState, useEffect } from 'react'
import { Link } from "react-router-dom"
import { AdminService } from "@/services/api"
import { resilientStorage } from "@/lib/resilientStorage"
import { supabase } from "@/lib/supabase"
import {
    AlertTriangle, Users, Activity,
    BarChart3, Radio, ArrowRight, CheckCircle2,
    ServerCrash, Lock, ExternalLink, DollarSign
} from 'lucide-react'

// Single Source of Truth from Server RPC
interface AdminSnapshot {
    totalUsers: number
    activeUsers: number
    lifetimeRevenuePaid: number
    systemHealth: {
        status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
        errorCount24h: number
    }
    snapshotTimestamp: number // Server time
}

// Default Fallback
const DEFAULT_SNAPSHOT: AdminSnapshot = {
    totalUsers: 0,
    activeUsers: 0,
    lifetimeRevenuePaid: 0,
    systemHealth: {
        status: 'HEALTHY',
        errorCount24h: 0
    },
    snapshotTimestamp: 0
}

export default function AdminDashboard() {
    const [snapshot, setSnapshot] = useState<AdminSnapshot>(DEFAULT_SNAPSHOT)

    // Strict State Machine: 'LOADING' | 'READY' | 'DEGRADED_VIEW' | 'ERROR'
    const [status, setStatus] = useState<'LOADING' | 'READY' | 'DEGRADED_VIEW' | 'ERROR'>('LOADING')
    const [lastUpdated, setLastUpdated] = useState<number | null>(null)
    const [debugData, setDebugData] = useState<any>(null)

    // Define functions BEFORE useEffect to avoid hoisting/no-use-before-define issues
    const runDebug = async () => {
        const res: any = {}
        try {
            const { data: { user } } = await supabase.auth.getUser()
            res.userId = user?.id

            if (user?.id) {
                const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
                res.isAdminProfile = p?.is_admin

                const { data: a } = await supabase.from('admins').select('id').eq('id', user.id).single()
                res.isAdminTable = !!a

                const { data, error } = await supabase.rpc('get_admin_dashboard_snapshot')
                res.rpcResult = { data, error }
            }
        } catch (e: any) { res.error = e.message }
        setDebugData(res)
    }

    const loadDashboardSnapshot = async () => {
        // 1. Optimistic Cache Load
        try {
            const cachedStr = await resilientStorage.getItem('admin_snapshot_v1')
            if (cachedStr) {
                const cached = JSON.parse(cachedStr)
                if (cached.data && cached.timestamp) {
                    setSnapshot(cached.data)
                    setLastUpdated(cached.timestamp)
                    setStatus('READY')
                }
            }
        } catch (e) {
            console.warn("Corrupt cache", e)
        }

        // 2. Mandatory Server Verification (Single RPC)
        try {
            const { data, error } = await AdminService.getDashboardSnapshot()

            if (error) throw new Error(String(error))
            if (!data) throw new Error("Empty snapshot returned")

            // Update State with Authoritative Server Data
            setSnapshot(data)
            setLastUpdated(Date.now())
            setStatus('READY')

            // Update Cache
            await resilientStorage.setItem('admin_snapshot_v1', JSON.stringify({
                data,
                timestamp: Date.now()
            }))

        } catch (error) {
            console.warn("Snapshot fetch failed", error)

            // Resilience Logic
            if (status === 'READY') {
                // Fallback to cache if available
                setStatus('DEGRADED_VIEW')
            } else {
                // Fatal if no cache and no network
                setStatus('ERROR')
            }
        }
    }

    // Effect uses the functions defined above
    useEffect(() => {
        loadDashboardSnapshot()
        runDebug()
    }, [])

    // Helpers
    const getStatusColor = (s: string) => {
        if (s === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-200'
        if (s === 'DEGRADED') return 'bg-orange-50 text-orange-700 border-orange-200'
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }

    const getStatusIcon = (s: string) => {
        if (s === 'CRITICAL') return <ServerCrash className="w-6 h-6" />
        if (s === 'DEGRADED') return <AlertTriangle className="w-6 h-6" />
        return <CheckCircle2 className="w-6 h-6" />
    }

    if (status === 'LOADING') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-600 animate-pulse" />
                    <p className="text-gray-400 font-medium">Loading Dashboard Snapshot...</p>
                </div>
            </div>
        )
    }

    if (status === 'ERROR') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-200">
                    <div className="inline-flex p-4 bg-red-50 text-red-600 rounded-full mb-4">
                        <ServerCrash className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">System Unreachable</h2>
                    <p className="text-gray-500 mt-2 mb-6">Unable to retrieve dashboard snapshot. Please check your internet connection.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition w-full"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto font-sans">
            {/* Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Overview</h1>
                    <p className="text-gray-500 mt-2 flex items-center gap-2">
                        Admin Console
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono font-bold">v2.0 (Snapshot)</span>
                    </p>
                </div>

                {status === 'DEGRADED_VIEW' && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle className="w-4 h-4" />
                        <div className="flex flex-col md:flex-row md:items-center gap-1">
                            <span>Limited Connection (Using Cached Snapshot)</span>
                            {lastUpdated && (
                                <span className="text-amber-700 opacity-80 text-xs md:text-sm">
                                    • {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* TEMP DEBUG CARD */}
            {debugData && (
                <div className="mb-8 p-4 bg-gray-900 text-green-400 rounded-xl font-mono text-xs overflow-auto">
                    <h3 className="font-bold text-white mb-2 uppercase">Dev Debug Authorization</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p>User ID: {debugData.userId}</p>
                            <p>Profile is_admin: {String(debugData.isAdminProfile)}</p>
                            <p>Admins Table Row: {String(debugData.isAdminTable)}</p>
                        </div>
                        <div>
                            <p>RPC Result: {JSON.stringify(debugData.rpcResult)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Status Grid (The "Traffic Lights") */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">

                {/* 1. Global System Health */}
                <div className={`p-6 rounded-2xl border-2 ${getStatusColor(snapshot.systemHealth.status)} transition-all relative overflow-hidden group col-span-1 md:col-span-1`}>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold uppercase tracking-wider text-sm opacity-80">System Status</h3>
                            {getStatusIcon(snapshot.systemHealth.status)}
                        </div>
                        <p className="text-2xl font-black tracking-tight">{snapshot.systemHealth.status}</p>
                    </div>
                </div>

                {/* 2. Total Users */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm">Total Users</h3>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-4xl font-black text-gray-900 tracking-tight">
                            {snapshot.totalUsers.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">Registered Accounts</p>
                    </div>
                    <Link to="/admin/users" className="absolute inset-0 z-20" aria-label="View Users" />
                </div>

                {/* 3. Total Revenue (Paid) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm">Lifetime Revenue (Paid)</h3>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-4xl font-black text-gray-900 tracking-tight">
                            {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(snapshot.lifetimeRevenuePaid)}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">Confirmed Subscriptions</p>
                    </div>
                    <Link to="/admin/analytics" className="absolute inset-0 z-20" aria-label="View Revenue" />
                </div>

                {/* 4. Active Users (30d) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm">Active Users</h3>
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-4xl font-black text-gray-900 tracking-tight">
                            {snapshot.activeUsers.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">Active in last 30 days</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions (Navigation Hub) */}
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" />
                Management Console
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Card 1: Analytics */}
                <Link to="/admin/analytics" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Analytics & Revenue</h3>
                            <p className="text-xs text-gray-500 mt-0.5">View financial reports and charts</p>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                </Link>

                {/* Card 2: Broadcasts */}
                <Link to="/admin/broadcasts" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-lg group-hover:bg-violet-600 group-hover:text-white transition-colors">
                            <Radio className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Broadcasts</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Send system-wide alerts</p>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                </Link>

                {/* Card 3: Users */}
                <Link to="/admin/users" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-lg group-hover:bg-fuchsia-600 group-hover:text-white transition-colors">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">User Management</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Search, edit, and support users</p>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                </Link>

                {/* External: Supabase */}
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="group bg-gray-50 p-6 rounded-xl border border-gray-200 hover:bg-white hover:border-gray-400 transition-all flex items-center justify-between opacity-70 hover:opacity-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                            <ExternalLink className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Database Direct</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Open Supabase Console</p>
                        </div>
                    </div>
                </a>

            </div>
        </div>
    )
}
