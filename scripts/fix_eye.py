import sys

tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

# 1. Add Eye icon
content = content.replace("Trash2, Lock", "Trash2, Lock, Eye")

# 2. Add Button
trash_btn_old = """                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setDeleteId(tender.id)
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>"""

trash_btn_new = """                                    <div className="flex items-center gap-1">
                                        {tender.source_pdf_path && (
                                            <button
                                                title="View PDF"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        const { data, error } = await supabase.storage
                                                            .from('compliance')
                                                            .createSignedUrl(tender.source_pdf_path, 3600);
                                                        
                                                        if (error) throw error;
                                                        if (data?.signedUrl) {
                                                            window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                                                        }
                                                    } catch (err) {
                                                        console.error("Failed to open PDF", err);
                                                        toast.error("Could not open PDF.");
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            title="Delete Tender"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setDeleteId(tender.id)
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>"""

content = content.replace(trash_btn_old, trash_btn_new)

with open(tenders_path, "w") as f: f.write(content)
