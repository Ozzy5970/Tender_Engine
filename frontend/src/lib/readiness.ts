// frontend/src/lib/readiness.ts

export const READINESS_FIELDS = [
    "grade",
    "class",
    "bbbee",
    "prefPoints",
    "mandatoryDocs"
];

export interface ComparisonResult {
    name: string
    section: string
    status: "pass" | "fail" | "warning" | "info"
    requirementName?: string
    yourData?: string
    message?: string
    actionHint?: string
    actionType?: 'UPLOAD' | 'REPLACE' | 'EDIT'
    docType?: string
    docData?: any
}

export const checkDocStatus = (userDocs: any[], typeKey: string): Omit<ComparisonResult, 'section'> => {
    const safeDocs = (userDocs || []).filter((doc: any) => doc && typeof doc === 'object');
    const doc = safeDocs.find((d: any) => d.doc_type === typeKey)
    if (!doc) return { status: 'fail', message: 'Upload a valid document.', name: '', yourData: 'Not uploaded', actionHint: 'Upload Document', actionType: 'UPLOAD', docType: typeKey }
    
    const expiryStr = doc.metadata?.expiry_date ? ` (expires ${doc.metadata.expiry_date})` : '';

    if (doc.computed_status !== 'valid') {
        if (doc.computed_status === 'warning') {
            return { status: 'fail', message: 'Expiring soon / needs renewal', name: '', yourData: `Valid${expiryStr}`, actionHint: 'Replace Document', actionType: 'REPLACE', docType: typeKey, docData: doc }
        }
        const expiredStr = doc.metadata?.expiry_date ? ` (expired ${doc.metadata.expiry_date})` : '';
        return { status: 'fail', message: 'Document not valid', name: '', yourData: `Expired${expiredStr}`, actionHint: 'Replace Document', actionType: 'REPLACE', docType: typeKey, docData: doc }
    }
    return { status: 'pass', name: '', yourData: `Valid${expiryStr}`, message: 'Your document is valid.' }
}

const normalizeDocKey = (key: string): string => {
    const map: Record<string, string> = {
        cidb_proof: 'cidb_cert',
        cidb: 'cidb_cert',
        bbbee: 'bbbee_cert',
        bee: 'bbbee_cert'
    };

    return map[key] || key;
};

