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
            {
                key: "registration_number",
                label: "Company Registration Number",
                type: "text",
                placeholder: "YYYY/NNNNNN/NN",
                required: true,
                validationRegex: "^\\d{4}/\\d{6}/\\d{2}$",
                validationMessage: "Format must be YYYY/NNNNNN/NN"
            }
        ]
    },
    shareholding: { label: "Shareholding / Share Certificates", category: "COMPANY", mandatory: false },

    // CIDB
    cidb_cert: {
        label: "CIDB Certificate",
        category: "CIDB",
        mandatory: true,
        wMetadata: ["grade", "class"],
        fields: [
            {
                key: "grade",
                label: "CIDB Grade",
                type: "select",
                options: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
                required: true
            },
            {
                key: "class",
                label: "Class of Work",
                type: "select",
                options: ["CE", "GB", "ME", "EP", "EB", "SO", "SQ", "SH", "SI", "SJ", "SK", "SL"],
                required: true
            },
            {
                key: "crs_number",
                label: "CRS Number",
                type: "text",
                placeholder: "e.g. 10012345",
                required: true,
                validationRegex: "^\\d{6,8}$",
                validationMessage: "CRS Number should be 6-8 digits"
            }
        ]
    },

    // Tax
    sars_pin: {
        label: "SARS Tax Clearance Pin",
        category: "TAX",
        mandatory: true,
        fields: [
            {
                key: "pin",
                label: "10-digit Tax PIN",
                type: "text",
                placeholder: "e.g. A1B2C3D4E5",
                required: true,
                validationRegex: "^[A-Za-z0-9]{10}$",
                validationMessage: "Must be exactly 10 alphanumeric characters"
            },
            // Expiry is handled by global field, but we can make it explicit in UI labels if needed
        ]
    },
    csd_summary: {
        label: "CSD Registration Summary",
        category: "TAX",
        mandatory: true,
        fields: [
            {
                key: "maaa_number",
                label: "MAAA Number",
                type: "text",
                placeholder: "MAAAxxxxxxx",
                required: true,
                validationRegex: "^MAAA\\d{7}$",
                validationMessage: "Must start with MAAA followed by 7 digits"
            }
        ]
    },
    vat_cert: {
        label: "VAT Registration",
        category: "TAX",
        mandatory: false,
        fields: [
            {
                key: "vat_number",
                label: "VAT Number",
                type: "text",
                placeholder: "4-series VAT number",
                required: true,
                validationRegex: "^4\\d{9}$",
                validationMessage: "VAT Number must start with 4 and be 10 digits"
            }
        ]
    },
    uif_reg: {
        label: "UIF Registration",
        category: "TAX",
        mandatory: true,
        fields: [
            {
                key: "uif_number",
                label: "UIF Reference Number",
                type: "text",
                placeholder: "e.g. 1234567/8",
                required: true,
                validationRegex: "^\\d{7,9}(/\\d)?$",
                validationMessage: "Invalid UIF format (e.g. 1234567/8)"
            }
        ]
    },
    paye_reg: { label: "PAYE Registration", category: "TAX", mandatory: false },

    // BBBEE
    bbbee_cert: {
        label: "B-BBEE Certificate / Sworn Affidavit",
        category: "BBBEE",
        mandatory: true,
        wMetadata: ["level"],
        fields: [
            {
                key: "level",
                label: "B-BBEE Level",
                type: "select",
                options: ["1", "2", "3", "4", "5", "6", "7", "8", "Non-Compliant"],
                required: true
            },
            {
                key: "black_ownership",
                label: "Black Ownership %",
                type: "text",
                placeholder: "e.g. 51%",
                required: true,
                validationRegex: "^\\d{1,3}(\\.\\d{1,2})?%?$",
                validationMessage: "Enter a valid percentage (e.g. 51 or 51%)"
            }
        ]
    },
    sbd_6_1: {
        label: "SBD 6.1 Preference Points Claim",
        category: "BBBEE",
        mandatory: true,
        fields: [
            // Standard form, no specific extra metadata needed for V1
        ]
    },

    // Labour
    coid_letter: {
        label: "COID Letter of Good Standing",
        category: "LABOUR",
        mandatory: true,
        fields: [
            // Expiry is global
            { key: "coid_ref", label: "COID Reference", type: "text", placeholder: "e.g. 9900012345", required: false }
        ]
    },
    ohs_plan: {
        label: "Occupational Health & Safety Plan",
        category: "LABOUR",
        mandatory: true,
        fields: [
            { key: "revision_date", label: "Date of Last Revision", type: "date", required: true }
        ]
    },
    she_file: { label: "SHE File Index", category: "LABOUR", mandatory: false },

    // Financial
    bank_letter: {
        label: "Bank Confirmation Letter",
        category: "FINANCIAL",
        mandatory: true,
        fields: [
            { key: "bank_name", label: "Bank Name", type: "text", placeholder: "e.g. FNB", required: true },
            { key: "account_holder", label: "Account Holder Name", type: "text", placeholder: "Company Name", required: true }
        ]
    },
} as const;

export type DocTypeKey = keyof typeof DOCUMENT_TYPES;
