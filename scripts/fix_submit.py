import sys

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

submit_old = "    const onSubmit: SubmitHandler<ManualFormOutput> = async (manualForm: ManualFormOutput) => {"
submit_new = "    const handleFormSubmit = async (manualForm: ManualFormOutput, isDraft: boolean = false) => {"
content = content.replace(submit_old, submit_new)

# Update the call to createManualTender inside handleFormSubmit to pass isDraft
api_old = """            const res = await TenderService.createManualTender({
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
                    cidb_grade: manualForm.cidbGrade,
                    cidb_class: manualForm.cidbClass,
                    min_bbbee_level: manualForm.minBbbeeLevel,
                    mandatory_docs: manualForm.mandatoryDocs
                }
            })"""
api_new = """            const res = await TenderService.createManualTender({
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
                    cidb_grade: manualForm.cidbGrade,
                    cidb_class: manualForm.cidbClass,
                    min_bbbee_level: manualForm.minBbbeeLevel,
                    mandatory_docs: manualForm.mandatoryDocs
                }
            }, isDraft)"""
content = content.replace(api_old, api_new)

with open(ingest_path, "w") as f: f.write(content)
