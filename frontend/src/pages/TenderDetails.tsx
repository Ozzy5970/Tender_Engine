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

            const readiness = score === 100 ? "GREEN" : score >= 50 ? "AMBER" : "RED";

            const { error } = await supabase.from("tenders").update({
                compliance_score: score,
                readiness
            }).eq("id", tender.id);

            if (error) {
                console.error("Failed to update readiness score:", error, { tenderId: tender.id, attemptedScore: score, attemptedReadiness: readiness });
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
    
    
    const MissingBadge = () => <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-red-50 text-red-700 border border-red-100">Missing</span>;
    const NotCapturedBadge = () => <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-50 text-amber-700 border border-amber-100">Not Captured</span>;

    const companyProfileAny = companyProfile as any;
    const companyLocation = [
      companyProfileAny?.city,
      companyProfileAny?.province
    ].filter(Boolean).join(", ");

    const issuingEntity =
      (tender as any).client_name || tender.client || (tender as any).issuing_entity || "";

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
                        {issuingEntity ? <p className="font-medium text-gray-900">{issuingEntity}</p> : <MissingBadge />}
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Closing Date</span>
                        {dueDate ? <p className="font-medium text-gray-900">{dueDate}</p> : <NotCapturedBadge />}
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
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Company Location</span>
                            {companyLocation ? <p className="font-medium text-gray-900">{companyLocation}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Contact Name</span>
                            {(companyProfile as any)?.full_name ? <p className="font-medium text-gray-900">{(companyProfile as any).full_name}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tax Reference Number</span>
                            {((companyProfile as any)?.tax_reference_number || (companyProfile as any)?.tax_reference) ? <p className="font-medium text-gray-900">{((companyProfile as any)?.tax_reference_number || (companyProfile as any)?.tax_reference)}</p> : <NotCapturedBadge />}
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">CIPC Registration Number</span>
                            {(companyProfile as any)?.registration_number ? <p className="font-medium text-gray-900">{(companyProfile as any).registration_number}</p> : <NotCapturedBadge />}
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
                        <div className="mt-3 text-xs text-blue-800 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg text-left">
                            <span className="font-bold block mb-0.5">Readiness can be updated</span>
                            <span className="font-medium">Your current documents now produce a better readiness result. Update the stored score to reflect the latest compliance status.</span>
                        </div>
                    )}
                    
                    <button
                        onClick={handleRecalculateReadiness}
                        disabled={isRecalculating}
                        className={cn(
                            "mt-3 text-xs font-bold px-4 py-2 rounded-lg border transition-colors flex items-center justify-center min-w-[140px] shadow-sm",
                            hasScoreChanged ? "bg-primary text-white border-primary hover:bg-primary/90" :
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
                        ) : hasScoreChanged ? (
                            "Update Readiness Score"
                        ) : (
                            "Update Readiness Score"
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
                                        {sectionName === "CIDB" || sectionName === "B-BBEE" || sectionName === "CIPC" || sectionName === "Tax Clearance" || sectionName === "CSD" || sectionName === "Bank Letter" || sectionName === "COID" || sectionName === "UIF" || sectionName === "SHE File" || sectionName === "OHS Plan" || sectionName === "PAYE" || sectionName === "VAT" || sectionName === "SBD 6.1" || sectionName === "Shareholding" ? (
                                            <div className="p-5 flex flex-col sm:flex-row gap-6 justify-between items-start transition-colors hover:bg-gray-50/50">
                                                <div className="w-full flex-1 overflow-x-auto">
                                                    <table className="w-full text-left min-w-[400px]">
                                                        <thead>
                                                            <tr>
                                                                <th className="py-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">Label</th>
                                                                <th className="py-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">Required</th>
                                                                <th className="py-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">Your Company</th>
                                                                <th className="py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {items.map((item, idx) => {
                                                                if (!item) return null;
                                                                const label = item.name.replace('CIDB ', '').replace('B-BBEE ', '').replace('CIPC ', '').replace('Tax ', '').replace('CSD ', '').replace('Bank Letter ', '').replace('COID ', '').replace('UIF ', '').replace('SHE File ', '').replace('OHS Plan ', '').replace('PAYE ', '').replace('VAT ', '').replace('SBD 6.1 ', '').replace('Shareholding ', '');
                                                                return (
                                                                    <tr key={idx} className="group">
                                                                        <td className="py-3 pr-4 align-top">
                                                                            <span className="text-sm font-bold text-gray-800">{label}</span>
                                                                        </td>
                                                                        <td className="py-3 pr-4 align-top">
                                                                            <span className="text-sm text-gray-600 font-medium">{item.requirementName || "-"}</span>
                                                                        </td>
                                                                        <td className="py-3 pr-4 align-top">
                                                                            <span className={cn(
                                                                                "text-sm font-medium",
                                                                                item.status === 'pass' ? 'text-green-700' :
                                                                                item.status === 'fail' ? 'text-red-700' :
                                                                                item.status === 'warning' ? 'text-yellow-700' :
                                                                                'text-gray-800'
                                                                            )}>{item.yourData || "-"}</span>
                                                                        </td>
                                                                        <td className="py-3 align-top">
                                                                            {item.status !== 'info' ? (
                                                                                <span className={cn(
                                                                                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                                                                    item.status === 'pass' ? 'bg-green-100 text-green-800' :
                                                                                    item.status === 'fail' ? 'bg-red-100 text-red-800' :
                                                                                    item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                                                                    'bg-gray-100 text-gray-600'
                                                                                )}>
                                                                                    {item.status === 'pass' ? 'PASS' :
                                                                                     item.status === 'fail' ? 'FAIL' :
                                                                                     item.status === 'warning' ? 'WARNING' : item.status}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-400 text-xs font-medium">-</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {sectionName === "CIPC" && (() => {
                                                        const cipcItem = items.find(i => i?.docType === 'cipc_cert');
                                                        const regNum = cipcItem?.docData?.metadata?.registration_number;
                                                        if (!regNum) return null;
                                                        
                                                        const cipcStatusItem = items.find(i => i?.name === "CIPC Status");
                                                        const isPass = cipcStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Registration Number:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {regNum}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "Tax Clearance" && (() => {
                                                        const taxStatusItem = items.find(i => i?.name === "Tax Status");
                                                        const pin = taxStatusItem?.docData?.metadata?.pin;
                                                        if (!pin) return null;
                                                        
                                                        const isPass = taxStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">PIN:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {pin}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    
                                                    {sectionName === "CSD" && (() => {
                                                        const csdStatusItem = items.find(i => i?.name === "CSD Status");
                                                        const maaa = csdStatusItem?.docData?.metadata?.maaa_number;
                                                        if (!maaa) return null;
                                                        
                                                        const isPass = csdStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">MAAA Number:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {maaa}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "Bank Letter" && (() => {
                                                        const bankStatusItem = items.find(i => i?.name === "Bank Letter Status");
                                                        const meta = bankStatusItem?.docData?.metadata || {};
                                                        const bankName = meta.bank_name || meta.bankName || meta.bank;
                                                        if (!bankName) return null;
                                                        
                                                        const isPass = bankStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Bank Name:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {bankName}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "COID" && (() => {
                                                        const coidStatusItem = items.find(i => i?.name === "COID Status");
                                                        const meta = coidStatusItem?.docData?.metadata || {};
                                                        const ref = meta.coid_reference || meta.coida_reference || meta.reference || meta.reference_number;
                                                        if (!ref) return null;
                                                        
                                                        const isPass = coidStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">COID Reference:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {ref}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "UIF" && (() => {
                                                        const uifStatusItem = items.find(i => i?.name === "UIF Status");
                                                        const meta = uifStatusItem?.docData?.metadata || {};
                                                        const ref = meta.uif_reference || meta.uif_ref || meta.reference || meta.reference_number || meta.uif_number;
                                                        if (!ref) return null;
                                                        
                                                        const isPass = uifStatusItem?.status === "pass";
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                                                                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">UIF Reference:</span>
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    isPass ? "text-green-700" : "text-gray-700"
                                                                )}>
                                                                    {ref}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "SHE File" && (() => {
                                                        const sheStatusItem = items.find(i => i?.name === "SHE File Status");
                                                        const meta = sheStatusItem?.docData?.metadata || {};
                                                        const isPass = sheStatusItem?.status === "pass";
                                                        
                                                        const version = meta.document_version || meta.version || meta.file_version;
                                                        
                                                        if (!version) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Version:</span>
                                                                    <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{version}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "OHS Plan" && (() => {
                                                        const ohsStatusItem = items.find(i => i?.name === "OHS Plan Status");
                                                        const meta = ohsStatusItem?.docData?.metadata || {};
                                                        const isPass = ohsStatusItem?.status === "pass";
                                                        
                                                        const planNumber = meta.plan_number || meta.planNo || meta.ohs_plan_number || meta.document_number;
                                                        
                                                        if (!planNumber) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Plan Number:</span>
                                                                    <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{planNumber}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "PAYE" && (() => {
                                                        const payeStatusItem = items.find(i => i?.name === "PAYE Status");
                                                        const meta = payeStatusItem?.docData?.metadata || {};
                                                        const isPass = payeStatusItem?.status === "pass";
                                                        
                                                        const payeNumber = meta.paye_number || meta.paye_no || meta.reference || meta.reference_number || meta.registration_number;
                                                        
                                                        if (!payeNumber) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">PAYE Number:</span>
                                                                    <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{payeNumber}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "VAT" && (() => {
                                                        const vatStatusItem = items.find(i => i?.name === "VAT Status");
                                                        const meta = vatStatusItem?.docData?.metadata || {};
                                                        const isPass = vatStatusItem?.status === "pass";
                                                        
                                                        const vatNumber = meta.vat_number || meta.vat_no || meta.vat_registration_number || meta.reference || meta.reference_number || meta.registration_number;
                                                        
                                                        if (!vatNumber) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">VAT Number:</span>
                                                                    <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{vatNumber}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "Shareholding" && (() => {
                                                        const shareStatusItem = items.find(i => i?.name === "Shareholding Status");
                                                        const meta = shareStatusItem?.docData?.metadata || {};
                                                        const isPass = shareStatusItem?.status === "pass";
                                                        
                                                        const shareholder = meta.shareholder_name;
                                                        
                                                        if (!shareholder) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Shareholder:</span>
                                                                    <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{shareholder}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {sectionName === "SBD 6.1" && (() => {
                                                        const sbdStatusItem = items.find(i => i?.name === "SBD 6.1 Status");
                                                        const meta = sbdStatusItem?.docData?.metadata || {};
                                                        const isPass = sbdStatusItem?.status === "pass";
                                                        
                                                        const signatory = meta.authorized_signatory || meta.signatory || meta.signed_by;
                                                        const signatureDate = meta.signature_date || meta.signed_date || meta.date_signed;
                                                        
                                                        if (!signatory && !signatureDate) return null;
                                                        
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2">
                                                                {signatory && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Authorized Signatory:</span>
                                                                        <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{signatory}</span>
                                                                    </div>
                                                                )}
                                                                {signatureDate && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Signature Date:</span>
                                                                        <span className={cn("text-sm font-medium", isPass ? "text-green-700" : "text-gray-700")}>{signatureDate}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {items.some(i => i?.message && i.status !== 'pass' && i.status !== 'info') && (
                                                        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                                                            {items.map((item, idx) => {
                                                                if (!item || !item.message || item.status === 'pass' || item.status === 'info') return null;
                                                                const label = item.name.replace('CIDB ', '').replace('B-BBEE ', '').replace('CIPC ', '').replace('Tax ', '').replace('CSD ', '').replace('Bank Letter ', '').replace('COID ', '').replace('UIF ', '').replace('SHE File ', '').replace('OHS Plan ', '').replace('PAYE ', '').replace('VAT ', '').replace('SBD 6.1 ', '').replace('Shareholding ', '');
                                                                return (
                                                                    <p key={`msg-${idx}`} className={cn(
                                                                        "text-xs font-medium",
                                                                        item.status === 'fail' ? 'text-red-600' : 'text-yellow-700'
                                                                    )}>
                                                                        <span className="font-bold mr-1">{label}:</span> {item.message}
                                                                    </p>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {(() => {
                                                    const actionItem = items.find(i => i?.status === 'fail' && i.actionHint) || 
                                                                       items.find(i => i?.status === 'warning' && i.actionHint) ||
                                                                       items.find(i => i?.actionHint);
                                                    if (!actionItem) return null;
                                                    return (
                                                        <div className="shrink-0 mt-4 sm:mt-0">
                                                            {actionItem.actionType ? (
                                                                <button 
                                                                    onClick={() => handleActionClick(actionItem)}
                                                                    className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                                                                >
                                                                    <Zap className="w-3.5 h-3.5"/> {actionItem.actionHint}
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap">
                                                                    <Zap className="w-3.5 h-3.5"/> {actionItem.actionHint}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                        items.map((item, idx) => {
                                            if (!item) return null;
                                            return (
                                                <div key={idx} className={cn(
                                                    "py-3 px-5 flex flex-col sm:flex-row gap-4 justify-between items-start transition-colors hover:bg-gray-50/50",
                                                    item.status === 'pass' ? 'border-l-4 border-l-green-400' :
                                                    item.status === 'fail' ? 'border-l-4 border-l-red-400' :
                                                    item.status === 'warning' ? 'border-l-4 border-l-yellow-400' :
                                                    ''
                                                )}>
                                                    <div className="space-y-1.5 flex-1 w-full">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-gray-900 text-sm">{item.name || "Requirement"}</h4>
                                                            <span className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                                                item.status === 'pass' ? 'bg-green-100 text-green-800' :
                                                                item.status === 'fail' ? 'bg-red-100 text-red-800' :
                                                                item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-600'
                                                            )}>{item.status || "INFO"}</span>
                                                        </div>
                                                        {item.status === 'info' ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider block">Tender Requirement:</span>
                                                                <span className="font-medium text-gray-800 text-sm">{item.requirementName || item.yourData || "-"}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col sm:flex-row sm:gap-6 gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider block">Required:</span>
                                                                    <span className="font-medium text-gray-800 text-sm">{item.requirementName || "-"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider block">Your Company:</span>
                                                                    <span className="font-medium text-gray-800 text-sm">{item.yourData || "-"}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.message && (
                                                            <p className={cn(
                                                                "text-sm mt-1",
                                                                item.status === 'fail' ? 'text-red-600 font-medium' :
                                                                item.status === 'warning' ? 'text-yellow-700 font-medium' :
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
                                        })
                                        )}
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
