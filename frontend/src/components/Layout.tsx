import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Toaster } from "sonner"
import {
    LayoutDashboard,
    FileText,
    CheckSquare,
    Bell,
    BookOpen,
    Settings,
    Building2
} from "lucide-react"

export default function Layout() {
    const { signOut, user, isAdmin, tier } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

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
        { icon: Building2, label: "Company Profile", path: "/profile" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ]

    const ADMIN_ITEMS = [
        { icon: LayoutDashboard, label: "Admin Console", path: "/admin" },
        { icon: BookOpen, label: "Manage Templates", path: "/admin/templates" },
        // Future: { icon: Users, label: "Manage Users", path: "/admin/users" },
        { icon: Settings, label: "System Settings", path: "/settings" },
    ]

    const navItems = isAdmin ? ADMIN_ITEMS : CUSTOMER_ITEMS

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col fixed inset-y-0 z-50">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">T</div>
                        <span>TenderEngine</span>
                    </div>
                </div>

                <div className="p-4">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Main Menu
                    </div>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? "bg-primary/5 text-primary"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        }`}
                                >
                                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? "text-primary" : "text-gray-400"}`} />
                                    {item.label}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-gray-100">
                    <div className="flex items-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {isAdmin ? 'Admin' : 'User'}
                                </span>
                                {/* Tier Badge from Subscriptions */}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${tier === 'Pro' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
                                    {tier} PLAN
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-40 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">© 2026 Antigravity</span>
                        <div className="flex gap-4">
                            <a href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</a>
                            <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-50">
                            <Bell className="h-5 w-5" />
                            {/* Todo: Add real unread count */}
                        </button>
                        <div className="h-6 w-px bg-gray-200"></div>
                        <button
                            onClick={handleSignOut}
                            className="text-sm font-medium text-gray-600 hover:text-red-600"
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
