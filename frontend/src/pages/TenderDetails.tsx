import { useMemo, useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, ShieldAlert, Loader2, Zap, Trash2 } from "lucide-react"
import FeedbackModal from "@/components/FeedbackModal"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/useFetch"
import { TenderService, CompanyService } from "@/services/api"

// Helper types
interface ComparisonResult {
    name: string
    status: string
    warning?: string
    reason?: string
}

const checkDocStatus = (userDocs: any[], typeKey: string): ComparisonResult => {
    const doc = userDocs?.find((d: any) => d.doc_type === typeKey)
    if (!doc) return { status: 'fail', reason: 'Missing document', name: '' }
    if (doc.computed_status === 'expired') return { status: 'fail', reason: 'Document expired', name: '' }
    if (doc.computed_status === 'warning') return { status: 'pass', warning: 'Expiring soon', name: '' }
    return { status: 'pass', name: '' }
}

// Extended Tender interface for local usage
interface Tender {
    id: string
    title: string
    client: string
    deadline: string
    required_cidb_grade?: number
    compliance_requirements?: {
        rule_category: string
        description: string
        target_value: any
    }[]
    risks?: string[]
    strategy_tips?: string
    has_rated?: boolean
}

interface UserDocument {
    doc_type: string
    computed_status: string // 'valid' | 'expired' | 'warning'
    metadata: Record<string, any>
}

