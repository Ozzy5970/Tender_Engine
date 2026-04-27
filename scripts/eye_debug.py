import sys

tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

# 1. Add console.log inside the render block
debug_code = """                    <div className="divide-y divide-gray-100">
                        {(() => {
                            console.log("[PDF Debug] Tenders PDF paths:", filteredTenders.map(t => ({
                                id: t.id,
                                title: t.title,
                                source_pdf_path: t.source_pdf_path,
                                storage_path: (t as any).storage_path,
                                file_path: (t as any).file_path,
                                pdf_path: (t as any).pdf_path
                            })));
                            return null;
                        })()}
                        {filteredTenders.map((tender: Tender) => {"""
content = content.replace("                    <div className=\"divide-y divide-gray-100\">\n                        {filteredTenders.map((tender: Tender) => {", debug_code)

# 2. Add temporary placeholder
eye_block_old = """                                    <div className="flex items-center gap-1">
                                        {tender.source_pdf_path && (
                                            <button"""
eye_block_new = """                                    <div className="flex items-center gap-1">
                                        {tender.source_pdf_path ? (
                                            <button"""
content = content.replace(eye_block_old, eye_block_new)

eye_block_old2 = """                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            title="Delete Tender\""""
eye_block_new2 = """                                                <Eye className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <span title="No PDF saved" className="p-2 text-gray-300">
                                                <Eye className="w-4 h-4" />
                                            </span>
                                        )}
                                        <button
                                            title="Delete Tender\""""
content = content.replace(eye_block_old2, eye_block_new2)

with open(tenders_path, "w") as f: f.write(content)
