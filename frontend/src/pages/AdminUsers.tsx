import { useEffect, useState, useMemo } from "react"
import { AdminService } from "@/services/api"
import { Search, Loader2, ArrowUpDown, FileText, CheckCircle } from "lucide-react"
import { motion } from "framer-motion"

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState<"date" | "name">("date")

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        const { data } = await AdminService.getUsers()
        if (data) {

            setUsers(data)
        } else {
            console.warn("AdminUsers: No users returned")
        }
        setLoading(false)
    }

    // Filter & Sort
    const filtered = useMemo(() => {
        return users
            .filter(u =>
                u.email?.toLowerCase().includes(search.toLowerCase()) ||
                u.company_name?.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => {
                if (sort === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                return (a.company_name || "").localeCompare(b.company_name || "")
            })
    }, [users, search, sort])

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
                    <p className="text-gray-500 mt-1">Monitor client activity and compliance status.</p>
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setSort(sort === "date" ? "name" : "date")}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                    >
                        <ArrowUpDown className="w-4 h-4" />
                        {sort === "date" ? "Newest First" : "Name A-Z"}
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Identity & Profile</th>
                            <th className="px-6 py-4">Tier & Verification</th>
                            <th className="px-6 py-4">Engagement</th>

                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-gray-400">
                                    No users found matching "{search}"
                                </td>
                            </tr>
                        ) : (
                            filtered.map((user, idx) => (
                                <motion.tr
                                    key={user.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="hover:bg-blue-50/30 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-sm">
                                                {(user.company_name?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-gray-900 truncate">{user.company_name || "New Company"}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <p className="text-gray-500 text-[11px] truncate">{user.full_name || user.email}</p>
                                                    {user.profile_complete ? (
                                                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" title="Profile Complete" />
                                                    ) : (
                                                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Profile Incomplete" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${user.sub_plan?.toLowerCase().includes('pro') ? 'bg-indigo-600 text-white shadow-sm' :
                                                    user.sub_plan?.toLowerCase().includes('standard') ? 'bg-blue-500 text-white' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {user.sub_plan || 'Free'}
                                                </span>

                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-gray-400">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold text-gray-600">Reg:</span> {user.registration_number ? '✓' : '×'}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold text-gray-600">Tax:</span> {user.tax_reference_number ? '✓' : '×'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <CheckCircle className={`w-3.5 h-3.5 ${user.profile_complete ? 'text-green-500' : 'text-gray-300'}`} />
                                                {user.profile_complete ? 'Profile Verified' : 'Awaiting Details'}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                Documents: {user.doc_count || 0}
                                            </div>
                                        </div>
                                    </td>


                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-center text-xs text-gray-400">
                Showing {filtered.length} client accounts
            </div>
        </div>
    )
}
