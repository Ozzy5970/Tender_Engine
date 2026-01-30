import { useState, useEffect } from "react"
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react"
import { LegalService } from "@/services/api"
import { TERMS_OF_SERVICE_TEXT, LEGAL_VERSION } from "@/lib/legal"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"

export default function LegalModal() {
    const { signOut, isVerified } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [accepting, setAccepting] = useState(false)

    useEffect(() => {
        if (isVerified) {
            checkStatus()
        }
    }, [isVerified])

    const checkStatus = async () => {
        const { accepted, status } = await LegalService.hasAccepted(LEGAL_VERSION)

        // If we get an unauthorized status, the ghost check likely triggered or failed.
        // AuthProvider should handle the logout, but we close modal just in case.
        if (status === 401) {
            setIsOpen(false)
            return
        }

        if (!accepted) {
            setIsOpen(true)
        }
        setLoading(false)
    }

    const handleAccept = async () => {
        setAccepting(true)
        const { error, status } = await LegalService.acceptTerms(LEGAL_VERSION)

        if (!error) {
            setIsOpen(false)
            toast.success("Terms accepted successfully")
        } else {
            console.error("Failed to accept terms:", error)
            toast.error(`Failed to record acceptance: ${error}`)

            // If it failed because user is gone, force it.
            if (status === 401) {
                await signOut()
            }
        }
        setAccepting(false)
    }

    if (loading || !isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Terms of Service Update</h2>
                        <p className="text-xs text-gray-500 font-mono">Version: {LEGAL_VERSION}</p>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                    <div className="prose prose-sm prose-gray max-w-none">
                        <ReactMarkdown>{TERMS_OF_SERVICE_TEXT}</ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
                        <p>
                            By clicking "I Accept", you acknowledge that this platform provides
                            <strong> decision support only</strong> and that you remain responsible for all final tender submissions.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            disabled={accepting}
                            className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center"
                            onClick={handleAccept}
                        >
                            {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {accepting ? "Recording..." : "I Accept Regulations & Terms"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
