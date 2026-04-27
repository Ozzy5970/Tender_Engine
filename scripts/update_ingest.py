import os

file_path = "frontend/src/pages/TenderIngest.tsx"

with open(file_path, "r") as f:
    content = f.read()

# 1. Add useParams to imports
content = content.replace(
    'import { useNavigate } from "react-router-dom"',
    'import { useNavigate, useParams } from "react-router-dom"'
)

# 2. Add id and isEditMode to component
marker = "export default function TenderIngest() {"
if marker in content:
    content = content.replace(marker, marker + "\n    const { id } = useParams()\n    const isEditMode = !!id")

# 3. Add useEffect to load draft
use_effect_code = """
    useEffect(() => {
        if (id) {
            setProcessStep("Loading tender details...")
            setStatus("processing")
            import("@/services/api").then(async ({ TenderService }) => {
                const res = await TenderService.getById(id)
                if (res.data) {
                    const t = res.data;
                    const docs: Record<string, boolean> = {
                        cipc_cert: false, cidb_proof: false, sars_pin: false, csd_summary: false,
                        coid_letter: false, bbbee_cert: false, vat_reg: false, uif_letter: false,
                        paye_reg: false, bank_letter: false, sbd_6_1: false, ohs_plan: false, she_file: false
                    };
                    
                    let cidbGrade = ""; let cidbClass = ""; let minBbbee = ""; let prefPoints = "";
                    let compulsoryBriefing = false; let additionalReturnables = ""; let tenderDesc = ""; let notes = "";

                    t.compliance_requirements?.forEach((req: any) => {
                        if (req.rule_category === 'CIDB') {
                            cidbGrade = req.target_value.grade || "";
                            cidbClass = req.target_value.class || "";
                        }
                        if (req.rule_category === 'BBBEE') minBbbee = String(req.target_value.min_level || "");
                        if (req.rule_category === 'PREFERENCE_POINTS') prefPoints = req.target_value.system || "";
                        if (req.rule_category === 'COMPULSORY_BRIEFING') compulsoryBriefing = true;
                        if (req.rule_category === 'ADDITIONAL_RETURNABLE') additionalReturnables = req.target_value.text || "";
                        if (req.rule_category === 'TENDER_DESCRIPTION') tenderDesc = req.target_value.text || "";
                        if (req.rule_category === 'SPECIAL_CONDITIONS') notes = req.target_value.text || "";
                        if (req.rule_category === 'MANDATORY_DOC' && Array.isArray(req.target_value.docs)) {
                            req.target_value.docs.forEach((doc: string) => { if (doc in docs) docs[doc] = true; });
                        }
                    });

                    reset({
                        title: t.title || "",
                        client: t.client_name || "",
                        tenderNumber: t.reference_number || "",
                        tenderDescription: tenderDesc,
                        closingDate: t.closing_date ? t.closing_date.split('T')[0] : "",
                        grade: cidbGrade,
                        class: cidbClass,
                        bbbee: minBbbee,
                        prefPoints: prefPoints,
                        compulsoryBriefing: compulsoryBriefing,
                        additionalReturnables: additionalReturnables,
                        notes: notes,
                        mandatoryDocs: docs as any
                    });
                    
                    if (t.source_pdf_path) setUploadedPdfPath(t.source_pdf_path);
                    setIngestMode("manual");
                    setStatus("idle");
                } else {
                    setErrorMsg("Failed to load tender");
                    setStatus("error");
                }
            })
        }
    }, [id, reset])
"""
content = content.replace("export default function TenderIngest() {\n    const { id } = useParams()\n    const isEditMode = !!id", "export default function TenderIngest() {\n    const { id } = useParams()\n    const isEditMode = !!id\n" + use_effect_code)

# 4. Change save logic
create_logic = """const res = await TenderService.createManualTender({
                title: manualForm.title,
                client_name: manualForm.client,
                tender_number: manualForm.tenderNumber,
                tender_description: manualForm.tenderDescription,
                closing_date: manualForm.closingDate,
                compulsory_briefing: manualForm.compulsoryBriefing,
                additional_returnables: manualForm.additionalReturnables,
                notes: manualForm.notes,
                preference_points: manualForm.prefPoints,
                source_pdf_path: uploadedPdfPath || undefined,
                requirements: {
                    cidb_grade: manualForm.grade,
                    cidb_class: manualForm.class,
                    min_bbbee_level: manualForm.bbbee,
                    mandatory_docs: manualForm.mandatoryDocs ? Object.entries(manualForm.mandatoryDocs).filter(([_, v]) => v).map(([k]) => k) : []
                }
            }, isDraft)"""

update_logic = """const payload = {
                title: manualForm.title,
                client_name: manualForm.client,
                tender_number: manualForm.tenderNumber,
                tender_description: manualForm.tenderDescription,
                closing_date: manualForm.closingDate,
                compulsory_briefing: manualForm.compulsoryBriefing,
                additional_returnables: manualForm.additionalReturnables,
                notes: manualForm.notes,
                preference_points: manualForm.prefPoints,
                source_pdf_path: uploadedPdfPath || undefined,
                requirements: {
                    cidb_grade: manualForm.grade,
                    cidb_class: manualForm.class,
                    min_bbbee_level: manualForm.bbbee,
                    mandatory_docs: manualForm.mandatoryDocs ? Object.entries(manualForm.mandatoryDocs).filter(([_, v]) => v).map(([k]) => k) : []
                }
            };
            const res = (isEditMode && id)
                ? await TenderService.updateManualTender(id, payload, isDraft)
                : await TenderService.createManualTender(payload, isDraft);"""

if create_logic in content:
    content = content.replace(create_logic, update_logic)
else:
    print("Could not find create logic to replace!")

# 5. Fix UI title to show Edit
content = content.replace(
    'title: "New Tender",',
    'title: isEditMode ? "Edit Draft Tender" : "New Tender",'
)

with open(file_path, "w") as f:
    f.write(content)

print("Modified TenderIngest successfully")
