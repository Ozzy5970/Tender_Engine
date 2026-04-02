export const COMPLIANCE_CATEGORIES = {
    COMPANY: "Company & Registration",
    CIDB: "CIDB Grading",
    TAX: "Tax & Government",
    BBBEE: "B-BBEE",
    LABOUR: "Labour & Safety",
    FINANCIAL: "Financial"
} as const;

export const DOCUMENT_TYPES = {
    // Company
    cipc_cert: {
        label: "CIPC Registration Certificate",
        category: "COMPANY",
        mandatory: true,
        fields: [
            { key: "registration_number", label: "Company Registration Number", type: "text", required: true, validationRegex: "^\\d{4}/\\d{6}/\\d{2}$", validationMessage: "Format YYYY/NNNNNN/NN" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "registration_date", label: "Registration Date", type: "date", required: false },
            { key: "entity_status", label: "Entity Status", type: "text", required: false }
        ]
    },
    shareholding: {
        label: "Shareholding / Share Certificates",
        category: "COMPANY",
        mandatory: false,
        fields: [
            { key: "certificate_number", label: "Certificate Number", type: "text", required: false },
            { key: "shareholder_name", label: "Shareholder Name", type: "text", required: false },
            { key: "shareholder_type", label: "Shareholder Type", type: "select", options: ["Individual", "Company", "Trust", "Other"], required: false },
            { key: "number_of_shares", label: "Number of Shares", type: "text", required: false },
            { key: "share_class", label: "Share Class", type: "text", required: false },
            { key: "ownership_percent", label: "Ownership %", type: "text", required: false },
            { key: "issue_date", label: "Issue Date", type: "date", required: false }
        ]
    },

    // CIDB
    cidb_cert: {
        label: "CIDB Certificate",
        category: "CIDB",
        mandatory: true,
        wMetadata: ["grade", "class"],
        fields: [
            { key: "crs_number", label: "CRS Number", type: "text", required: true, validationRegex: "^\\d{6,8}$", validationMessage: "6-8 digits" },
            { key: "grade", label: "CIDB Grade", type: "select", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], required: true },
            { key: "class_of_work", label: "Class of Work", type: "select", options: ["CE", "GB", "ME", "EP", "EB", "SO", "SQ", "SH", "SI", "SJ", "SK", "SL"], required: true },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "expiry_date", label: "Expiry Date", type: "date", required: true },
            { key: "status", label: "Status", type: "text", required: false }
        ]
    },

    // Tax
    sars_pin: {
        label: "SARS Tax Clearance Pin",
        category: "TAX",
        mandatory: true,
        fields: [
            { key: "pin", label: "10-digit Tax PIN", type: "text", required: true, validationRegex: "^\\d{10}$", validationMessage: "10 digits" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "issue_date", label: "Issue Date", type: "date", required: false },
            { key: "expiry_date", label: "Expiry Date", type: "date", required: false },
            { key: "status", label: "Status", type: "text", required: true }
        ]
    },
    csd_summary: {
        label: "CSD Registration Summary",
        category: "TAX",
        mandatory: true,
        fields: [
            { key: "maaa_number", label: "MAAA Number", type: "text", required: true, validationRegex: "^MAAA\\d{7}$", validationMessage: "Starts with MAAA + 7 digits" },
            { key: "supplier_name", label: "Supplier Name", type: "text", required: true },
            { key: "registration_status", label: "Registration Status", type: "text", required: false },
            { key: "issue_date", label: "Issue Date", type: "date", required: false },
            { key: "expiry_date", label: "Expiry Date", type: "date", required: false }
        ]
    },
    vat_cert: {
        label: "VAT Registration",
        category: "TAX",
        mandatory: false,
        fields: [
            { key: "vat_number", label: "VAT Number", type: "text", required: true, validationRegex: "^4\\d{9}$", validationMessage: "Starts with 4, 10 digits" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "registration_date", label: "Registration Date", type: "date", required: false },
            { key: "status", label: "Status", type: "text", required: false }
        ]
    },
    uif_reg: {
        label: "UIF Registration",
        category: "TAX",
        mandatory: true,
        fields: [
            { key: "uif_number", label: "UIF Reference Number", type: "text", required: true, validationRegex: "^\\d{7,9}(/\\d)?$", validationMessage: "e.g. 1234567/8" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "registration_date", label: "Registration Date", type: "date", required: false },
            { key: "status", label: "Status", type: "text", required: false }
        ]
    },
    paye_reg: {
        label: "PAYE Registration",
        category: "TAX",
        mandatory: false,
        fields: [
            { key: "paye_number", label: "PAYE Number", type: "text", required: true, validationRegex: "^\\d{10}$", validationMessage: "10 digits" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "registration_date", label: "Registration Date", type: "date", required: false },
            { key: "status", label: "Status", type: "text", required: false }
        ]
    },

    // BBBEE
    bbbee_cert: {
        label: "B-BBEE Certificate / Sworn Affidavit",
        category: "BBBEE",
        mandatory: true,
        wMetadata: ["level"],
        fields: [
            { key: "bbbee_level", label: "B-BBEE Level", type: "select", options: ["1", "2", "3", "4", "5", "6", "7", "8", "Non-Compliant"], required: true },
            { key: "black_ownership_percent", label: "Black Ownership %", type: "text", required: true, validationRegex: "^\\d{1,3}(\\.\\d+)?\\s*%?$", validationMessage: "Enter valid percentage (e.g. 51 or 51%)" },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "certificate_or_affidavit_number", label: "Certificate Number", type: "text", required: false },
            { key: "issue_date", label: "Issue Date", type: "date", required: true },
            { key: "expiry_date", label: "Expiry Date", type: "date", required: true },
            { key: "issuing_body", label: "Issuing Body", type: "text", required: false }
        ]
    },
    sbd_6_1: { label: "SBD 6.1 Preference Points Claim", category: "BBBEE", mandatory: true },

    // Labour
    coid_letter: {
        label: "COID Letter of Good Standing",
        category: "LABOUR",
        mandatory: true,
        fields: [
            { key: "coid_ref", label: "COID Reference", type: "text", required: true },
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "issue_date", label: "Issue Date", type: "date", required: true },
            { key: "expiry_date", label: "Expiry Date", type: "date", required: true },
            { key: "status", label: "Status", type: "text", required: true }
        ]
    },
    ohs_plan: {
        label: "Occupational Health & Safety Plan",
        category: "LABOUR",
        mandatory: true,
        fields: [
            { key: "entity_name", label: "Entity Name", type: "text", required: true },
            { key: "plan_number", label: "Plan Number", type: "text", required: false },
            { key: "safety_officer", label: "Safety Officer", type: "text", required: false },
            { key: "issue_date", label: "Issue Date", type: "date", required: false },
            { key: "revision_date", label: "Date of Last Revision", type: "date", required: true },
            { key: "status", label: "Status", type: "text", required: false }
        ]
    },
    she_file: { label: "SHE File Index", category: "LABOUR", mandatory: false },

    // Financial
    bank_letter: {
        label: "Bank Confirmation Letter",
        category: "FINANCIAL",
        mandatory: true,
        fields: [
            { key: "bank_name", label: "Bank Name", type: "text", required: true },
            { key: "account_holder", label: "Account Holder Name", type: "text", required: true },
            { key: "account_number_last4", label: "Account Last 4", type: "text", required: false, validationRegex: "^\\d{4}$" },
            { key: "issue_date", label: "Issue Date", type: "date", required: true },
            { key: "branch_code", label: "Branch Code", type: "text", required: false }
        ]
    }
} as const;

export type DocTypeKey = keyof typeof DOCUMENT_TYPES;
