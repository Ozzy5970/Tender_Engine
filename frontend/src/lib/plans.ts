
/**
 * Normalizes various plan/tier representations into a standard set of UI labels.
 * 
 * MAPPING RULES:
 * - 1, "1", "Tier 1", "free", null, undefined, "" => "Free Plan"
 * - 2, "2", "Tier 2", "standard", "basic" => "Basic Plan"
 * - 3, "3", "Tier 3", "pro", "enterprise" => "Pro Plan"
 * 
 * @param input - The raw plan string or tier number from the database or API.
 * @returns One of: "Free Plan", "Basic Plan", "Pro Plan"
 */
export function normalizePlanLabel(input: string | number | null | undefined): string {
    if (input === null || input === undefined || input === '') {
        return "Free Plan";
    }

    const s = String(input).trim().toLowerCase();

    // Rule 1: Free Plan
    if (
        s === '1' ||
        s === 'tier 1' ||
        s.includes('free')
    ) {
        return "Free Plan";
    }

    // Rule 2: Basic Plan (formerly Standard / Tier 2)
    if (
        s === '2' ||
        s === 'tier 2' ||
        s.includes('standard') ||
        s.includes('basic')
    ) {
        return "Basic Plan";
    }

    // Rule 3: Pro Plan (formerly Tier 3 / Enterprise)
    if (
        s === '3' ||
        s === 'tier 3' ||
        s.includes('pro') ||
        s.includes('enterprise')
    ) {
        return "Pro Plan";
    }

    // Fallback for unknown values
    return "Free Plan";
}