export const calculateReadinessScore = (tender: any, docsData: any[]): {
    score: number | null;
    readiness: 'READY' | 'AMBER' | 'RED' | null;
    checks: ComparisonResult[];
    isReady: boolean;
} => {
    if (!tender || !docsData) return { score: null, readiness: null, checks: [], isReady: false }

    const checks: ComparisonResult[] = []
    const requirements = (tender.compliance_requirements || []).filter(
        (req: any) => req && typeof req === 'object' && req.rule_category
    );
    
    const safeDocsData = (docsData || []).filter(
        (doc: any) => doc && typeof doc === 'object'
    );

    requirements.forEach((req: any) => {
        // CIDB Check
        if (req.rule_category === 'CIDB') {
            const targetGradeStr = req.target_value?.grade;
            const targetGrade = parseInt(targetGradeStr || "1");
            const targetClass = String(req.target_value?.class || "").toUpperCase().trim();
            const userCidb = safeDocsData.find(d => d.doc_type === 'cidb_cert');

            if (!userCidb) {
                if (targetGradeStr) {
                    checks.push({ name: 'CIDB Grade', section: 'CIDB', requirementName: `Grade ${targetGrade}`, status: 'fail', message: 'Upload a valid CIDB Certificate.', yourData: 'Not uploaded', actionHint: 'Upload Document', actionType: 'UPLOAD', docType: 'cidb_cert' });
                } else {
                    checks.push({ name: 'CIDB Grade', section: 'CIDB', requirementName: 'Not specified', status: 'info', message: 'Tender does not explicitly define a CIDB grade requirement.', yourData: 'Not uploaded' });
                }
                
                if (targetClass) {
                    checks.push({ name: 'CIDB Class of Work', section: 'CIDB', requirementName: targetClass, status: 'fail', message: 'Upload a valid CIDB Certificate.', yourData: 'Not uploaded', actionHint: 'Upload Document', actionType: 'UPLOAD', docType: 'cidb_cert' });
                } else {
                    checks.push({ name: 'CIDB Class of Work', section: 'CIDB', requirementName: 'Not specified', status: 'info', message: 'Tender does not explicitly define a class of work.', yourData: 'Not uploaded' });
                }
                
                checks.push({ name: 'CIDB Status', section: 'CIDB', requirementName: 'Active', status: 'fail', message: 'Upload a valid CIDB Certificate.', yourData: 'Not uploaded', actionHint: 'Upload Document', actionType: 'UPLOAD', docType: 'cidb_cert' });
                checks.push({ name: 'CIDB Expiry', section: 'CIDB', requirementName: 'Valid on submission', status: 'fail', message: 'Upload a valid CIDB Certificate.', yourData: 'Not uploaded', actionHint: 'Upload Document', actionType: 'UPLOAD', docType: 'cidb_cert' });
            } else {
                const metadata = userCidb.metadata || {};
                
                // Extract aliases safely
                const rawGrade = metadata.grade || metadata.cidb_grade || metadata.contractor_grade;
                const rawClass = metadata.class || metadata.class_of_work || metadata.work_class;
                const rawStatus = metadata.status || userCidb.status || userCidb.computed_status;
                const rawExpiry = userCidb.expiry_date || metadata.expiry_date || metadata.valid_until;

                const userGrade = parseInt(String(rawGrade || "0"));
                const userClass = String(rawClass || "").toUpperCase().trim();
                const userStatus = String(rawStatus || "").toUpperCase().trim();
                const userExpiry = String(rawExpiry || "");

                // 1. Grade Check
                if (targetGradeStr) {
                    if (userGrade < targetGrade) {
                        checks.push({ name: 'CIDB Grade', section: 'CIDB', requirementName: `Grade ${targetGrade}`, status: 'fail', message: `Tender requires Grade ${targetGrade}. Your company is Grade ${userGrade}.`, yourData: `Grade ${userGrade}`, actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                    } else {
                        checks.push({ name: 'CIDB Grade', section: 'CIDB', requirementName: `Grade ${targetGrade}`, status: 'pass', message: 'Your CIDB grade meets or exceeds the tender requirement.', yourData: `Grade ${userGrade}` });
                    }
                } else {
                    checks.push({ name: 'CIDB Grade', section: 'CIDB', requirementName: 'Not specified', status: 'info', message: 'Tender does not explicitly define a CIDB grade requirement.', yourData: userGrade ? `Grade ${userGrade}` : 'Not uploaded' });
                }

                // 2. Class Check
                if (targetClass) {
                    if (!userClass || userClass !== targetClass) {
                        checks.push({ name: 'CIDB Class of Work', section: 'CIDB', requirementName: targetClass, status: 'fail', message: `Tender requires ${targetClass}. Your company is registered for ${userClass || 'Unknown'}.`, yourData: userClass || 'Unknown', actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                    } else {
                        checks.push({ name: 'CIDB Class of Work', section: 'CIDB', requirementName: targetClass, status: 'pass', message: 'Your CIDB class matches the tender requirement.', yourData: userClass });
                    }
                } else {
                    checks.push({ name: 'CIDB Class of Work', section: 'CIDB', requirementName: 'Not specified', status: 'info', message: 'Tender does not explicitly define a class of work.', yourData: userClass || 'Not uploaded' });
                }

                // 3. Status Check
                const isActive = ['ACTIVE', 'VALID', 'PASS'].includes(userStatus);
                if (isActive) {
                    checks.push({ name: 'CIDB Status', section: 'CIDB', requirementName: 'Active', status: 'pass', message: 'Your CIDB registration is active.', yourData: 'Active' });
                } else {
                    checks.push({ name: 'CIDB Status', section: 'CIDB', requirementName: 'Active', status: 'fail', message: 'Your CIDB registration is inactive or suspended.', yourData: userStatus || 'Inactive', actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                }

                // 4. Expiry Check
                if (userCidb.computed_status === 'expired') {
                    checks.push({ name: 'CIDB Expiry', section: 'CIDB', requirementName: 'Valid on submission', status: 'fail', message: 'Your CIDB certificate has expired.', yourData: userExpiry ? `Expired ${userExpiry}` : 'Expired', actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                } else if (userCidb.computed_status === 'warning') {
                    checks.push({ name: 'CIDB Expiry', section: 'CIDB', requirementName: 'Valid on submission', status: 'warning', message: 'Your CIDB certificate is expiring soon.', yourData: userExpiry ? `Expires ${userExpiry}` : 'Expiring', actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                } else if (!userExpiry && userCidb.computed_status !== 'valid') {
                    checks.push({ name: 'CIDB Expiry', section: 'CIDB', requirementName: 'Valid on submission', status: 'fail', message: 'Expiry date is missing.', yourData: 'Unknown', actionHint: 'Replace Document', actionType: 'REPLACE', docType: 'cidb_cert', docData: userCidb });
                } else {
                    checks.push({ name: 'CIDB Expiry', section: 'CIDB', requirementName: 'Valid on submission', status: 'pass', message: 'Your CIDB certificate is valid.', yourData: userExpiry ? `Expires ${userExpiry}` : 'Valid' });
                }
            }
        }

        // BBBEE Check
        else if (req.rule_category === 'BBBEE') {
            const minLevel = req.target_value?.min_level || 8
            const userBbbee = safeDocsData.find(d => d.doc_type === 'bbbee_cert')

            if (!userBbbee) {
                checks.push({ name: req.description || 'B-BBEE Requirement', section: 'B-BBEE', requirementName: `B-BBEE Level ${minLevel}`, status: 'fail', message: 'Upload a valid B-BBEE Certificate.', yourData: 'Not uploaded', actionHint: 'Update BBBEE Info', actionType: 'UPLOAD', docType: 'bbbee_cert' })
            } else if (userBbbee.computed_status === 'expired' || userBbbee.computed_status === 'warning') {
                const statusStr = userBbbee.computed_status === 'expired' ? 'B-BBEE Expired' : 'B-BBEE Expiring soon';
                checks.push({ name: req.description || 'B-BBEE Requirement', section: 'B-BBEE', requirementName: `B-BBEE Level ${minLevel}`, status: 'fail', message: statusStr, yourData: userBbbee.computed_status === 'expired' ? 'Expired' : 'Expiring', actionHint: 'Update BBBEE Info', actionType: 'REPLACE', docType: 'bbbee_cert', docData: userBbbee })
            } else {
                const rawLevel = userBbbee.metadata?.bbbee_level;

                if (!rawLevel) {
                    checks.push({
                        name: req.description || 'B-BBEE Requirement',
                        section: 'B-BBEE',
                        requirementName: `B-BBEE Level ${minLevel}`,
                        status: 'fail',
                        message: 'Missing B-BBEE level data.',
                        yourData: 'Unknown Level',
                        actionHint: 'Update BBBEE Info',
                        actionType: 'REPLACE',
                        docType: 'bbbee_cert',
                        docData: userBbbee
                    });
                } else {
                    const userLevel = parseInt(String(rawLevel));

                    if (userLevel > minLevel) {
                        checks.push({
                            name: req.description || 'B-BBEE Requirement',
                            section: 'B-BBEE',
                            requirementName: `B-BBEE Level ${minLevel}`,
                            status: 'fail',
                            message: `Your B-BBEE level is below the required level.`,
                            yourData: `Level ${userLevel}`,
                            actionHint: 'Update BBBEE Info',
                            actionType: 'REPLACE',
                            docType: 'bbbee_cert',
                            docData: userBbbee
                        });
                    } else {
                        checks.push({
                            name: req.description || 'B-BBEE Requirement',
                            section: 'B-BBEE',
                            requirementName: `B-BBEE Level ${minLevel}`,
                            status: 'pass',
                            message: 'Your B-BBEE level meets or exceeds the requirement.',
                            yourData: `Level ${userLevel}`
                        });
                    }
                }
            }
        }

        // Mandatory Docs Check
        else if (req.rule_category === 'MANDATORY_DOC') {
            const requiredDocs = (req.target_value?.docs || []).filter(
                (key: any) => typeof key === 'string' && key.trim() !== ''
            );
            requiredDocs.forEach((docKey: string) => {
                const labelMap: Record<string, string> = {
                    'cipc_cert': 'CIPC Registration',
                    'sars_pin': 'Tax Clearance',
                    'coid_letter': 'COID Letter',
                    'uif_cert': 'UIF Registration',
                    'bank_letter': 'Bank Letter'
                }
                const label = labelMap[docKey] || docKey
                const normalizedKey = normalizeDocKey(docKey);
                const result = checkDocStatus(safeDocsData, normalizedKey);

                checks.push({
                    name: label,
                    section: 'Mandatory Returnables',
                    requirementName: label,
                    status: result.status as any,
                    message: result.message,
                    yourData: result.yourData,
                    actionHint: result.actionHint,
                    actionType: result.actionType,
                    docType: result.docType,
                    docData: result.docData
                })
            })
        }
        
        // Other info checks removed to let Tender Details UI handle them natively
    })

    if (checks.length === 0) {
        return { score: null, readiness: null, checks: [], isReady: false }
    }

    // Only 'pass' or 'fail' checks count towards the percentage score
    // 'info' checks are informational only and do not affect Math
    const scorableChecks = checks.filter(c => c.status === 'pass' || c.status === 'fail');
    
    let score = null;
    let readiness: 'READY' | 'AMBER' | 'RED' | null = null;
    
    if (scorableChecks.length > 0) {
        const passedCount = scorableChecks.filter(c => c.status === 'pass').length;
        score = Math.round((passedCount / scorableChecks.length) * 100);
        
        readiness = 'RED';
        if (score === 100) readiness = 'READY';
        else if (score >= 50) readiness = 'AMBER';
    }

    return {
        score,
        readiness,
        checks,
        isReady: score === 100
    }
}
