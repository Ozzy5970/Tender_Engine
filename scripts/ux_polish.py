import sys
import re

details_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderDetails.tsx"
with open(details_path, "r") as f: content = f.read()

# 1. Imports
content = content.replace(
    'import { useMemo, useState, useEffect } from "react"',
    'import { useMemo, useState, useEffect, useRef } from "react"'
)

# 2. State
state_insert_point = "    const [isSavingRequirements, setIsSavingRequirements] = useState(false)"
state_new = """    const [isSavingRequirements, setIsSavingRequirements] = useState(false)
    
    // UX Feedback State
    const [actionFeedback, setActionFeedback] = useState<string | null>(null)
    const [pendingEditScroll, setPendingEditScroll] = useState(false)
    const [highlightEditSection, setHighlightEditSection] = useState(false)
    const editSectionRef = useRef<HTMLDivElement | null>(null)"""
content = content.replace(state_insert_point, state_new)

# 3. New useEffect for scroll
scroll_effect = """
    useEffect(() => {
        if (pendingEditScroll && isEditingRequirements && editSectionRef.current) {
            editSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setPendingEditScroll(false);
            setHighlightEditSection(true);
            setTimeout(() => setHighlightEditSection(false), 1800);
        }
    }, [pendingEditScroll, isEditingRequirements]);
"""
content = content.replace("    useEffect(() => {\n        if (tender) {", scroll_effect + "\n    useEffect(() => {\n        if (tender) {")

# 4. handleActionClick
handler_old = """    const handleActionClick = (item: ComparisonResult) => {
        if (item.actionType === 'EDIT') {
            setIsEditingRequirements(true);
            setTimeout(() => {
                const element = document.getElementById('inline-edit-section');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Optional visual highlight flash could be added here
                }
            }, 100);
            return;
        }

        if (!item.docType) return;
        setUploadModalState({
            isOpen: true,
            docType: item.docType,
            title: item.name,
            category: 'COMPLIANCE',
            existingDoc: item.actionType === 'REPLACE',
            initialData: item.docData
        });
    }"""
handler_new = """    const handleActionClick = (item: ComparisonResult) => {
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
    }"""
content = content.replace(handler_old, handler_new)

# 5. Success panel
success_panel_regex = r'\{\/\*\s*Safe to Submit Indicator\s*\*\/\}.*?(?=\{\/\*\s*Result Columns\s*\*\/)'
success_new = """            {/* Prominent Success State */}
            {score === 100 && (
                <div className="p-5 rounded-xl border bg-green-50 border-green-200 shadow-sm flex items-start gap-4 transition-all mb-8">
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-lg text-green-800">You're ready to submit this tender</h3>
                        <p className="text-sm mt-1 text-green-700">All checked requirements currently pass. Review the tender pack before final submission.</p>
                    </div>
                </div>
            )}

            """
content = re.sub(success_panel_regex, success_new, content, flags=re.DOTALL)

# 6. Action feedback JSX
feedback_old = """                        {isEditingRequirements && (
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                                EDIT MODE ENABLED
                            </div>
                        )}
                    </div>"""
feedback_new = """                        {isEditingRequirements && (
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                                EDIT MODE ENABLED
                            </div>
                        )}
                        {actionFeedback && (
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 animate-pulse transition-opacity">
                                {actionFeedback}
                            </div>
                        )}
                    </div>"""
content = content.replace(feedback_old, feedback_new)

# 7. Edit Section Ref
edit_block_old = """                    {/* Inline Edit Requirements Block */}
                    {isEditingRequirements && (
                        <div id="inline-edit-section" className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all">"""
edit_block_new = """                    {/* Inline Edit Requirements Block */}
                    {isEditingRequirements && (
                        <div ref={editSectionRef} className={cn("mt-8 bg-white border rounded-xl overflow-hidden transition-all", highlightEditSection ? "ring-2 ring-primary/40 bg-primary/5 border-primary/40 shadow-md" : "border-gray-200 shadow-sm")}>"""
content = content.replace(edit_block_old, edit_block_new)

with open(details_path, "w") as f: f.write(content)
