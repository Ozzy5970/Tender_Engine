import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { AdminService } from "@/services/api"
import { ArrowLeft, Mail, Phone, ShieldCheck, CreditCard, FileText, CheckCircle2, AlertTriangle } from "lucide-react"

export default function AdminUserDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) loadData(id)
    }, [id])

    const loadData = async (userId: string) => {
        const { data: details, error } = await AdminService.getUserDetails(userId)
        if (error) console.error(error)
        setData(details)
        setLoading(false)
    }

    if (loading) return <div className="p-12 text-center">Loading Profile...</div>
    if (!data) return <div className="p-12 text-center text-red-600">User not found</div>

    const { profile, docs, tenderCount, history } = data

    return (
        <div className="max-w-5xl mx-auto py-8 space-y-8">
            <button
                onClick={() => navigate("/admin/users")}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to User List
            </button>

            {/* Header / Profile Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row gap-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-700 shrink-0">
                    {profile?.company_name?.charAt(0) || "C"}
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{profile?.company_name || "Unknown Company"}</h1>
                        <p className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {profile?.email || "No Email (Auth)"}</span>
                            {profile?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.phone}</span>}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">Registration No</span>
                            <p className="font-mono text-sm">{profile?.registration_number || '-'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">Tax Reference</span>
                            <p className="font-mono text-sm">{profile?.tax_reference || '-'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">CIDB Grading</span>
                            <p className="font-mono text-sm">{profile?.cidb_grade_grading ? `${profile.cidb_grade_grading}${profile.cidb_grade_class}` : '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Subscription History */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                        Subscription History
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history && history.length > 0 ? history.map((h: any) => (
                                    <tr key={h.id}>
                                        <td className="px-4 py-3">{new Date(h.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 font-medium">{h.plan_name}</td>
                                        <td className="px-4 py-3">R{h.amount}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs border border-green-100">{h.status || 'Paid'}</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-400">No history found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Compliance Docs */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-gray-500" />
                        Compliance Vault ({docs?.length || 0})
                    </h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        {docs && docs.length > 0 ? docs.map((doc: any) => {
                            const isExpired = new Date(doc.expiry_date) < new Date()
                            return (
                                <div key={doc.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 capitalize">{doc.doc_type.replace(/_/g, ' ')}</p>
                                            <p className="text-xs text-gray-500">Exp: {doc.expiry_date || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {isExpired ? (
                                        <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expired</span>
                                    ) : (
                                        <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                                    )}
                                </div>
                            )
                        }) : (
                            <div className="p-6 text-center text-gray-400 text-sm">No documents uploaded.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Usage Stats */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-gray-900">Platform Usage</h3>
                    <p className="text-sm text-gray-500">Engagement metrics for this customer.</p>
                </div>
                <div className="flex gap-8">
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-blue-600">{tenderCount}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Tenders Created</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-purple-600">{history?.length || 0}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Invoices</span>
                    </div>
                </div>
            </div>

        </div>
    )
}