export default function TenderDetails() {
    const { id } = useParams()
    const navigate = useNavigate()

    // 1. Fetch Tender Data - useFetch logic needs to be stable or we manually manage state if we need to update it
    // Actually, useFetch returns { data, setData, ... } usually if implemented that way, or we just rely on reload
    // Let's assume useFetch doesn't expose setter. We will use a local state wrapper or just force reload.
    // Simpler: use local state initialized from fetch
    const { data: fetchedTender, loading: tenderLoading, error: tenderError } = useFetch(() => TenderService.getById(id!), [id || ''])
    const { data: userDocs, loading: docsLoading } = useFetch(CompanyService.getCompliance, [])

    const [tender, setTender] = useState<Tender | null>(null)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)

    useEffect(() => {
        if (fetchedTender) setTender(fetchedTender as any as Tender)
    }, [fetchedTender])

    const docsData = userDocs as UserDocument[] | null

    // 3. Comparison Logic
    const comparison = useMemo(() => {
        if (!tender || !docsData) return null

        const checks: ComparisonResult[] = []

        // Use dynamic requirements if available, otherwise fallback to default
        const requirements = tender.compliance_requirements || []

        // If no requirements found (legacy), use a default set for display (optional, or just show 0)
        // But for manual tenders we know we populate them.

        requirements.forEach(req => {
            // CIDB Check
            if (req.rule_category === 'CIDB') {
                const targetGrade = parseInt(req.target_value?.grade || "1")
                const userCidb = docsData.find(d => d.doc_type === 'cidb_cert')

                if (!userCidb) {
                    checks.push({ name: req.description, status: 'fail', reason: 'Missing CIDB Certificate' })
                } else if (userCidb.computed_status === 'expired') {
                    checks.push({ name: req.description, status: 'fail', reason: 'CIDB Expired' })
                } else {
                    const userGrade = parseInt(userCidb.metadata?.grade || "0")
                    if (userGrade < targetGrade) {
                        checks.push({ name: req.description, status: 'fail', reason: `Grade ${userGrade} is too low (Need ${targetGrade})` })
                    } else {
                        checks.push({ name: req.description, status: 'pass' })
                    }
                }
            }

            // BBBEE Check
            else if (req.rule_category === 'BBBEE') {
                const minLevel = req.target_value?.min_level || 8
                const userBbbee = docsData.find(d => d.doc_type === 'bbbee_cert')

                if (!userBbbee) {
                    // Not always killer, but for readiness we mark as fail/warn
                    checks.push({ name: req.description, status: 'fail', reason: 'Missing B-BBEE Certificate' })
                } else if (userBbbee.computed_status === 'expired') {
                    checks.push({ name: req.description, status: 'fail', reason: 'B-BBEE Expired' })
                } else {
                    // Lower is better for BBBEE level usually? or Higher? 
                    // Usually Level 1 is best. So userLevel <= minLevel
                    // However, the manual entry stores "min_bbbee_level". 
                    // If requirement is "Level 4", usually implies Level 1-4 are okay.
                    const userLevel = parseInt(userBbbee.metadata?.level || "8")
                    if (userLevel > minLevel) {
                        checks.push({ name: req.description, status: 'fail', reason: `Level ${userLevel} is too low (Need ${minLevel} or better)` })
                    } else {
                        checks.push({ name: req.description, status: 'pass' })
                    }
                }
            }

            // Mandatory Docs Check
            else if (req.rule_category === 'MANDATORY_DOC') {
                const requiredDocs = req.target_value?.docs || []
                requiredDocs.forEach((docKey: string) => {
                    // Map generic keys to labels if needed
                    const labelMap: Record<string, string> = {
                        'cipc_cert': 'CIPC Registration',
                        'sars_pin': 'Tax Clearance',
                        'coid_letter': 'COID Letter',
                        'uif_cert': 'UIF Registration',
                        'bank_letter': 'Bank Letter'
                    }
                    const label = labelMap[docKey] || docKey
                    const result = checkDocStatus(docsData, docKey)

                    checks.push({
                        name: label,
                        status: result.status,
                        reason: result.reason,
                        warning: result.warning
                    })
                })
            }
        })

        // If checks is empty (no requirements), avoid 0/0 NaN
        if (checks.length === 0) return { score: 0, checks: [], isReady: false }

        const passedCount = checks.filter(c => c.status === 'pass').length
        const totalCount = checks.length
        const score = Math.round((passedCount / totalCount) * 100)

        return {
            score,
            checks,
            isReady: score === 100
        }

    }, [tender, docsData])

    // Effect for Feedback Modal (Now that 'comparison' is defined below this typically, but here we place it after definition or use function hoisting? 
    // Actually React order matters for variables. Move useEffect BELOW this useMemo.)

    const score = comparison?.score || 0

    useEffect(() => {
        if (!tender || !comparison) return

        if (comparison.score === 100 && !tender.has_rated) {
            const timer = setTimeout(() => {
                setShowFeedbackModal(true)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [comparison, tender])


    if (tenderLoading || docsLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    if (tenderError || !tender) {
        return <div className="p-12 text-center text-red-600">Failed to load tender details.</div>
    }

    const isSafeToSubmit = score >= 100

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8">
            {/* Navigation & Actions */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate("/tenders")}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-900"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Tenders
                </button>

                <button
                    onClick={async () => {
                        if (window.confirm("Are you sure? This cannot be undone.")) {
                            await TenderService.deleteTender(id!)
                            navigate("/tenders")
                        }
                    }}
                    className="flex items-center px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Tender
                </button>
            </div>

            {/* Header & Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">{tender.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="font-medium text-gray-900">{tender.client}</span>
                        <span>•</span>
                        <span>Deadline: {tender.deadline || 'Pre-Tender'}</span>
                    </div>
                </div>

                {/* Score Box */}
                <div className={cn(
                    "p-6 rounded-xl border flex flex-col items-center justify-center text-center",
                    score >= 80 ? "bg-green-50 border-green-200" :
                        score >= 50 ? "bg-yellow-50 border-yellow-200" :
                            "bg-red-50 border-red-200"
                )}>
                    <span className="text-sm font-medium uppercase tracking-wider text-gray-600 mb-1">Readiness Score</span>
                    <span className={cn(
                        "text-4xl font-bold",
                        score >= 80 ? "text-green-700" :
                            score >= 50 ? "text-yellow-700" :
                                "text-red-700"
                    )}>{score}%</span>
                </div>
            </div>

            {/* Safe to Submit Indicator */}
            <div className={cn(
                "p-4 rounded-lg border flex items-start gap-4",
                isSafeToSubmit ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            )}>
                {isSafeToSubmit ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                ) : (
                    <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                    <h3 className={cn(
                        "font-bold text-lg",
                        isSafeToSubmit ? "text-green-800" : "text-red-800"
                    )}>
                        {isSafeToSubmit ? "Safe to Submit" : "Do Not Submit - Critical Issues Found"}
                    </h3>
                    <p className={cn(
                        "text-sm mt-1",
                        isSafeToSubmit ? "text-green-700" : "text-red-700"
                    )}>
                        {isSafeToSubmit
                            ? "All critical compliance checks passed. Readiness score is optimal."
                            : "There are failed compliance checks or low readiness score. Review the issues below."
                        }
                    </p>
                </div>
            </div>

            {/* Result Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Compliance Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <CheckCircle2 className="w-5 h-5 mr-2 text-primary" />
                        Compliance Checklist
                    </h2>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {comparison?.checks.map((item, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between">
                                <span className="font-medium text-gray-700">{item.name}</span>
                                <div className="flex items-center">
                                    {item.status === "pass" && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Pass</span>}
                                    {item.status === "fail" && (
                                        <div className="flex flex-col items-end">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Fail</span>
                                            {item.reason && <span className="text-[10px] text-red-600 mt-1">{item.reason}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Insights Section (Real Data) */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Zap className="w-5 h-5 mr-2 text-primary" />
                        AI Strategic Insights
                    </h2>

                    {tender.risks && tender.risks.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-600" /> Winning Strategy
                                </h3>
                                <p className="text-sm text-blue-800">{tender.strategy_tips || "Focus on price and B-BBEE level."}</p>
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-600" /> Identified Risks
                                </h3>
                                <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                                    {tender.risks.map((risk: string, i: number) => (
                                        <li key={i}>{risk}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
                            <p>No deep insights generated yet.</p>
                            <p className="mt-2 text-xs">Upload a full tender document to unlock AI strategy.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-12 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                <p className="font-semibold mb-1">DISCLAIMER: Decision Support Only</p>
                <p>
                    This platform provides decision-support tools only.
                    Final responsibility for tender submissions remains with the user.
                    AI-generated content is advisory and requires human review.
                </p>
            </div>

            <FeedbackModal
                isOpen={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                tenderId={id!}
                onSuccess={() => {
                    if (tender) setTender({ ...tender, has_rated: true })
                }}
            />
        </div>
    )
}
