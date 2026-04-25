import sys
import re

details_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderDetails.tsx"
with open(details_path, "r") as f: content = f.read()

# 1. Update ComparisonResult interface
interface_old = """interface ComparisonResult {
    name: string
    status: string
    warning?: string
    reason?: string
    yourData?: string
    requirementName?: string
    actionHint?: string
    actionType?: 'UPLOAD' | 'REPLACE'
    docType?: string
    docData?: any
}"""
interface_new = """interface ComparisonResult {
    name: string
    status: string
    warning?: string
    reason?: string
    yourData?: string
    requirementName?: string
    actionHint?: string
    actionType?: 'UPLOAD' | 'REPLACE' | 'EDIT'
    docType?: string
    docData?: any
}"""
content = content.replace(interface_old, interface_new)

# 2. Update handleActionClick
handler_old = """    const handleActionClick = (item: ComparisonResult) => {
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
content = content.replace(handler_old, handler_new)

# 3. Add ID to inline edit block
edit_block_old = """                    {/* Inline Edit Requirements Block */}
                    {isEditingRequirements && (
                        <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">"""
edit_block_new = """                    {/* Inline Edit Requirements Block */}
                    {isEditingRequirements && (
                        <div id="inline-edit-section" className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all">"""
content = content.replace(edit_block_old, edit_block_new)

# 4. Add Metadata checks
checks_old = """        const requirements = tender.compliance_requirements || []

        // If no requirements found (legacy), use a default set for display (optional, or just show 0)
        // But for manual tenders we know we populate them.

        requirements.forEach(req => {"""
checks_new = """        const requirements = tender.compliance_requirements || []

        // Metadata Checks
        if (!tender.title || tender.title.trim() === '' || tender.title === 'Untitled Tender') {
            checks.push({
                name: 'Tender Basics',
                requirementName: 'Valid Tender Title',
                status: 'fail',
                reason: 'Title is missing or default',
                yourData: tender.title || 'Empty',
                actionHint: 'Edit Details',
                actionType: 'EDIT'
            });
        }
        if (!tender.client_name || tender.client_name.trim() === '') {
            checks.push({
                name: 'Tender Basics',
                requirementName: 'Client Name',
                status: 'fail',
                reason: 'Missing Client Name',
                yourData: 'Empty',
                actionHint: 'Edit Details',
                actionType: 'EDIT'
            });
        }

        // If no requirements found (legacy), use a default set for display (optional, or just show 0)
        // But for manual tenders we know we populate them.

        requirements.forEach(req => {"""
content = content.replace(checks_old, checks_new)

with open(details_path, "w") as f: f.write(content)
