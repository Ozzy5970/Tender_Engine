import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Toaster } from "sonner"
import { useEffect, useState } from "react"
import { CompanyService } from "@/services/api"
import {
    LayoutDashboard,
    FileText,
    CheckSquare,
    Bell,
    BookOpen,
    Settings,

} from "lucide-react"

export default function Layout() {
    const { signOut, user, isAdmin, tier, companyName } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (user) fetchAlerts()
    }, [user, location.pathname])

    const fetchAlerts = async () => {
        const { data } = await CompanyService.getAlerts()
        if (data) {
            setUnreadCount((data as any[]).filter((a: any) => !a.is_read).length)
        }
    }

    const handleSignOut = async () => {
        await signOut()
        navigate("/auth")
    }

    const CUSTOMER_ITEMS = [
        { icon: LayoutDashboard, label: "Dashboard", path: "/" },
        { icon: FileText, label: "Tenders", path: "/tenders" },
        { icon: CheckSquare, label: "Compliance", path: "/compliance" },
        { icon: Bell, label: "Alerts", path: "/alerts" },
        { icon: BookOpen, label: "Templates", path: "/templates" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ]

    const ADMIN_ITEMS = [
        { icon: LayoutDashboard, label: "Admin Console", path: "/admin" },
        { icon: BookOpen, label: "Manage Templates", path: "/admin/templates" },
        { icon: Settings, label: "System Settings", path: "/settings" },
    ]

    const navItems = isAdmin ? ADMIN_ITEMS : CUSTOMER_ITEMS

    // Theme Configuration
    const getTheme = () => {
        if (tier === 'Pro' || isAdmin) {
            return {
                sidebar: 'bg-zinc-900 border-r border-zinc-800 text-zinc-100',
                sidebarHeader: 'border-b border-zinc-800',
                sidebarItem: (isActive: boolean) => isActive
                    ? "bg-purple-600/10 text-purple-400 border-l-2 border-purple-500"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
                badge: 'bg-purple-900/50 text-purple-200 border border-purple-800',
                header: 'bg-zinc-900 border-b border-zinc-800 text-zinc-100',
                bg: 'bg-zinc-900 text-zinc-300',
                mainBg: 'bg-gray-50',
                logoText: 'text-white'
            }
        }
        if (tier === 'Standard') {
            return {
                sidebar: 'bg-slate-900 border-r border-slate-800 text-slate-300',
                sidebarHeader: 'border-b border-slate-800',
                sidebarItem: (isActive: boolean) => isActive
                    ? "bg-indigo-500/10 text-indigo-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                badge: 'bg-indigo-900/50 text-indigo-200 border border-indigo-800',
                header: 'bg-white border-b border-gray-200',
                mainBg: 'bg-gray-50',
                logoText: 'text-white'
            }
        }
        // Free
        return {
            sidebar: 'bg-white border-r border-gray-200 text-gray-600',
            sidebarHeader: 'border-b border-gray-100',
            sidebarItem: (isActive: boolean) => isActive
                ? "bg-primary/5 text-primary"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            badge: 'bg-blue-50 text-blue-700',
            header: 'bg-white border-b border-gray-200',
            mainBg: 'bg-gray-50',
            logoText: 'text-gray-900'
        }
    }

    const theme = getTheme()

    return (
        <div className={`min-h-screen flex ${theme.mainBg} transition-colors duration-500`}>
            {/* Sidebar */}
            {/* Sidebar */}
            <aside className={`w-64 hidden md:flex flex-col fixed inset-y-0 z-50 transition-colors duration-500 ${theme.sidebar}`}>
                {/* Minimized spacer */}

                <div className="px-4 pb-4 pt-2">
                    <div className="px-3 py-2 text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">
                        Main Menu
                    </div>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path
                            const isAlerts = item.label === "Alerts"
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${theme.sidebarItem(isActive)}`}
                                >
                                    <div className="flex items-center">
                                        <item.icon className={`mr-3 h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
                                        {item.label}
                                    </div>
                                    {isAlerts && unreadCount > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                <div className={`mt-auto p-4 border-t transition-colors duration-500 ${tier === 'Free' ? 'border-gray-100' : 'border-white/5'}`}>
                    <div className={`flex items-center p-2 rounded-lg border ${tier === 'Free' ? 'bg-gray-50 border-gray-100' : 'bg-white/5 border-white/10'}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-medium text-sm shadow-sm shrink-0">
                            {(user?.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium truncate opacity-90 leading-tight">{user?.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                                {isAdmin ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">Admin</span>
                                ) : (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${theme.badge}`}>
                                        {tier}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className={`flex-1 md:ml-64 flex flex-col min-h-screen transition-colors duration-500`}>
                {/* Top Header */}
                <header className={`h-16 sticky top-0 z-40 px-6 flex items-center justify-between transition-colors duration-500 ${theme.header}`}>
                    <div className="flex items-center gap-3 w-1/3">
                        {/* Left Spacer */}
                    </div>

                    {/* CENTER BRANDING */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
                        {/* Logo */}
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20 shrink-0">
                            T
                        </div>

                        {/* Text Group */}
                        <div className="flex flex-col items-center justify-center">
                            <span className="font-bold text-lg tracking-tight leading-none">TenderEngine</span>
                            {companyName && (
                                <span className="text-[10px] opacity-70 uppercase tracking-widest font-medium leading-none mt-1">
                                    {companyName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 justify-end w-1/3">
                        {!isAdmin && (
                            <button
                                onClick={() => navigate('/alerts')}
                                className="relative p-2 opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-black/5"
                            >
                                <Bell className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                                )}
                            </button>
                        )}
                        <div className="h-6 w-px bg-current opacity-10"></div>
                        <button
                            onClick={handleSignOut}
                            className="text-sm font-medium opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
            <Toaster position="top-right" richColors />
        </div>
    )
}
