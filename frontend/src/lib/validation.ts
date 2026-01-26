export type ValidationResult = {
    isValid: boolean
    errorCode?: string
    message?: string
}

export const Validation = {
    /**
     * Ensures string is not empty and meets minimum length
     */
    text(value: string, minLength = 3, fieldName: string): ValidationResult {
        if (!value || value.trim().length === 0) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_EMPTY`, message: `${fieldName} is required.` }
        }
        if (value.trim().length < minLength) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_SHORT`, message: `${fieldName} must be at least ${minLength} characters.` }
        }
        return { isValid: true }
    },

    /**
     * Ensures date is valid and in the future (or today)
     */
    futureDate(dateStr: string, fieldName: string): ValidationResult {
        if (!dateStr) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_EMPTY`, message: `${fieldName} is required.` }
        }
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_INVALID`, message: `${fieldName} is not a valid date.` }
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Allow today
        if (date < today) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_PAST`, message: `${fieldName} cannot be in the past.` }
        }
        return { isValid: true }
    },

    /**
     * Ensures number is within range
     */
    number(value: any, min: number, max: number, fieldName: string): ValidationResult {
        const num = Number(value)
        if (isNaN(num)) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_NAN`, message: `${fieldName} must be a number.` }
        }
        if (num < min || num > max) {
            return { isValid: false, errorCode: `VAL_${fieldName.toUpperCase()}_RANGE`, message: `${fieldName} must be between ${min} and ${max}.` }
        }
        return { isValid: true }
    },

    /**
     * Valdiate South African Company Registration Number (YYYY/NNNNNN/NN)
     * Simple regex for now: 4 digits / 6 digits / 2 digits
     */
    registrationNumber(value: string): ValidationResult {
        const regEx = /^\d{4}\/\d{6}\/\d{2}$/
        if (!value) return { isValid: false, errorCode: 'VAL_REG_EMPTY', message: 'Registration number is required' }

        if (!regEx.test(value)) {
            return { isValid: false, errorCode: 'VAL_REG_FORMAT', message: 'Format must be YYYY/NNNNNN/NN' }
        }
        return { isValid: true }
    },

    /**
     * Validate Tax Reference Number (10 digits)
     */
    taxNumber(value: string): ValidationResult {
        const regEx = /^\d{10}$/
        if (!value) return { isValid: false, errorCode: 'VAL_TAX_EMPTY', message: 'Tax number is required' }

        if (!regEx.test(value)) {
            return { isValid: false, errorCode: 'VAL_TAX_FORMAT', message: 'Tax number must be 10 digits' }
        }
        return { isValid: true }
    },

    /**
     * Validate Phone Number (10-12 digits, optional +)
     */
    phone(value: string): ValidationResult {
        // Allow +27 or 0 start, 9-11 digits following
        const regEx = /^(\+27|0)\d{9}$/
        if (!value) return { isValid: false, errorCode: 'VAL_PHONE_EMPTY', message: 'Phone number is required' }

        if (!regEx.test(value.replace(/\s/g, ''))) {
            return { isValid: false, errorCode: 'VAL_PHONE_FORMAT', message: 'Invalid phone number format (e.g. 0821234567)' }
        }
        return { isValid: true }
    }
}
