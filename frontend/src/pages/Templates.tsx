import { useEffect, useState } from "react"
import { FileText, Download } from "lucide-react"
import { TemplateService } from "@/services/api"
import { toast } from "sonner"
// import { supabase } from "@/lib/supabase"

import { useAuth } from "@/context/AuthContext"

export default function Templates() {
    const { tier } = useAuth()
    const isPro = tier === 'Pro'
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                    Government Tender Library
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Access official South African Government Bidding Documents (SBD & MBD).
                </p>
                <div className="mt-6 p-4 rounded-r-lg border-l-4 border-amber-500 bg-white shadow-sm text-sm text-gray-700">
                    <p><strong>Disclaimer:</strong> While we strive to ensure these templates are current, government regulations and document formats may change without notice. Please always verify the latest version with the relevant department before submission.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading library...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className={`rounded-xl border p-6 hover:shadow-md transition-all flex flex-col 
                                ${isPro
                                    ? 'bg-zinc-900 border-purple-900 shadow-lg shadow-purple-900/10'
                                    : 'bg-white border-gray-200 shadow-sm'}`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-2 rounded-lg ${isPro ? 'bg-purple-900/30' : 'bg-gray-100'}`}>
                                    <FileText className={`w-8 h-8 ${isPro ? 'text-purple-300' : 'text-gray-600'}`} />
                                </div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded 
                                    ${isPro ? 'bg-purple-900/50 text-purple-200 border border-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {template.code}
                                </span>
                            </div>

                            <h3 className={`font-bold mb-2 ${isPro ? 'text-white' : 'text-gray-900'}`}>{template.title}</h3>
                            <p className={`text-sm mb-4 flex-1 ${isPro ? 'text-gray-300' : 'text-gray-500'}`}>{template.description}</p>

                            <div className={`flex items-center text-xs mb-6 ${isPro ? 'text-gray-500' : 'text-gray-400'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isPro ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                                Last updated: {new Date(template.updated_at || template.created_at || new Date()).toLocaleDateString()}
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        toast.info("Starting download...")
                                        const url = await TemplateService.download(template)

                                        // Fetch as blob to force download
                                        const response = await fetch(url)
                                        if (!response.ok) throw new Error('Download failed')

                                        const blob = await response.blob()
                                        const blobUrl = window.URL.createObjectURL(blob)

                                        // Create invisible link and click it
                                        const link = document.createElement('a')
                                        link.href = blobUrl
                                        link.download = `${template.title}.pdf` // Force .pdf extension for templates
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)

                                        // Clean up
                                        window.URL.revokeObjectURL(blobUrl)
                                        toast.success("Download complete!")
                                    } catch (e) {
                                        console.error("Download error:", e)
                                        toast.error("Failed to download template. Please try again.")
                                    }
                                }}
                                className={`w-full flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors
                                    ${isPro
                                        ? 'border-purple-800 text-purple-200 hover:bg-purple-800 hover:text-white hover:border-purple-700'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
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
