import { useState, useRef } from "react"
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react"

export default function TenderUpload() {
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files[0]) {
            handleFiles(Array.from(e.target.files))
        }
    }

    const handleFiles = (newFiles: File[]) => {
        // Filter for PDF
        const pdfs = newFiles.filter(file => file.type === "application/pdf")
        setFiles(prev => [...prev, ...pdfs])
    }

    const handleUpload = async () => {
        setUploading(true)
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 2000))
        setUploading(false)
        // In a real app, this would upload to Supabase Storage
        alert("Tender document uploaded successfully!")
        setFiles([])
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900">Ingest Tender Document</h1>
            <p className="mt-2 text-gray-600">Upload or drag and drop your tender PDF to begin the analysis.</p>

            <div className="mt-8 space-y-6">
                {/* Upload Zone */}
                <div
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50"
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        multiple={false}
                        accept=".pdf"
                        onChange={handleChange}
                    />

                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-gray-50 rounded-full">
                            <Upload className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-gray-900">
                                Drag and drop your file here
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                or <button onClick={() => inputRef.current?.click()} className="text-primary hover:text-primary/80 font-medium">browse files</button> on your computer
                            </p>
                        </div>
                        <p className="text-xs text-gray-400">PDF up to 50MB</p>
                    </div>
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">Ready to Upload ({files.length})</h3>
                            <button onClick={() => setFiles([])} className="text-xs text-red-600 hover:text-red-700">Clear all</button>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {files.map((file, idx) => (
                                <li key={idx} className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                </li>
                            ))}
                        </ul>
                        <div className="p-4 bg-gray-50">
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                            >
                                {uploading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                                {uploading ? "Processing..." : "Start Analysis"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
