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
