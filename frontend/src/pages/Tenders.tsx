import { useState, useMemo } from "react"
import { Plus, FileText, ChevronRight, Loader2, AlertCircle, CheckCircle2, Search, Filter, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/useFetch"
import { TenderService } from "@/services/api"

type TenderStatus = "processing" | "ready" | "error" | "draft"

interface Tender {
    id: string
    title: string
    client: string
    deadline: string
    status: TenderStatus
    readinessScore?: number
}

export default function Tenders() {
    const navigate = useNavigate()

    // const { data: apiTenders, loading, error } = useFetch(TenderService.getAll)
    const { data: apiTenders } = useFetch(TenderService.getAll)

    // Using local state for now to demonstrate Filter/Search immediately
    const [tenders] = useState<Tender[]>([])

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<TenderStatus | "all">("all")

    const filteredTenders = useMemo(() => {
        // Prioritize API data if it exists and has items, otherwise fall back to mock data
        let data: Tender[] = (apiTenders && Array.isArray(apiTenders) && apiTenders.length > 0)
            ? (apiTenders as unknown as Tender[])
            : tenders

        return data.filter((t: Tender) => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.client.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesStatus = statusFilter === "all" || t.status === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [tenders, searchQuery, statusFilter, apiTenders])

    const getStatusBadge = (status: TenderStatus) => {
        switch (status) {
            case "ready":
                return <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Ready</div>
            case "processing":
                return <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</div>
            case "error":
                return <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded-full text-xs font-medium"><AlertCircle className="w-3 h-3 mr-1" /> Error</div>
            default:
                return <div className="flex items-center text-gray-700 bg-gray-50 px-2 py-1 rounded-full text-xs font-medium">Draft</div>
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tenders</h1>
                    <p className="text-sm text-gray-500">Manage your active tender opportunities.</p>
                </div>
                <button
                    onClick={() => navigate("/tenders/new")}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Tender
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by title or client..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="ready">Ready</option>
                        <option value="processing">Processing</option>
                        <option value="error">Error</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
            </div>

            {/* Tender List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {filteredTenders.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">No tenders found</h3>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or create a new tender.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredTenders.map((tender: Tender) => (
                            <div
                                key={tender.id}
                                onClick={() => navigate(`/tenders/${tender.id}`)}
                                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                                        <FileText className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{tender.title}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span>{tender.client}</span>
                                            <span>•</span>
                                            <span>Due: {tender.deadline}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {tender.readinessScore !== undefined && tender.status === 'ready' && (
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "text-sm font-bold",
                                                tender.readinessScore >= 80 ? "text-green-600" :
                                                    tender.readinessScore >= 50 ? "text-yellow-600" : "text-red-600"
                                            )}>
                                                {tender.readinessScore}%
                                            </span>
                                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Readiness</span>
                                        </div>
                                    )}

                                    <div className="min-w-[100px] flex justify-end">
                                        {getStatusBadge(tender.status)}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (window.confirm('Are you sure you want to delete this tender?')) {
                                                TenderService.deleteTender(tender.id).then(() => {
                                                    // Quick refresh logic or window reload for now
                                                    window.location.reload()
                                                })
                                            }
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
                By using this platform, you agree to our Terms of Service. All readiness scores are advisory.
            </p>
        </div>
    )
}
