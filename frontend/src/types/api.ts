export type ApiResponse<T> = {
    data: T | null
    error: string | null
    status: number
}

export type ApiError = {
    message: string
    code?: string
    details?: any
}

// Admin Data Contract
export interface AdminAnalyticsMetrics {
    lifetimeRevenuePaid: number      // From subscription_history (paid)
    mrrActiveSubscriptions: number   // From subscriptions (active)
    totalUsers: number               // From auth.users
    activeUsers30d: number           // From auth.users (activity based)
    activeSubscriptions: number      // From subscriptions (count)
    errorCount24h: number            // From error_logs
    perfectComplianceUsers: number   // From doc analysis
    userGrowthSeries: { name: string; users: number }[]
    complianceSplit?: { compliant: number; at_risk: number }
}
