import sys
import re

# =======================================================
# 1. api.ts changes
# =======================================================
api_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/services/api.ts"
with open(api_path, "r") as f: content = f.read()

# ManualTenderData
content = content.replace(
    "preference_points?: string\n    requirements: {",
    "preference_points?: string\n    source_pdf_path?: string\n    requirements: {"
)

# Tender Interface
content = content.replace(
    "    updated_at: string\n    compliance_requirements?:",
    "    updated_at: string\n    source_pdf_path?: string\n    compliance_requirements?:"
)

# Insert logic
insert_old = """            .insert({
                user_id: user.id,
                title: data.title,
                client_name: data.client_name,
                reference_number: data.tender_number || null,
                closing_date: data.closing_date,
                status: 'ANALYZING', // Will trigger readiness check (simulated) or just set to draft
                compliance_score: 0,
                readiness: 'RED'
            })"""
insert_new = """            .insert({
                user_id: user.id,
                title: data.title,
                client_name: data.client_name,
                reference_number: data.tender_number || null,
                closing_date: data.closing_date,
                status: 'ANALYZING', // Will trigger readiness check (simulated) or just set to draft
                compliance_score: 0,
                readiness: 'RED',
                source_pdf_path: data.source_pdf_path || null
            })"""
content = content.replace(insert_old, insert_new)
with open(api_path, "w") as f: f.write(content)

# =======================================================
# 2. TenderIngest.tsx changes
# =======================================================
ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

# Add uploadedPdfPath state
state_old = """    const [ingestMode, setIngestMode] = useState<"upload" | "manual">("upload")
    const [traceId, setTraceId] = useState<string>("")"""
state_new = """    const [ingestMode, setIngestMode] = useState<"upload" | "manual">("upload")
    const [traceId, setTraceId] = useState<string>("")
    const [uploadedPdfPath, setUploadedPdfPath] = useState<string | null>(null)"""
content = content.replace(state_old, state_new)

# Set uploadedPdfPath in upload step
upload_old = """.upload(fileName, file)

            if (uploadError) throw uploadError

            setProgress(50)"""
upload_new = """.upload(fileName, file)

            if (uploadError) throw uploadError
            setUploadedPdfPath(fileName)

            setProgress(50)"""
content = content.replace(upload_old, upload_new)

# Add source_pdf_path to manual payload
payload_old = """                preference_points: manualForm.prefPoints,
                requirements: {"""
payload_new = """                preference_points: manualForm.prefPoints,
                source_pdf_path: uploadedPdfPath || undefined,
                requirements: {"""
content = content.replace(payload_old, payload_new)

# Re-inject the two buttons because they were lost before
btn_old_regex = r'<div className="flex justify-end pt-6">[\s\S]*?</button>\s*</div>'
btn_new = """<div className="flex gap-4 pt-6">
                            <button
                                type="button"
                                onClick={handleSubmit(data => handleFormSubmit(data, true))}
                                disabled={status === 'processing'}
                                className="w-1/3 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                            >
                                {status === 'processing' && processStep === 'Saving Draft...' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit(data => handleFormSubmit(data, false))}
                                disabled={status === 'processing'}
                                className="w-2/3 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center"
                            >
                                {status === 'processing' && processStep === 'Saving & Analyzing...' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Save & Run Readiness Check
                            </button>
                        </div>"""
content = re.sub(btn_old_regex, btn_new, content, count=1)
with open(ingest_path, "w") as f: f.write(content)

# =======================================================
# 3. TenderDetails.tsx changes
# =======================================================
details_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderDetails.tsx"
with open(details_path, "r") as f: content = f.read()

# Remove back button
back_btn_regex = r'<button\s*onClick=\{[^}]*\}\s*className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"\s*>\s*<ArrowLeft className="w-4 h-4 mr-2" />\s*Back to Tenders\s*</button>'
content = re.sub(back_btn_regex, "", content)

# Rename page
title_old = '<h1 className="text-3xl font-bold text-gray-900">{tender.title}</h1>'
title_new = '<h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">Tender Readiness <span className="text-xl font-medium text-gray-500 border-l border-gray-300 pl-3">{tender.title}</span></h1>'
content = content.replace(title_old, title_new)
with open(details_path, "w") as f: f.write(content)

# =======================================================
# 4. Tenders.tsx changes
# =======================================================
tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

# View PDF fix - use compliance bucket
pdf_old = ".from('tenders').createSignedUrl(t.source_pdf_path, 3600);"
pdf_new = ".from('compliance').createSignedUrl(t.source_pdf_path, 3600);"
content = content.replace(pdf_old, pdf_new)
with open(tenders_path, "w") as f: f.write(content)
