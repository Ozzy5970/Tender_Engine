import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDebug() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function runDiagnostics() {
            const results: any = {}

            try {
                // 1. Auth User
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                results.user = { id: user?.id, email: user?.email, error: authError }

                if (user?.id) {
                    // 2. Profile Check
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', user.id)
                        .single()
                    results.profile = { is_admin: profile?.is_admin, error: profileError }

                    // 3. Admin Table Check
                    const { data: admin, error: adminError } = await supabase
                        .from('admins')
                        .select('*')
                        .eq('id', user.id)
                        .single()
                    results.adminTable = { exists: !!admin, record: admin, error: adminError }

                    // 4. RPC Snapshot
                    const { data: snapshot, error: rpcError, status } = await supabase
                        .rpc('get_admin_dashboard_snapshot')

                    results.rpc = {
                        status,
                        error: rpcError,
                        data: snapshot
                    }
                }
            } catch (e: any) {
                results.exception = e.message
            }

            setData(results)
            setLoading(false)
        }

        runDiagnostics()
    }, [])

    if (loading) return <div className="p-8">Running Diagnostics...</div>

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Admin Security Diagnostics</h1>

            <div className="space-y-6">
                {/* User Identity */}
                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold border-b pb-2 mb-2">1. User Identity</h2>
                    <pre className="text-sm overflow-auto">
                        {JSON.stringify(data.user, null, 2)}
                    </pre>
                </div>

                {/* Permissions */}
                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold border-b pb-2 mb-2">2. Permissions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold text-xs uppercase text-gray-500">public.profiles (is_admin)</h3>
                            <pre className="text-sm mt-1">{JSON.stringify(data.profile, null, 2)}</pre>
                        </div>
                        <div>
                            <h3 className="font-semibold text-xs uppercase text-gray-500">public.admins (RBAC Source)</h3>
                            <pre className="text-sm mt-1">{JSON.stringify(data.adminTable, null, 2)}</pre>
                        </div>
                    </div>
                </div>

                {/* RPC Test */}
                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold border-b pb-2 mb-2">3. RPC: get_admin_dashboard_snapshot</h2>

                    <div className="mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${data.rpc.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            HTTP {data.rpc.status}
                        </span>
                        {data.rpc.error && <span className="ml-2 text-red-600 text-sm">{data.rpc.error.message}</span>}
                    </div>

                    <pre className="text-xs bg-black text-green-400 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(data.rpc.data, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    )
}
