import { useState, useEffect } from "react"
import { FeedbackService } from "@/services/api"
import { ArrowLeft, Star, MessageSquare } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Skeleton } from "@/components/ui/Skeleton"

export default function AdminFeedback() {
    const navigate = useNavigate()
    const [feedback, setFeedback] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        const { data } = await FeedbackService.getHistory()
        if (data) {
            setFeedback(data as any[])
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-white min-h-screen">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                            <div className="flex justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-16 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-white min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate("/admin")}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Console
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customer Satisfaction</h1>
                    <p className="text-gray-500">Feedback from users who achieved 100% tender readiness.</p>
                </div>
            </div>

            <div className="grid gap-6">
                {feedback.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No feedback received yet.</p>
                        <p className="text-sm text-gray-400">Reviews will appear here once users rate their experience.</p>
                    </div>
                ) : (
                    feedback.map((item) => (
                        <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-gray-900">{item.company_name}</h3>
                                        <span className="text-xs text-gray-400">•</span>
                                        <span className="text-sm text-gray-500">{item.user_email}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                    <span className="font-bold text-amber-600">{item.rating}</span>
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                </div>
                            </div>

                            {item.message && (
                                <div className="bg-gray-50 p-4 rounded-lg relative">
                                    <MessageSquare className="w-4 h-4 text-gray-400 absolute top-4 left-4" />
                                    <p className="text-gray-700 text-sm pl-7 italic">"{item.message}"</p>
                                </div>
                            )}

                            {item.tender_title && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Context:</span>
                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{item.tender_title}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
