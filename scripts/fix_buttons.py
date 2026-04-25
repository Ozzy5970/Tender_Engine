import sys
import re

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

# Replace the single button
btn_old = """                        <button
                            type="submit"
                            disabled={status === 'processing'}
                            className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors mt-6 flex items-center justify-center"
                        >
                            {status === 'processing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {status === 'processing' ? 'Saving & Analyzing...' : 'Save & Analyze Tender'}
                        </button>"""
btn_new = """                        <div className="flex gap-4 pt-6 mt-6">
                            <button
                                type="button"
                                onClick={handleSubmit((data) => handleFormSubmit(data, true))}
                                disabled={status === 'processing'}
                                className="w-1/3 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                            >
                                {status === 'processing' && processStep === 'Saving Draft...' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit((data) => handleFormSubmit(data, false))}
                                disabled={status === 'processing'}
                                className="w-2/3 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center"
                            >
                                {status === 'processing' && processStep === 'Creating tender record...' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Save & Run Readiness Check
                            </button>
                        </div>"""
content = content.replace(btn_old, btn_new)

# Fix onError unused warning
content = content.replace("const onError = (errors: any) => {", "const _onError = (errors: any) => {")

with open(ingest_path, "w") as f: f.write(content)
