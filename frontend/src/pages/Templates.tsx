import { useEffect, useState } from "react"
import { FileText, Download, ShieldCheck } from "lucide-react"
import { TemplateService } from "@/services/api"
// import { supabase } from "@/lib/supabase"

export default function Templates() {
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadTemplates()
    }, [])

    const loadTemplates = async () => {
        const { data } = await TemplateService.getAll()
        if (data) setTemplates(data as any[])
        setLoading(false)
    }



    return (
        <div className="max-w-5xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Standard Tender Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">Download official South African Government Bidding Documents (SBD).</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verified for Public Sector
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading library...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div key={template.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <FileText className="w-8 h-8 text-gray-600" />
                                </div>
                                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {template.code}
                                </span>
                            </div>

                            <h3 className="font-bold text-gray-900 mb-2">{template.title}</h3>
                            <p className="text-sm text-gray-500 mb-6 flex-1">{template.description}</p>

                            <button
                                onClick={async () => {
                                    const url = await TemplateService.download(template)
                                    window.open(url, '_blank')
                                }}
                                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download PDF
                            </button>
                        </div>
                    ))}
                    {templates.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            No templates found in the library.
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 bg-gray-50 rounded-xl p-8 border border-gray-200">
                <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Guarantees Compliance when used correctly.
                </div>
            </div>
        </div>
    )
}
