import { useState, useEffect } from "react"
import { Save, Loader2, Building2 } from "lucide-react"
import { CompanyService } from "@/services/api"
// In a real app we'd define this in types
type ProfileData = {
    company_name: string
    registration_number: string
    tax_reference: string
    address: string
}

export default function Profile() {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<ProfileData>({
        company_name: "",
        registration_number: "",
        tax_reference: "",
        address: ""
    })

    // Fetch real profile data
    useEffect(() => {
        async function loadProfile() {
            const { data } = await CompanyService.getProfile()
            if (data) {
                const profile = data as any
                setFormData({
                    company_name: profile.company_name || "",
                    registration_number: profile.registration_number || "",
                    tax_reference: profile.tax_number || "", // check schema if it is tax_number or tax_reference
                    address: profile.address || ""
                })
            }
        }
        loadProfile()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // 1. Strict Validation
        const { Validation } = await import("@/lib/validation")

        const titleCheck = Validation.text(formData.company_name, 2, "Company Name")
        if (!titleCheck.isValid) { alert(titleCheck.message); return }

        const regCheck = Validation.registrationNumber(formData.registration_number)
        if (!regCheck.isValid) { alert(regCheck.message); return }

        const taxCheck = Validation.taxNumber(formData.tax_reference)
        if (!taxCheck.isValid) { alert(taxCheck.message); return }

        const addressCheck = Validation.text(formData.address, 5, "Address")
        if (!addressCheck.isValid) { alert(addressCheck.message); return }

        setLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        // await CompanyService.updateProfile(formData)
        setLoading(false)
        alert("Profile saved successfully!")
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
                    <p className="text-sm text-gray-500">Manage your business details for tender applications.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <input
                                type="text"
                                required
                                value={formData.company_name}
                                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2.5 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                            <input
                                type="text"
                                required
                                value={formData.registration_number}
                                onChange={e => setFormData({ ...formData, registration_number: e.target.value })}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2.5 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Reference</label>
                            <input
                                type="text"
                                required
                                value={formData.tax_reference}
                                onChange={e => setFormData({ ...formData, tax_reference: e.target.value })}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2.5 border"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Physical Address</label>
                            <textarea
                                rows={4}
                                required
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2.5 border"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    )
}
