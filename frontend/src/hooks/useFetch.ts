import { useState, useEffect, useCallback } from 'react'
import type { ApiResponse } from '@/types/api'

type FetchFunction<T> = () => Promise<ApiResponse<T>>

export function useFetch<T>(fetchFn: FetchFunction<T>, dependencies: any[] = [], autoFetch = true) {
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState<boolean>(autoFetch)

    const execute = useCallback(async () => {
        setLoading(true)
        setError(null)

        const response = await fetchFn()

        if (response.error) {
            setError(response.error)
            setData(null)
        } else {
            setData(response.data)
            setError(null)
        }

        setLoading(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...dependencies])

    useEffect(() => {
        if (autoFetch) {
            execute()
        }
    }, [execute, autoFetch])

    return { data, error, loading, refetch: execute }
}
