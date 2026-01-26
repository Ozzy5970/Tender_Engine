// 1. Adjusted imports
import { useState, useEffect } from "react"
// ...
// 2. Fix map callback
// ...
import { AdminService } from "@/services/api"
import { Download, Loader2, ArrowLeft, UserCheck, UserX, AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function AdminSubscriptions() {
    const navigate = useNavigate()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        const { data } = await AdminService.getUsers()
        if (data) {
            setUsers(data)
        }
        setLoading(false)
    }

    // Filter Logic
    const activeSubscribers = users.filter(u => u.sub_status === 'active')
    const inactiveUsers = users.filter(u => u.sub_status !== 'active')

    const downloadCSV = () => {
        if (!users || users.length === 0) return

        const headers = ["Business Name", "Email", "Status", "Plan", "Former Subscriber"]
        const rows = users.map((u: any) => {
            const isFormer = u.has_history && u.sub_status !== 'active'
            return [
                u.company_name || "Unknown",
                u.email || "Unknown",
                u.sub_status || "free",
                u.sub_plan || "Free Plan",
                isFormer ? "Yes" : "No"
            ]
        })

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map((e: any[]) => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `subscribers_list.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const thClass = "px-4 py-3 border-b-2 border-gray-100 bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
    const tdClass = "px-4 py-3 border-b border-gray-50 text-sm text-gray-700 whitespace-nowrap"

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>

    return (
        <div className="max-w-[1600px] mx-auto py-8 px-6 space-y-10 bg-white min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate("/admin")}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Console
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Subscription Management</h1>
                    <p className="text-gray-500">Manage active and past subscriber relationships.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={downloadCSV}
                        className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 border border-transparent rounded-lg text-sm font-medium transition-colors"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export All
                    </button>
                </div>
            </div>

            {/* TABLE 1: Active Subscribers */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        Active Subscribers
                        <span className="text-sm font-normal text-gray-400 ml-2">({activeSubscribers.length})</span>
                    </h2>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={thClass}>Business Name</th>
                                <th className={thClass}>Email Address</th>
                                <th className={thClass}>Plan</th>
                                <th className={thClass}>Date Joined</th>
                                <th className={thClass}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSubscribers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        No active subscriptions found.
                                    </td>
                                </tr>
                            ) : (
                                activeSubscribers.map((u) => (
                                    <tr key={u.id} className="hover:bg-green-50/30 transition-colors">
                                        <td className={`${tdClass} font-medium`}>{u.company_name}</td>
                                        <td className={tdClass}>{u.email}</td>
                                        <td className={tdClass}>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                                                {u.sub_plan}
                                            </span>
                                        </td>
                                        {/* No Time, just Date */}
                                        <td className={tdClass}>{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td className={tdClass}>
                                            <span className="flex items-center text-green-600 font-bold text-xs">
                                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TABLE 2: Non-Active Subscribers */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <UserX className="w-5 h-5 text-gray-500" />
                        Non-Active Subscribers
                        <span className="text-sm font-normal text-gray-400 ml-2">({inactiveUsers.length})</span>
                    </h2>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className={thClass}>Business Name</th>
                                <th className={thClass}>Email Address</th>
                                <th className={thClass}>Current Status</th>
                                <th className={thClass}>History</th>
                                <th className={thClass}>Date Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inactiveUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        No inactive users found.
                                    </td>
                                </tr>
                            ) : (
                                inactiveUsers.map((u) => {
                                    const isFormer = u.has_history; // User had a sub before but not now

                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                            <td className={`${tdClass} opacity-80`}>{u.company_name}</td>
                                            <td className={`${tdClass} opacity-80`}>{u.email}</td>
                                            <td className={tdClass}>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    Free Plan
                                                </span>
                                            </td>
                                            <td className={tdClass}>
                                                {isFormer ? (
                                                    <span className="flex items-center text-orange-600 font-bold text-xs">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        Former Subscriber
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Never Subscribed</span>
                                                )}
                                            </td>
                                            <td className={`${tdClass} text-gray-500`}>{new Date(u.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
