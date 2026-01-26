export type SubscriptionTier = "Free" | "Standard" | "Pro"

export type FeatureKey =
    | "UNLIMITED_TENDERS"
    | "DEEP_AI_ANALYSIS"
    | "COMPLIANCE_ALERTS"
    | "TEMPLATE_ACCESS"

export const FEATURES: Record<SubscriptionTier, FeatureKey[]> = {
    Free: ["TEMPLATE_ACCESS"], // Strictly basic
    Standard: ["TEMPLATE_ACCESS", "COMPLIANCE_ALERTS"],
    Pro: ["UNLIMITED_TENDERS", "DEEP_AI_ANALYSIS", "COMPLIANCE_ALERTS", "TEMPLATE_ACCESS"]
}

export const FeatureGate = {
    hasAccess(tier: SubscriptionTier, feature: FeatureKey): boolean {
        const allowed = FEATURES[tier] || []
        return allowed.includes(feature)
    },

    getLimit(tier: SubscriptionTier, _feature: "TENDER_LIMIT"): number {
        if (tier === "Pro") return 9999
        if (tier === "Standard") return 20
        return 1
    }
}
