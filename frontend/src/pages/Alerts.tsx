import { useState } from "react"
import { Info, AlertTriangle, AlertOctagon, Check, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertSeverity = "critical" | "warning" | "info"

interface Alert {
    id: number
    severity: AlertSeverity
    title: string
    description: string
    date: string
    read: boolean
}

export default function Alerts() {
    const [filter, setFilter] = useState<"all" | "unread">("unread")

    // Real alerts will come from backend eventually
    const [alerts, setAlerts] = useState<Alert[]>([])

    const filteredAlerts = filter === "all" ? alerts : alerts.filter(a => !a.read)

    const markAsRead = (id: number) => {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
    }

    const markAllAsRead = () => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    }

    const getSeverityIcon = (severity: AlertSeverity) => {
        switch (severity) {
            case "critical": return <AlertOctagon className="w-5 h-5 text-red-600" />
            case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-600" />
            case "info": return <Info className="w-5 h-5 text-blue-600" />
        }
    }

    const getSeverityBg = (severity: AlertSeverity) => {
        switch (severity) {
            case "critical": return "bg-red-50 border-red-100"
            case "warning": return "bg-yellow-50 border-yellow-100"
            case "info": return "bg-blue-50 border-blue-100"
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        Alerts & Notifications
                        {alerts.filter(a => !a.read).length > 0 && (
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {alerts.filter(a => !a.read).length} Unread
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
                                !alert.read ? "bg-white border-primary/20 shadow-sm" : "bg-gray-50/50 border-gray-100 opacity-75"
                            )}
                        >
                            <div className="flex gap-4">
                                <div className={cn("p-2 rounded-lg h-fit", getSeverityBg(alert.severity))}>
                                    {getSeverityIcon(alert.severity)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className={cn("font-semibold text-gray-900", !alert.read && "text-primary")}>
                                                {alert.title}
                                                {!alert.read && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-blue-600"></span>}
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                                        </div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{alert.date}</span>
                                    </div>

                                    {!alert.read && (
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                onClick={() => markAsRead(alert.id)}
                                                className="text-xs font-medium text-gray-500 hover:text-gray-900"
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
