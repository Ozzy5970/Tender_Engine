import os

file_path = "frontend/src/pages/TenderIngest.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Remove the useEffect block currently near the top
old_use_effect = """    useEffect(() => {
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
    }, [id, reset])"""

content = content.replace(old_use_effect, "")

# Insert the useEffect right after the useForm block
new_use_effect = """
    useEffect(() => {
        if (id) {
            setProcessStep("Loading tender details...")
            setStatus("processing")
            import("@/services/api").then(async ({ TenderService }) => {
                const res = await TenderService.getById(id)
                if (res.data) {
                    const t: any = res.data;
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

marker = "    const [watchGrade, watchClass, watchBbbee, watchPrefPoints, watchCompulsoryBriefing] = watch(['grade', 'class', 'bbbee', 'prefPoints', 'compulsoryBriefing']);"
if marker in content:
    content = content.replace(marker, marker + new_use_effect)
    with open(file_path, "w") as f:
        f.write(content)
    print("Fixed TenderIngest.tsx")
else:
    print("Could not find marker")
