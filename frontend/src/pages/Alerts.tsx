import { useState, useEffect } from "react"
import { Info, AlertTriangle, AlertOctagon, Check, Bell, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanyService } from "@/services/api"
import { useFetch } from "@/hooks/useFetch"
import { toast } from "sonner"

type AlertSeverity = "high" | "medium" | "low" // Matches DB check constraint usually, let's map it. 
// DB says: check (priority in ('HIGH', 'MEDIUM', 'LOW'))

interface Alert {
    id: string
    priority: string // HIGH, MEDIUM, LOW
    message: string
    created_at: string
    is_read: boolean
}

export default function Alerts() {
    const [filter, setFilter] = useState<"all" | "unread">("unread")
    const { data: alertsData, loading, refetch } = useFetch(CompanyService.getAlerts, [])

    const alerts = (alertsData as Alert[]) || []
    const filteredAlerts = filter === "all" ? alerts : alerts.filter(a => !a.is_read)

    const markAsRead = async (id: string) => {
        await CompanyService.markAlertRead(id)
        refetch()
    }

    const markAllAsRead = async () => {
        await CompanyService.markAllAlertsRead()
        toast.success("All alerts marked as read")
        refetch()
    }

    const getSeverityIcon = (priority: string) => {
        switch (priority) {
            case "HIGH": return <AlertOctagon className="w-5 h-5 text-red-600" />
            case "MEDIUM": return <AlertTriangle className="w-5 h-5 text-yellow-600" />
            case "LOW": return <Info className="w-5 h-5 text-blue-600" />
            default: return <Info className="w-5 h-5 text-gray-600" />
        }
    }

    const getSeverityBg = (priority: string) => {
        switch (priority) {
            case "HIGH": return "bg-red-50 border-red-100"
            case "MEDIUM": return "bg-yellow-50 border-yellow-100"
            case "LOW": return "bg-blue-50 border-blue-100"
            default: return "bg-gray-50 border-gray-100"
        }
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    return (
        <div className="max-w-3xl mx-auto py-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Alerts & Notifications
                        {alerts.filter(a => !a.is_read).length > 0 && (
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                {alerts.filter(a => !a.is_read).length} Unread
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Stay updated on compliance and tender opportunities.</p>
                </div>

                <button
                    onClick={markAllAsRead}
                    className="text-sm font-medium text-primary hover:text-primary/80 flex items-center"
                >
                    <Check className="w-4 h-4 mr-1" />
                    Mark all as read
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setFilter("unread")}
                        className={cn(
                            "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                            filter === "unread"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        Unread
                    </button>
                    <button
                        onClick={() => setFilter("all")}
                        className={cn(
                            "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                            filter === "all"
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        All Alerts
                    </button>
                </nav>
            </div>

            <div className="space-y-4">
                {filteredAlerts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                            <Bell className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">No alerts found</h3>
                        <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
                    </div>
                ) : (
                    filteredAlerts.map(alert => (
                        <div
                            key={alert.id}
                            className={cn(
                                "relative p-4 rounded-xl border transition-all hover:shadow-sm",
                                !alert.is_read ? "bg-white border-primary/20 shadow-sm" : "bg-gray-50/50 border-gray-100 opacity-75"
                            )}
                        >
                            <div className="flex gap-4">
                                <div className={cn("p-2 rounded-lg h-fit", getSeverityBg(alert.priority))}>
                                    {getSeverityIcon(alert.priority)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 mr-4">
                                            {/* Intelligent Message Renderer */}
                                            {(() => {
                                                const parts = alert.message.split(': ')
                                                const hasTitle = parts.length > 1
                                                const title = hasTitle ? parts[0] : alert.message
                                                const body = hasTitle ? parts.slice(1).join(': ') : null

                                                return (
                                                    <div>
                                                        <h3 className={cn("text-sm font-semibold text-gray-900 flex items-center")}>
                                                            {title}
                                                            {!alert.is_read && (
                                                                <span className="ml-2 w-1.5 h-1.5 inline-block rounded-full bg-blue-600 shadow-sm"></span>
                                                            )}
                                                        </h3>
                                                        {body && (
                                                            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                                {body}
                                                            </p>
                                                        )}
                                                        {!body && (
                                                            <p className="text-xs text-gray-400 mt-1 italic">System Notification</p>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                                            {new Date(alert.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {!alert.is_read && (
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                onClick={() => markAsRead(alert.id)}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors"
                                            >
                                                Mark as read
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
