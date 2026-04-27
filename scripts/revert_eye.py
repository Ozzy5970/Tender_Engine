import sys

tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

# Remove the console log block
log_block = """                        {(() => {
                            console.log("[PDF Debug] Tenders PDF paths:", filteredTenders.map(t => ({
                                id: t.id,
                                title: t.title,
                                source_pdf_path: t.source_pdf_path,
                                storage_path: (t as any).storage_path,
                                file_path: (t as any).file_path,
                                pdf_path: (t as any).pdf_path
                            })));
                            return null;
                        })()}"""
content = content.replace(log_block + "\n", "")

# Revert the placeholder back to just an empty string when null
placeholder_old = """                                        ) : (
                                            <span title="No PDF saved" className="p-2 text-gray-300">
                                                <Eye className="w-4 h-4" />
                                            </span>
                                        )}"""
placeholder_new = """                                        )}"""
content = content.replace(placeholder_old, placeholder_new)

# Revert the ternary back to &&
ternary_old = """                                    <div className="flex items-center gap-1">
                                        {tender.source_pdf_path ? ("""
ternary_new = """                                    <div className="flex items-center gap-1">
                                        {tender.source_pdf_path && ("""
content = content.replace(ternary_old, ternary_new)

with open(tenders_path, "w") as f: f.write(content)
