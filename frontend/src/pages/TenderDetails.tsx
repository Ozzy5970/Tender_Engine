import { useMemo, useState, useEffect, useRef } from "react"
import { useParams, useLocation } from "react-router-dom"
import { CheckCircle2, ShieldAlert, Loader2, Zap, Pencil, Building2, FileText } from "lucide-react"
import FeedbackModal from "@/components/FeedbackModal"
import DocumentUploadModal from "@/components/DocumentUploadModal"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/useFetch"
import { TenderService, CompanyService } from "@/services/api"
import { supabase } from "@/lib/supabase"
import { formatTenderDate } from "@/lib/dateUtils"

import { calculateReadinessScore, type ComparisonResult } from "@/lib/readiness"

// Extended Tender interface for local usage
interface Tender {
    id: string
    title: string
    client: string
    deadline: string
    closing_date?: string
    location?: string
    required_cidb_grade?: number
    compliance_requirements?: {
        rule_category: string
        description: string
        target_value: any
    }[]
    risks?: string[]
    strategy_tips?: string
    has_rated?: boolean
    readinessScore?: number
    status?: string
}


interface UserDocument {
    doc_type: string
    computed_status: string // 'valid' | 'expired' | 'warning'
    metadata: Record<string, any>
}

export default function TenderDetails() {
    const { id } = useParams()


    // 1. Fetch Tender Data - useFetch logic needs to be stable or we manually manage state if we need to update it
    // Actually, useFetch returns { data, setData, ... } usually if implemented that way, or we just rely on reload
    // Let's assume useFetch doesn't expose setter. We will use a local state wrapper or just force reload.
    // Simpler: use local state initialized from fetch
    const { data: fetchedTender, loading: tenderLoading, error: tenderError } = useFetch(() => TenderService.getById(id!), [id || ''])
    const { data: userDocs, loading: docsLoading, refetch: refetchDocs } = useFetch(CompanyService.getCompliance, [])
    const { data: companyProfile, loading: profileLoading } = useFetch(CompanyService.getProfile, [])

    const [tender, setTender] = useState<Tender | null>(null)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [isRecalculating, setIsRecalculating] = useState(false)
    const [updateStatus, setUpdateStatus] = useState<"success" | "error" | null>(null)
    
    // Upload Modal State
    const [uploadModalState, setUploadModalState] = useState<{
        isOpen: boolean;
        docType: string;
        title: string;
        category: string;
        existingDoc: boolean;
        initialData?: any;
    }>({ isOpen: false, docType: '', title: '', category: 'COMPLIANCE', existingDoc: false });

    // Edit mode state
    const location = useLocation()
    const [isEditingRequirements, setIsEditingRequirements] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const [isSavingRequirements, setIsSavingRequirements] = useState(false)
    
    // UX Feedback State
    const [actionFeedback, setActionFeedback] = useState<string | null>(null)
    const [pendingEditScroll, setPendingEditScroll] = useState(false)
    const [highlightEditSection, setHighlightEditSection] = useState(false)
    const editSectionRef = useRef<HTMLDivElement | null>(null)
    

    useEffect(() => {
        if (pendingEditScroll && isEditingRequirements && editSectionRef.current) {
            editSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setPendingEditScroll(false);
            setHighlightEditSection(true);
            setTimeout(() => setHighlightEditSection(false), 1800);
        }
    }, [pendingEditScroll, isEditingRequirements]);

    useEffect(() => {
        if (tender) {
            setEditForm({ title: tender.title, client: tender.client })
        }
    }, [tender])
    
    useEffect(() => {
        if (tender?.status === 'DRAFT' || tender?.status === 'draft' || location.search.includes('edit=true')) {
            setIsEditingRequirements(true);
        }
    }, [tender?.status, location.search]);


    useEffect(() => {
        if (fetchedTender) setTender(fetchedTender as any as Tender)
    }, [fetchedTender])

    const docsData = userDocs as UserDocument[] | null




    const handleActionClick = (item: ComparisonResult) => {
        if (item.actionType === 'EDIT') {
            setActionFeedback('Editing tender requirements');
            setTimeout(() => setActionFeedback(null), 2500);
            setIsEditingRequirements(true);
            setPendingEditScroll(true);
            return;
        }

        if (!item.docType) return;
        
        setActionFeedback(`Opening ${item.actionType === 'REPLACE' ? 'replace' : 'upload'} for: ${item.name}`);
        setTimeout(() => setActionFeedback(null), 2500);
        
        setUploadModalState({
            isOpen: true,
            docType: item.docType,
            title: `${item.actionType === 'REPLACE' ? 'Replace' : 'Upload'} ${item.name}`,
            category: 'COMPLIANCE',
            existingDoc: item.actionType === 'REPLACE',
            initialData: item.docData
        });
    }

    const comparison = useMemo(() => {
        if (!tender || !docsData) return null
        return calculateReadinessScore(tender, docsData);
    }, [tender, docsData])

    const score = comparison?.score ?? null;

    useEffect(() => {
        if (!tender || !comparison) return

        if (comparison.score === 100 && !tender.has_rated) {
            const timer = setTimeout(() => {
                setShowFeedbackModal(true)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [comparison, tender])

    const handleRecalculateReadiness = async () => {
        if (!tender || !comparison) return;

        setIsRecalculating(true);
        setUpdateStatus(null);
        try {
            const score = comparison.score;

            if (typeof score !== "number") {
                setUpdateStatus("error");
                setIsRecalculating(false);
                return;
            }

            const readiness = score === 100 ? "READY" : score >= 50 ? "AMBER" : "RED";

            const { error } = await supabase.from("tenders").update({
                compliance_score: score,
                readiness
            }).eq("id", tender.id);

            if (error) {
                console.error("Failed to update readiness score:", error);
                setUpdateStatus("error");
                throw error;
            }

            setTender(prev => prev ? {
                ...prev,
                readinessScore: score,
                compliance_score: score,
                readiness
            } : prev);
            
            setUpdateStatus("success");
            setTimeout(() => setUpdateStatus(null), 3000); // Clear success message after 3 seconds
        } catch (error) {
            console.error("Failed to recalculate readiness:", error);
            setUpdateStatus("error");
        } finally {
            setIsRecalculating(false);
        }
    };

    const groupedChecks = useMemo(() => {
        if (!comparison?.checks || !Array.isArray(comparison.checks)) return {};
        return comparison.checks.reduce((acc, check) => {
            if (!check) return acc;
            const section = check.section || 'Other Requirements';
            if (!acc[section]) acc[section] = [];
            acc[section].push(check);
            return acc;
        }, {} as Record<string, ComparisonResult[]>);
    }, [comparison?.checks]);

    const failCount = comparison?.checks?.filter(c => c.status === 'fail').length || 0;
    const warningCount = comparison?.checks?.filter(c => c.status === 'warning').length || 0;

    if (tenderLoading || docsLoading || profileLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    if (tenderError || !tender) {
        return <div className="p-12 text-center text-red-600">Failed to load tender details.</div>
    }


    const dueDate = formatTenderDate(
        tender.closing_date || tender.deadline
    );

    const tenderDescReq = tender.compliance_requirements?.find(r => r.rule_category === 'TENDER_DESCRIPTION');
    const specialCondReq = tender.compliance_requirements?.find(r => r.rule_category === 'SPECIAL_CONDITIONS');
    const briefingReq = tender.compliance_requirements?.find(r => r.rule_category === 'COMPULSORY_BRIEFING');

    const tenderDescription = tenderDescReq?.target_value?.text || tenderDescReq?.description;
    const specialConditions = specialCondReq?.target_value?.text || specialCondReq?.description;
    const briefingRequired = !!briefingReq;
    const briefingDate = briefingReq?.target_value?.date;
    const briefingDetails = briefingReq?.target_value?.details;
    
    const cidbDoc = docsData?.find(d => d.doc_type === 'cidb_cert');
    const userCidbGrade = cidbDoc?.metadata?.grade;
    const userCidbClass = cidbDoc?.metadata?.class;
    
    const MissingBadge = () => <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-red-50 text-red-700 border border-red-100">Missing</span>;
    const NotCapturedBadge = () => <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-50 text-amber-700 border border-amber-100">Not Captured</span>;

    const hasScoreChanged =
        comparison &&
        tender &&
        comparison.score !== tender.readinessScore;

    return (
        <div className="max-w-4xl mx-auto pt-2 pb-8 space-y-6">
            {/* SECTION 1 - Tender Basics */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">Tender Basics / Capture Completeness</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-7">Context only. These fields do not affect the readiness score.</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tender Title</span>
                        {tender.title && tender.title !== 'Untitled Tender' ? <p className="font-medium text-gray-900">{tender.title}</p> : <MissingBadge />}
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Issuing Entity / Client</span>
                        {tender.client ? <p className="font-medium text-gray-900">{tender.client}</p> : <MissingBadge />}
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Closing Date</span>
                        {dueDate ? <p className="font-medium text-gray-900">{dueDate}</p> : <NotCapturedBadge />}
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Location</span>
                        {tender.location ? <p className="font-medium text-gray-900">{tender.location}</p> : <NotCapturedBadge />}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tender Description / Scope</span>
                        {tenderDescription ? <p className="font-medium text-gray-900">{tenderDescription}</p> : <NotCapturedBadge />}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Special Conditions / Notes</span>
                        {specialConditions ? <p className="font-medium text-gray-900">{specialConditions}</p> : <NotCapturedBadge />}
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Compulsory Briefing</span>
                        {briefingRequired ? <p className="font-medium text-gray-900">Required</p> : <p className="font-medium text-gray-900">Not Required</p>}
                    </div>
                    {briefingRequired && (
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Briefing Details</span>
                            <p className="font-medium text-gray-900">
                                {briefingDate ? `${briefingDate} ` : ""}
                                {briefingDetails ? `- ${briefingDetails}` : (briefingDate ? "" : <NotCapturedBadge />)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Middle Row: Profile & Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                
                {/* SECTION 2 - Company Profile Summary */}
                <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">Company Profile Summary</h2>
                    </div>
                    <div className="p-5 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Company Name</span>
                            {(companyProfile as any)?.company_name ? <p className="font-medium text-gray-900">{(companyProfile as any).company_name}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Company Address</span>
                            {(companyProfile as any)?.company_address ? <p className="font-medium text-gray-900">{(companyProfile as any).company_address}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Contact Name</span>
                            {(companyProfile as any)?.full_name ? <p className="font-medium text-gray-900">{(companyProfile as any).full_name}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tax Reference Number</span>
                            {(companyProfile as any)?.tax_number ? <p className="font-medium text-gray-900">{(companyProfile as any).tax_number}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">CIDB Registration</span>
                            {userCidbGrade ? <p className="font-medium text-gray-900">Grade {userCidbGrade}{userCidbClass ? ` ${userCidbClass}` : ''}</p> : <NotCapturedBadge />}
                        </div>
                    </div>
                </div>

                {/* Readiness Score Card */}
                <div className={cn(
                    "p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center text-center transition-all",
                    score !== null && score >= 80 ? "bg-green-50 border-green-200" :
                        score !== null && score >= 50 ? "bg-yellow-50 border-yellow-200" :
                            "bg-gray-50 border-gray-200"
                )}>
                    <span className="text-sm font-medium uppercase tracking-wider text-gray-600 mb-1">Readiness Score</span>
                    <span className={cn(
                        "text-4xl font-bold",
                        score !== null && score >= 80 ? "text-green-700" :
                            score !== null && score >= 50 ? "text-yellow-700" :
                                score !== null ? "text-red-700" : "text-gray-400"
                    )}>{score !== null ? `${score}%` : 'N/A'}</span>
                    
                    {hasScoreChanged && (
                        <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg font-medium">
                            Your compliance status has improved. Recalculate readiness.
                        </div>
                    )}
                    
                    <button
                        onClick={handleRecalculateReadiness}
                        disabled={isRecalculating}
                        className={cn(
                            "mt-3 text-xs font-medium px-4 py-2 rounded-lg border transition-colors flex items-center justify-center min-w-[140px] shadow-sm",
                            score === 100 && hasScoreChanged ? "bg-primary text-white border-primary hover:bg-primary/90" :
                            score !== null && score >= 80 ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" :
                            score !== null && score >= 50 ? "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200" :
                            score !== null ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-200" : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
                            isRecalculating && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {isRecalculating ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Updating...
                            </>
                        ) : score === 100 && hasScoreChanged ? (
                            "Finalise Readiness"
                        ) : (
                            "Recalculate Readiness"
                        )}
                    </button>
                    {updateStatus === 'success' && (
                        <div className="mt-2 text-xs text-green-600 font-medium">Saved readiness score updated</div>
                    )}
                    {updateStatus === 'error' && (
                        <div className="mt-2 text-xs text-red-600 font-medium">Could not update readiness score</div>
                    )}
                </div>
            </div>

                        {score !== null && (
                <div className={cn("px-4 py-3 rounded-lg border text-sm font-medium flex items-center gap-2.5", 
                    failCount > 0 ? "bg-red-50 border-red-200 text-red-800" :
                    warningCount > 0 ? "bg-amber-50 border-amber-200 text-amber-800" :
                    "bg-green-50 border-green-200 text-green-800"
                )}>
                    {failCount > 0 || warningCount > 0 ? <ShieldAlert className={cn("w-4 h-4 shrink-0", failCount > 0 ? "text-red-600" : "text-amber-600")} /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />}
                    <span>
                        {failCount > 0 
                            ? `You have ${failCount} issue${failCount !== 1 ? 's' : ''} to fix before this tender is ready.` 
                            : warningCount > 0
                            ? `You have ${warningCount} item${warningCount !== 1 ? 's' : ''} to review.`
                            : "All requirements met. Ready to submit."}
                    </span>
                </div>
            )}

            {/* Result Columns */}
            <div className="w-full">
                {/* Compliance Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <CheckCircle2 className="w-5 h-5 mr-2 text-primary" />
                            Compliance Comparison
                        </h2>
                        {isEditingRequirements && (
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                                EDIT MODE ENABLED
                            </div>
                        )}
                        {actionFeedback && (
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 animate-pulse transition-opacity">
                                {actionFeedback}
                            </div>
                        )}
                    </div>
                    {Object.keys(groupedChecks).length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                            <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="font-bold text-gray-900 text-lg">No requirements found</h3>
                            <p className="text-gray-500 mt-1">Edit the tender to add compliance requirements.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedChecks).map(([sectionName, items]) => (
                                <div key={sectionName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                                        <h3 className="font-bold text-gray-900">{sectionName}</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {items.map((item, idx) => {
                                            if (!item) return null;
                                            return (
                                                <div key={idx} className={cn(
                                                    "p-5 flex flex-col sm:flex-row gap-4 justify-between items-start transition-colors hover:bg-gray-50/50",
                                                    item.status === 'pass' ? 'border-l-4 border-l-green-400' :
                                                    item.status === 'fail' ? 'border-l-4 border-l-red-400' :
                                                    item.status === 'warning' ? 'border-l-4 border-l-yellow-400' :
                                                    ''
                                                )}>
                                                    <div className="space-y-3 flex-1 w-full">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-gray-900">{item.name || "Requirement"}</h4>
                                                            <span className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                                                item.status === 'pass' ? 'bg-green-100 text-green-800' :
                                                                item.status === 'fail' ? 'bg-red-100 text-red-800' :
                                                                item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-600'
                                                            )}>{item.status || "INFO"}</span>
                                                        </div>
                                                        {item.status === 'info' ? (
                                                            <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Tender Requirement</span>
                                                                <span className="font-medium text-gray-800 text-sm">{item.requirementName || item.yourData || "-"}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                                <div>
                                                                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Required</span>
                                                                    <span className="font-medium text-gray-800 text-sm">{item.requirementName || "-"}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Your Company</span>
                                                                    <span className="font-medium text-gray-800 text-sm">{item.yourData || "-"}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.message && (
                                                            <p className={cn(
                                                                "text-sm font-medium",
                                                                item.status === 'fail' ? 'text-red-600' :
                                                                item.status === 'warning' ? 'text-yellow-700' :
                                                                item.status === 'pass' ? 'text-green-700' : 'text-gray-600'
                                                            )}>{item.message}</p>
                                                        )}
                                                    </div>
                                                    {(item.actionHint) && (
                                                        <div className="shrink-0 mt-3 sm:mt-0">
                                                            {item.actionType ? (
                                                                <button 
                                                                    onClick={() => handleActionClick(item)}
                                                                    className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                                                                >
                                                                    <Zap className="w-3.5 h-3.5"/> {item.actionHint}
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap">
                                                                    <Zap className="w-3.5 h-3.5"/> {item.actionHint}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Inline Edit Requirements Block */}
                    {isEditingRequirements && (
                        <div ref={editSectionRef} className={cn("mt-8 bg-white border rounded-xl overflow-hidden transition-all", highlightEditSection ? "ring-2 ring-primary/40 bg-primary/5 border-primary/40 shadow-md" : "border-gray-200 shadow-sm")}>
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                    <Pencil className="w-4 h-4" /> Edit Tender Details
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditingRequirements(false)}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsSavingRequirements(true);
                                            try {
                                                await import('@/lib/supabase').then(async ({supabase}) => {
                                                    await supabase.from('tenders').update({
                                                        title: editForm.title,
                                                        client: editForm.client
                                                    }).eq('id', tender.id);
                                                });
                                                setTender(prev => prev ? { ...prev, title: editForm.title, client: editForm.client } : prev);
                                                setIsEditingRequirements(false);
                                            } catch (e) {
                                                console.error(e);
                                            } finally {
                                                setIsSavingRequirements(false);
                                            }
                                        }}
                                        disabled={isSavingRequirements}
                                        className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        {isSavingRequirements ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/> : null}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-500 mb-1 text-xs">Tender Title</label>
                                    <input type="text" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 mb-1 text-xs">Client Name</label>
                                    <input type="text" value={editForm.client || ''} onChange={e => setEditForm({...editForm, client: e.target.value})} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div className="md:col-span-2 text-xs text-gray-500 mt-2">
                                    <p>Note: Compliance rules (CIDB, B-BBEE, Documents) must be updated via the "Recalculate Readiness" engine or by fixing individual items in the Compliance Comparison table above.</p>
                                </div>
                            </div>
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

            <DocumentUploadModal
                isOpen={uploadModalState.isOpen}
                onClose={() => setUploadModalState(prev => ({ ...prev, isOpen: false }))}
                onSuccess={() => {
                    setUploadModalState(prev => ({ ...prev, isOpen: false }));
                    refetchDocs();
                    // Let the user click Recalculate Readiness manually as per Step 4 UX flow
                }}
                category={uploadModalState.category}
                docType={uploadModalState.docType}
                title={uploadModalState.title}
                existingDoc={uploadModalState.existingDoc}
                initialData={uploadModalState.initialData}
            />
        </div>
    )
}
