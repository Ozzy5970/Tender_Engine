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
                checks.push({ name: 'B-BBEE Level', section: 'B-BBEE', requirementName: `Level ${minLevel}`, status: 'fail', message: 'Upload a valid B-BBEE Certificate.', yourData: 'Not uploaded', actionHint: 'Update BBBEE Info', actionType: 'UPLOAD', docType: 'bbbee_cert' });
                checks.push({ name: 'B-BBEE Expiry', section: 'B-BBEE', requirementName: 'Valid on submission', status: 'fail', message: 'Upload a valid B-BBEE Certificate.', yourData: 'Not uploaded', actionHint: 'Update BBBEE Info', actionType: 'UPLOAD', docType: 'bbbee_cert' });
            } else {
                const rawLevel = userBbbee.metadata?.bbbee_level;

                if (!rawLevel) {
                    checks.push({
                        name: 'B-BBEE Level',
                        section: 'B-BBEE',
                        requirementName: `Level ${minLevel}`,
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
                            name: 'B-BBEE Level',
                            section: 'B-BBEE',
                            requirementName: `Level ${minLevel}`,
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
                            name: 'B-BBEE Level',
                            section: 'B-BBEE',
                            requirementName: `Level ${minLevel}`,
                            status: 'pass',
                            message: 'Your B-BBEE level meets or exceeds the requirement.',
                            yourData: `Level ${userLevel}`
                        });
                    }
                }

                const expiryDate = userBbbee.expiry_date || userBbbee.metadata?.expiry_date;
                const statusStr = userBbbee.computed_status === 'expired' ? 'Expired' : userBbbee.computed_status === 'warning' ? 'Expiring soon' : 'Valid';
                const statusCode = userBbbee.computed_status === 'expired' ? 'fail' : userBbbee.computed_status === 'warning' ? 'warning' : 'pass';

                checks.push({
                    name: 'B-BBEE Expiry',
                    section: 'B-BBEE',
                    requirementName: 'Valid on submission',
                    status: statusCode,
                    message: statusCode !== 'pass' ? `B-BBEE is ${statusStr.toLowerCase()}.` : '',
                    yourData: expiryDate ? new Date(expiryDate).toISOString().split('T')[0] : (statusStr === 'Valid' ? 'Valid' : statusStr),
                    actionHint: statusCode !== 'pass' ? 'Update BBBEE Info' : undefined,
                    actionType: statusCode !== 'pass' ? 'REPLACE' : undefined,
                    docType: 'bbbee_cert',
                    docData: userBbbee
                });
            }
        }

        // Mandatory Docs Check
        else if (req.rule_category === 'MANDATORY_DOC') {
            const requiredDocs = (req.target_value?.docs || []).filter(
                (key: any) => typeof key === 'string' && key.trim() !== ''
            );
            requiredDocs.forEach((docKey: string) => {
                if (docKey === 'cipc_cert') {
                    const userCipc = safeDocsData.find(d => d.doc_type === 'cipc_cert');
                    if (!userCipc) {
                        checks.push({
                            name: 'CIPC Status',
                            section: 'CIPC',
                            requirementName: 'Active',
                            status: 'fail',
                            message: 'Company is not active or not registered.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload CIPC Document',
                            actionType: 'UPLOAD',
                            docType: 'cipc_cert'
                        });
                    } else {
                        const metadata = userCipc.metadata || {};
                        const rawEntityStatus =
                            metadata.entity_status ||
                            metadata.entityStatus ||
                            metadata.status ||
                            metadata.company_status ||
                            metadata.registration_status ||
                            metadata.entityStatusText;

                        const normalizedStatus = String(rawEntityStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");
                        const isActive = ["active", "valid", "registered", "in business", "inbusiness", "business"].includes(normalizedStatus);

                        const registrationNumber =
                            metadata.registration_number ||
                            metadata.registrationNumber ||
                            metadata.registration_no ||
                            metadata.reg_number ||
                            metadata.company_registration_number ||
                            metadata.cipc_registration_number ||
                            metadata.cipc_number;

                        const displayStatus = rawEntityStatus ? String(rawEntityStatus).trim() : 'Unknown';

                        checks.push({
                            name: 'CIPC Status',
                            section: 'CIPC',
                            requirementName: 'Active',
                            status: isActive ? 'pass' : 'fail',
                            message: isActive ? '' : 'Company is not active or not registered.',
                            yourData: displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase(),
                            actionHint: isActive ? undefined : 'Update CIPC Info',
                            actionType: isActive ? undefined : 'REPLACE',
                            docType: 'cipc_cert',
                            docData: {
                                ...userCipc,
                                metadata: {
                                    ...metadata,
                                    registration_number: registrationNumber
                                }
                            }
                        });
                    }
                    return;
                }

                const taxKeys = ['sars_pin', 'tax_clearance', 'tax_clearance_pin', 'tax_compliance', 'tax_compliance_status'];
                if (taxKeys.includes(docKey)) {
                    const userTax = safeDocsData.find(d => taxKeys.includes(d.doc_type));
                    if (!userTax) {
                        checks.push({
                            name: 'Tax Status',
                            section: 'Tax Clearance',
                            requirementName: 'Compliant',
                            status: 'fail',
                            message: 'Upload a valid Tax Clearance document.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                        checks.push({
                            name: 'Tax Expiry',
                            section: 'Tax Clearance',
                            requirementName: 'Valid on submission',
                            status: 'fail',
                            message: 'Upload a valid Tax Clearance document.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userTax.metadata || {};
                        const rawStatus = metadata.status || metadata.tax_status || metadata.compliance_status || metadata.tax_compliance_status;
                        const rawPin = metadata.pin || metadata.tax_pin || metadata.sars_pin || metadata.tax_compliance_pin;
                        const rawExpiry = userTax.expiry_date || metadata.expiry_date || metadata.valid_until;

                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isCompliant = [
                            "compliant",
                            "tax compliant",
                            "tax compliant status",
                            "valid",
                            "active",
                            "good standing"
                        ].includes(normalizedStatus);
                        
                        const displayStatus = rawStatus ? String(rawStatus).trim() : 'Unknown';
                        
                        checks.push({
                            name: 'Tax Status',
                            section: 'Tax Clearance',
                            requirementName: 'Compliant',
                            status: isCompliant ? 'pass' : 'fail',
                            message: isCompliant ? '' : 'Your tax status is non-compliant or unknown.',
                            yourData: displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase(),
                            actionHint: isCompliant ? undefined : 'Update Tax Info',
                            actionType: isCompliant ? undefined : 'REPLACE',
                            docType: userTax.doc_type,
                            docData: {
                                ...userTax,
                                metadata: {
                                    ...metadata,
                                    pin: rawPin
                                }
                            }
                        });

                        let expiryStatus: 'pass' | 'warning' | 'fail' = 'pass';
                        if (!rawExpiry) {
                            expiryStatus = 'fail';
                        } else if (userTax.computed_status === 'expired') {
                            expiryStatus = 'fail';
                        } else if (userTax.computed_status === 'warning') {
                            expiryStatus = 'warning';
                        }

                        checks.push({
                            name: 'Tax Expiry',
                            section: 'Tax Clearance',
                            requirementName: 'Valid on submission',
                            status: expiryStatus,
                            message: expiryStatus === 'fail' ? (rawExpiry ? 'Tax clearance has expired.' : 'Expiry date is missing.') : expiryStatus === 'warning' ? 'Tax clearance is expiring soon.' : '',
                            yourData: rawExpiry ? String(rawExpiry).split('T')[0] : 'Unknown',
                            actionHint: expiryStatus !== 'pass' ? 'Update Tax Info' : undefined,
                            actionType: expiryStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userTax.doc_type,
                            docData: userTax
                        });
                    }
                    return;
                }

                const csdKeys = ['csd_summary', 'csd', 'csd_report', 'csd_supplier_summary'];
                if (csdKeys.includes(docKey)) {
                    const userCsd = safeDocsData.find(d => csdKeys.includes(d.doc_type));
                    if (!userCsd) {
                        checks.push({
                            name: 'CSD Status',
                            section: 'CSD',
                            requirementName: 'Active',
                            status: 'fail',
                            message: 'Upload a valid CSD Summary.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                        checks.push({
                            name: 'CSD Expiry',
                            section: 'CSD',
                            requirementName: 'Valid on submission',
                            status: 'fail',
                            message: 'Upload a valid CSD Summary.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userCsd.metadata || {};
                        const rawStatus = metadata.registration_status || metadata.status || metadata.supplier_status || metadata.csd_status;
                        const rawMaaa = metadata.maaa_number || metadata.maaa || metadata.supplier_number || metadata.csd_number;
                        const rawExpiry = userCsd.expiry_date || metadata.expiry_date || metadata.valid_until;

                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isActive = [
                            "active",
                            "valid",
                            "registered",
                            "active supplier",
                            "registered supplier",
                            "supplier active",
                            "supplier registered"
                        ].includes(normalizedStatus);
                        
                        const displayStatus = rawStatus ? String(rawStatus).trim() : 'Unknown';
                        
                        checks.push({
                            name: 'CSD Status',
                            section: 'CSD',
                            requirementName: 'Active',
                            status: isActive ? 'pass' : 'fail',
                            message: isActive ? '' : 'Your CSD registration is inactive or unknown.',
                            yourData: displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase(),
                            actionHint: isActive ? undefined : 'Update CSD Info',
                            actionType: isActive ? undefined : 'REPLACE',
                            docType: userCsd.doc_type,
                            docData: {
                                ...userCsd,
                                metadata: {
                                    ...metadata,
                                    maaa_number: rawMaaa
                                }
                            }
                        });

                        let expiryStatus: 'pass' | 'warning' | 'fail' = 'pass';
                        if (!rawExpiry) {
                            expiryStatus = 'fail';
                        } else if (userCsd.computed_status === 'expired') {
                            expiryStatus = 'fail';
                        } else if (userCsd.computed_status === 'warning') {
                            expiryStatus = 'warning';
                        }

                        checks.push({
                            name: 'CSD Expiry',
                            section: 'CSD',
                            requirementName: 'Valid on submission',
                            status: expiryStatus,
                            message: expiryStatus === 'fail' ? (rawExpiry ? 'CSD registration has expired.' : 'Expiry date is missing.') : expiryStatus === 'warning' ? 'CSD registration is expiring soon.' : '',
                            yourData: rawExpiry ? String(rawExpiry).split('T')[0] : 'Unknown',
                            actionHint: expiryStatus !== 'pass' ? 'Update CSD Info' : undefined,
                            actionType: expiryStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userCsd.doc_type,
                            docData: userCsd
                        });
                    }
                    return;
                }

                const bankKeys = ['bank_letter', 'bank_confirmation', 'bank_account_confirmation', 'proof_of_bank_account'];
                if (bankKeys.includes(docKey)) {
                    const userBank = safeDocsData.find(d => bankKeys.includes(d.doc_type));
                    if (!userBank) {
                        checks.push({
                            name: 'Bank Letter Status',
                            section: 'Bank Letter',
                            requirementName: 'Uploaded',
                            status: 'fail',
                            message: 'Upload a valid Bank Letter.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                        checks.push({
                            name: 'Bank Letter Expiry',
                            section: 'Bank Letter',
                            requirementName: 'Valid on submission',
                            status: 'fail',
                            message: 'Upload a valid Bank Letter.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const rawExpiry = userBank.expiry_date || (userBank.metadata && (userBank.metadata.expiry_date || userBank.metadata.valid_until));
                        
                        let expiryStatus: 'pass' | 'warning' | 'fail' | 'info' = 'pass';
                        if (!rawExpiry) {
                            expiryStatus = 'info';
                        } else if (userBank.computed_status === 'expired') {
                            expiryStatus = 'fail';
                        } else if (userBank.computed_status === 'warning') {
                            expiryStatus = 'warning';
                        }

                        let statusStatus: 'pass' | 'warning' | 'fail' = 'pass';
                        if (expiryStatus === 'fail') {
                            statusStatus = 'fail';
                        } else if (expiryStatus === 'warning') {
                            statusStatus = 'warning';
                        }

                        checks.push({
                            name: 'Bank Letter Status',
                            section: 'Bank Letter',
                            requirementName: 'Uploaded',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'Bank Letter has expired.' : statusStatus === 'warning' ? 'Bank Letter is expiring soon.' : '',
                            yourData: rawExpiry ? `Uploaded (expires ${String(rawExpiry).split('T')[0]})` : 'Uploaded',
                            actionHint: statusStatus !== 'pass' ? 'Update Bank Letter' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userBank.doc_type,
                            docData: userBank
                        });

                        checks.push({
                            name: 'Bank Letter Expiry',
                            section: 'Bank Letter',
                            requirementName: 'Valid on submission',
                            status: expiryStatus,
                            message: expiryStatus === 'fail' ? 'Bank Letter has expired.' : expiryStatus === 'warning' ? 'Bank Letter is expiring soon.' : '',
                            yourData: rawExpiry ? String(rawExpiry).split('T')[0] : 'No expiry captured',
                            actionHint: (expiryStatus === 'fail' || expiryStatus === 'warning') ? 'Update Bank Letter' : undefined,
                            actionType: (expiryStatus === 'fail' || expiryStatus === 'warning') ? 'REPLACE' : undefined,
                            docType: userBank.doc_type,
                            docData: userBank
                        });
                    }
                    return;
                }

                const coidKeys = ['coid_letter', 'coida_letter', 'coid_good_standing', 'coida_good_standing', 'letter_of_good_standing'];
                if (coidKeys.includes(docKey)) {
                    const userCoid = safeDocsData.find(d => coidKeys.includes(d.doc_type));
                    if (!userCoid) {
                        checks.push({
                            name: 'COID Status',
                            section: 'COID',
                            requirementName: 'Good Standing',
                            status: 'fail',
                            message: 'Upload a valid COID Letter of Good Standing.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                        checks.push({
                            name: 'COID Expiry',
                            section: 'COID',
                            requirementName: 'Valid on submission',
                            status: 'fail',
                            message: 'Upload a valid COID Letter of Good Standing.',
                            yourData: 'Unknown',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userCoid.metadata || {};
                        const rawStatus = metadata.status || metadata.coid_status || metadata.coida_status || metadata.good_standing_status || userCoid.status;
                        const rawExpiry = userCoid.expiry_date || metadata.expiry_date || metadata.valid_until;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isGoodStanding = ["good standing", "valid", "active", "compliant"].includes(normalizedStatus);

                        let expiryStatus: 'pass' | 'warning' | 'fail' = 'pass';
                        if (!rawExpiry) {
                            expiryStatus = 'warning';
                        } else if (userCoid.computed_status === 'expired') {
                            expiryStatus = 'fail';
                        } else if (userCoid.computed_status === 'warning') {
                            expiryStatus = 'warning';
                        }

                        let statusStatus: 'pass' | 'warning' | 'fail' = 'pass';
                        if (!isGoodStanding) {
                            statusStatus = 'fail';
                        } else if (expiryStatus === 'fail') {
                            statusStatus = 'fail';
                        } else if (expiryStatus === 'warning') {
                            statusStatus = 'warning';
                        }

                        const displayStatus = rawStatus ? String(rawStatus).trim() : 'Unknown';

                        checks.push({
                            name: 'COID Status',
                            section: 'COID',
                            requirementName: 'Good Standing',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? (isGoodStanding ? 'COID Letter has expired.' : 'COID Letter is not in good standing.') : statusStatus === 'warning' ? 'COID Letter is expiring soon.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update COID Info' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userCoid.doc_type,
                            docData: userCoid
                        });

                        checks.push({
                            name: 'COID Expiry',
                            section: 'COID',
                            requirementName: 'Valid on submission',
                            status: expiryStatus,
                            message: expiryStatus === 'fail' ? (rawExpiry ? 'COID Letter has expired.' : 'Expiry date is missing.') : expiryStatus === 'warning' ? 'COID Letter is expiring soon.' : '',
                            yourData: rawExpiry ? String(rawExpiry).split('T')[0] : 'Unknown',
                            actionHint: expiryStatus !== 'pass' ? 'Update COID Info' : undefined,
                            actionType: expiryStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userCoid.doc_type,
                            docData: userCoid
                        });
                    }
                    return;
                }

                const uifKeys = ['uif_registration', 'uif', 'uif_letter', 'uif_certificate', 'uif_proof', 'uif_cert', 'uif_reg'];
                if (uifKeys.includes(docKey)) {
                    const userUif = safeDocsData.find(d => uifKeys.includes(d.doc_type));
                    if (!userUif) {
                        checks.push({
                            name: 'UIF Status',
                            section: 'UIF',
                            requirementName: 'Active',
                            status: 'fail',
                            message: 'Upload a valid UIF Registration document.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userUif.metadata || {};
                        const rawStatus = metadata.status || metadata.uif_status || metadata.registration_status || metadata.company_status || userUif.status;
                        const rawReference = metadata.uif_reference || metadata.uif_ref || metadata.reference || metadata.reference_number || metadata.uif_number;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isActive = ["active", "valid", "registered"].includes(normalizedStatus);

                        let statusStatus: 'pass' | 'warning' | 'fail' = isActive ? 'pass' : 'fail';
                        const displayStatus = rawStatus ? String(rawStatus).trim().charAt(0).toUpperCase() + String(rawStatus).trim().slice(1).toLowerCase() : 'Unknown';

                        checks.push({
                            name: 'UIF Status',
                            section: 'UIF',
                            requirementName: 'Active',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'UIF Registration is not active or valid.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update UIF Info' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userUif.doc_type,
                            docData: {
                                ...userUif,
                                metadata: {
                                    ...metadata,
                                    uif_reference: rawReference
                                }
                            }
                        });
                    }
                    return;
                }

                const sheKeys = ['she_file', 'she_file_index', 'she_index', 'safety_file', 'safety_health_environment_file'];
                if (sheKeys.includes(docKey)) {
                    const userShe = safeDocsData.find(d => sheKeys.includes(d.doc_type));
                    if (!userShe) {
                        checks.push({
                            name: 'SHE File Status',
                            section: 'SHE File',
                            requirementName: 'Prepared / Active',
                            status: 'fail',
                            message: 'Upload a valid SHE File.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userShe.metadata || {};
                        const rawStatus = metadata.status || metadata.she_status || metadata.file_status || metadata.document_status || userShe.status;
                        const preparedBy = metadata.prepared_by || metadata.preparedBy || metadata.author || metadata.compiler;
                        const issueDate = metadata.issue_date || metadata.issueDate || metadata.date_issued;
                        const version = metadata.document_version || metadata.version || metadata.file_version;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isActive = ["active", "valid", "prepared", "available", "complete"].includes(normalizedStatus);

                        let statusStatus: 'pass' | 'warning' | 'fail' = isActive ? 'pass' : 'fail';
                        const displayStatus = rawStatus ? String(rawStatus).trim().charAt(0).toUpperCase() + String(rawStatus).trim().slice(1).toLowerCase() : 'Unknown';

                        checks.push({
                            name: 'SHE File Status',
                            section: 'SHE File',
                            requirementName: 'Prepared / Active',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'SHE File is not prepared or valid.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update SHE File' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userShe.doc_type,
                            docData: {
                                ...userShe,
                                metadata: {
                                    ...metadata,
                                    prepared_by: preparedBy,
                                    issue_date: issueDate,
                                    document_version: version
                                }
                            }
                        });
                    }
                    return;
                }

                const ohsKeys = ['ohs_plan', 'occupational_health_safety_plan', 'occupational_health_and_safety_plan', 'health_safety_plan', 'safety_plan'];
                if (ohsKeys.includes(docKey)) {
                    const userOhs = safeDocsData.find(d => ohsKeys.includes(d.doc_type));
                    if (!userOhs) {
                        checks.push({
                            name: 'OHS Plan Status',
                            section: 'OHS Plan',
                            requirementName: 'Prepared / Active',
                            status: 'fail',
                            message: 'Upload a valid OHS Plan.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userOhs.metadata || {};
                        const rawStatus = metadata.status || metadata.ohs_status || metadata.plan_status || metadata.document_status || userOhs.status;
                        const planNumber = metadata.plan_number || metadata.planNo || metadata.ohs_plan_number || metadata.document_number;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isActive = ["active", "valid", "prepared", "available", "complete"].includes(normalizedStatus);

                        let statusStatus: 'pass' | 'warning' | 'fail' = isActive ? 'pass' : 'fail';
                        const displayStatus = rawStatus ? String(rawStatus).trim().charAt(0).toUpperCase() + String(rawStatus).trim().slice(1).toLowerCase() : 'Unknown';

                        checks.push({
                            name: 'OHS Plan Status',
                            section: 'OHS Plan',
                            requirementName: 'Prepared / Active',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'OHS Plan is not prepared or valid.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update OHS Plan' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userOhs.doc_type,
                            docData: {
                                ...userOhs,
                                metadata: {
                                    ...metadata,
                                    plan_number: planNumber
                                }
                            }
                        });
                    }
                    return;
                }

                const payeKeys = ['paye_registration', 'paye_reg', 'paye', 'paye_certificate', 'paye_proof'];
                if (payeKeys.includes(docKey)) {
                    const userPaye = safeDocsData.find(d => payeKeys.includes(d.doc_type));
                    if (!userPaye) {
                        checks.push({
                            name: 'PAYE Status',
                            section: 'PAYE',
                            requirementName: 'Active',
                            status: 'fail',
                            message: 'Upload a valid PAYE Registration.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                    } else {
                        const metadata = userPaye.metadata || {};
                        const rawStatus = metadata.status || metadata.paye_status || metadata.registration_status || metadata.company_status || userPaye.status;
                        const payeNumber = metadata.paye_number || metadata.paye_no || metadata.reference || metadata.reference_number || metadata.registration_number;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isActive = ["active", "valid", "registered"].includes(normalizedStatus);

                        let statusStatus: 'pass' | 'warning' | 'fail' = isActive ? 'pass' : 'fail';
                        const displayStatus = rawStatus ? String(rawStatus).trim().charAt(0).toUpperCase() + String(rawStatus).trim().slice(1).toLowerCase() : 'Unknown';

                        checks.push({
                            name: 'PAYE Status',
                            section: 'PAYE',
                            requirementName: 'Active',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'PAYE Registration is not active or valid.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update PAYE Info' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userPaye.doc_type,
                            docData: {
                                ...userPaye,
                                metadata: {
                                    ...metadata,
                                    paye_number: payeNumber
                                }
                            }
                        });
                    }
                    return;
                }

                const sbdKeys = ['sbd_6_1', 'sbd6_1', 'sbd_61', 'preference_points_claim', 'preference_points', 'sbd_preference_points'];
                if (sbdKeys.includes(docKey)) {
                    const userSbd = safeDocsData.find(d => sbdKeys.includes(d.doc_type));
                    if (!userSbd) {
                        checks.push({
                            name: 'SBD 6.1 Status',
                            section: 'SBD 6.1',
                            requirementName: 'Signed / Completed',
                            status: 'fail',
                            message: 'Upload a completed SBD 6.1 form.',
                            yourData: 'Not uploaded',
                            actionHint: 'Upload Document',
                            actionType: 'UPLOAD',
                            docType: docKey
                        });
                        checks.push({
                            name: 'SBD 6.1 B-BBEE Level Claimed',
                            section: 'SBD 6.1',
                            requirementName: 'Captured',
                            status: 'fail',
                            message: '',
                            yourData: 'Not uploaded',
                            docType: docKey
                        });
                        checks.push({
                            name: 'SBD 6.1 Preference Points Claimed',
                            section: 'SBD 6.1',
                            requirementName: 'Captured',
                            status: 'fail',
                            message: '',
                            yourData: 'Not uploaded',
                            docType: docKey
                        });
                    } else {
                        const metadata = userSbd.metadata || {};
                        const rawStatus = metadata.status || metadata.form_status || metadata.signature_status || metadata.completion_status || userSbd.status;
                        const bbbeeLevel = metadata.bbbee_level_claimed || metadata.b_bbee_level_claimed || metadata.bbbee_level || metadata.claimed_bbbee_level;
                        const prefPoints = metadata.preference_points_claimed || metadata.preferencePointsClaimed || metadata.points_claimed || metadata.pointsClaimed || metadata.preference_points || metadata.preferencePoints || metadata.claimed_points || metadata.claimedPoints || metadata.preference_score_claimed || metadata.preferenceScoreClaimed || metadata.preference_points_score || metadata.preferencePointsScore || metadata.points || metadata.preference_points_claim || metadata.preferencePointsClaim;
                        const signatory = metadata.authorized_signatory || metadata.authorised_signatory || metadata.authorizedSignatory || metadata.authorisedSignatory || metadata.signatory || metadata.signed_by || metadata.signedBy || metadata.representative_name || metadata.representativeName;
                        const signatureDate = metadata.signature_date || metadata.signatureDate || metadata.signed_date || metadata.signedDate || metadata.date_signed || metadata.dateSigned || metadata.signing_date || metadata.signingDate;
                        
                        const normalizedStatus = String(rawStatus || "")
                            .trim()
                            .toLowerCase()
                            .replace(/[_-]+/g, " ")
                            .replace(/\s+/g, " ");

                        const isSigned = ["signed", "completed", "complete", "submitted"].includes(normalizedStatus);

                        let statusStatus: 'pass' | 'warning' | 'fail' = isSigned ? 'pass' : 'fail';
                        const displayStatus = rawStatus ? String(rawStatus).trim().charAt(0).toUpperCase() + String(rawStatus).trim().slice(1).toLowerCase() : 'Unknown';

                        checks.push({
                            name: 'SBD 6.1 Status',
                            section: 'SBD 6.1',
                            requirementName: 'Signed / Completed',
                            status: statusStatus,
                            message: statusStatus === 'fail' ? 'SBD 6.1 is not signed or completed.' : '',
                            yourData: displayStatus,
                            actionHint: statusStatus !== 'pass' ? 'Update SBD 6.1' : undefined,
                            actionType: statusStatus !== 'pass' ? 'REPLACE' : undefined,
                            docType: userSbd.doc_type,
                            docData: {
                                ...userSbd,
                                metadata: {
                                    ...metadata,
                                    authorized_signatory: signatory,
                                    signature_date: signatureDate
                                }
                            }
                        });

                        checks.push({
                            name: 'SBD 6.1 B-BBEE Level Claimed',
                            section: 'SBD 6.1',
                            requirementName: 'Captured',
                            status: bbbeeLevel ? 'pass' : 'warning',
                            message: !bbbeeLevel ? 'B-BBEE Level Claimed is missing.' : '',
                            yourData: bbbeeLevel ? (String(bbbeeLevel).toLowerCase().includes('level') ? String(bbbeeLevel) : `Level ${bbbeeLevel}`) : 'Not captured',
                            actionHint: !bbbeeLevel ? 'Update Data' : undefined,
                            actionType: !bbbeeLevel ? 'REPLACE' : undefined,
                            docType: userSbd.doc_type,
                            docData: userSbd
                        });

                        checks.push({
                            name: 'SBD 6.1 Preference Points Claimed',
                            section: 'SBD 6.1',
                            requirementName: 'Captured',
                            status: prefPoints ? 'pass' : 'warning',
                            message: !prefPoints ? 'Preference Points Claimed is missing.' : '',
                            yourData: prefPoints ? String(prefPoints) : 'Not captured',
                            actionHint: !prefPoints ? 'Update Data' : undefined,
                            actionType: !prefPoints ? 'REPLACE' : undefined,
                            docType: userSbd.doc_type,
                            docData: userSbd
                        });
                    }
                    return;
                }

                if (['cidb_proof', 'cidb_cert', 'bbbee_cert', 'cipc_cert', ...taxKeys, ...csdKeys, ...bankKeys, ...coidKeys, ...uifKeys, ...sheKeys, ...ohsKeys, ...payeKeys, ...sbdKeys].includes(docKey)) {
                    return;
                }

                const labelMap: Record<string, string> = {
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
