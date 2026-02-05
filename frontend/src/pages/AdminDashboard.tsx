import { useState, useEffect } from 'react'
import { Link } from "react-router-dom"
import { AdminService } from "@/services/api"
import { resilientStorage } from "@/lib/resilientStorage"
import {
    ShieldCheck, AlertTriangle, Users, Activity,
    BarChart3, Radio, ArrowRight, CheckCircle2,
    ServerCrash, Lock, ExternalLink
} from 'lucide-react'

// Minimal types for the v1 dashboard
interface SystemHealth {
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
    totalUsers: number
    errorCount24h: number
    securityEvents: number
}

// Default fallback state (Safe Mode)
const DEFAULT_HEALTH: SystemHealth = {
    status: 'HEALTHY', // Optimistic default
    totalUsers: 0,
    errorCount24h: 0,
    securityEvents: 0
}

export default function AdminDashboard() {
    // const navigate = useNavigate() // REMOVED: Unused
    const [health, setHealth] = useState<SystemHealth>(DEFAULT_HEALTH)
    const [loading, setLoading] = useState(true)
    const [isLimited, setIsLimited] = useState(false)

    const [lastUpdated, setLastUpdated] = useState<number | null>(null)

    useEffect(() => {
        loadSystemHealth()
    }, [])

    const loadSystemHealth = async () => {
        try {
            // 1. Check cache first for instant load (ResilientStorage)
            const cachedStr = await resilientStorage.getItem('admin_health_v2') // Bumped version
            if (cachedStr) {
                try {
                    const cached = JSON.parse(cachedStr)
                    // cached structure: { data: SystemHealth, timestamp: number }
                    if (cached.data && cached.timestamp) {
                        setHealth(cached.data)
                        setLastUpdated(cached.timestamp)
                        setLoading(false) // Show cached immediately
                    }
                } catch (e) {
                    console.warn("Corrupt cache", e)
                }
            }

            // 2. Fetch fresh
            // fetching getStats, but treating it as a lightweight health check
            // In a real optimized endpoint, you'd want a specific /health-check RPC
            const response = await AdminService.getStats()
            const data = response.data

            if (!data) throw new Error("No data returned from admin stats")

            // Map the heavy data to our simple View Model
            // Support both camelCase (new RPC) and snake_case (old RPC) for robustness
            const freshHealth: SystemHealth = {
                status: (data.errorCount24h > 10) ? 'CRITICAL' : (data.errorCount24h > 0) ? 'DEGRADED' : 'HEALTHY',
                totalUsers: data.totalUsers ?? data.total_users ?? 0,
                errorCount24h: data.errorCount24h ?? data.error_count ?? 0,
                securityEvents: 0
            }

            // 3. Update State & Cache
            setHealth(freshHealth)
            setLastUpdated(Date.now())
            await resilientStorage.setItem('admin_health_v2', JSON.stringify({
                data: freshHealth,
                timestamp: Date.now()
            }))

            setIsLimited(false)
        } catch (error) {
            console.warn("Health check failed, using fallback/cache", error)
            // If we have data (from cache step above) or default, we just go to limited mode
            // We rely on the initial cache load to have populated 'health' if available
            setIsLimited(true)
        } finally {
            setLoading(false)
        }
    }

    // Status Helpers
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

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-10 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Overview</h1>
                    <p className="text-gray-500 mt-2 flex items-center gap-2">
                        Admin Console
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono font-bold">v1.2</span>
                    </p>
                </div>

                {isLimited && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle className="w-4 h-4" />
                        <div className="flex flex-col md:flex-row md:items-center gap-1">
                            <span>Limited Connection (Using Cached Data)</span>
                            {lastUpdated && (
                                <span className="text-amber-700 opacity-80 text-xs md:text-sm">
                                    • Last updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Status Grid (The "Traffic Lights") */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

                {/* 1. Global System Health */}
                <div className={`p-6 rounded-2xl border-2 ${getStatusColor(health.status)} transition-all relative overflow-hidden group`}>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold uppercase tracking-wider text-sm opacity-80">System Status</h3>
                            {getStatusIcon(health.status)}
                        </div>
                        <p className="text-4xl font-black tracking-tight">{health.status}</p>
                        <p className="mt-2 text-sm opacity-90 font-medium">
                            {health.status === 'HEALTHY' ? 'All systems operational' : 'Critical errors detected'}
                        </p>
                    </div>
                    {/* Decorative bg icon */}
                    <Activity className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12" />
                </div>

                {/* 2. Operational Metrics */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm">Total Users</h3>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-4xl font-black text-gray-900 tracking-tight">
                            {loading && health.totalUsers === 0 ? '...' : health.totalUsers.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">Registered Accounts</p>
                    </div>
                    <Link to="/admin/users" className="absolute inset-0 z-20" aria-label="View Users" />
                </div>

                {/* 3. Security / Errors */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-hidden hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-sm">24h Critical Errors</h3>
                        <div className={`p-2 rounded-lg ${health.errorCount24h > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className={`text-4xl font-black tracking-tight ${health.errorCount24h > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {health.errorCount24h}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">Events requiring attention</p>
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
