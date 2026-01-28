import { useEffect, useState, useMemo } from "react"
import { AdminService } from "@/services/api"
import { Search, Loader2, ArrowUpDown, MoreHorizontal, FileText, CheckCircle, User } from "lucide-react"
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
                            <th className="px-6 py-4">Company / Identity</th>
                            <th className="px-6 py-4">Status Update</th>
                            <th className="px-6 py-4">Engagement</th>
                            <th className="px-6 py-4 text-right">Actions</th>
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
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0">
                                                {user.company_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{user.company_name || "Unnamed Company"}</p>
                                                <p className="text-gray-500 text-xs font-mono mt-0.5">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 w-16 text-xs">CIDB:</span>
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold font-mono">
                                                    {user.cidb_grade || "N/A"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 w-16 text-xs">B-BBEE:</span>
                                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                                                    Level {user.bbbee_level || "?"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                Joined: {new Date(user.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <FileText className="w-3.5 h-3.5 text-orange-500" />
                                                Docs: {user.doc_count || 0}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => alert("Detailed Client Profile view is coming in the next Beta release.")}
                                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                            title="View Details"
                                        >
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>
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
