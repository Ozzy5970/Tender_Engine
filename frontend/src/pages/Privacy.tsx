import { ArrowLeft, Lock } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Privacy() {
    const navigate = useNavigate()

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 font-sans text-gray-600">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </button>

            <div className="bg-green-50 border border-green-100 rounded-2xl p-8 mb-12">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-lg text-green-600">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Plain English Summary</h2>
                        <ul className="space-y-2 text-sm text-gray-700 list-disc pl-4">
                            <li>**We collect**: Your company details, compliance docs (PDFs), and usage data.</li>
                            <li>**We use it to**: Verify your tender readiness and improve our AI.</li>
                            <li>**We DO NOT**: Sell your data to third parties.</li>
                            <li>**Security**: Your files are stored in encrypted, private buckets (Row Level Security).</li>
                        </ul>
                    </div>
                </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
            <p className="text-sm text-gray-400 mb-12">Last Updated: January 26, 2026</p>

            <div className="prose prose-green max-w-none">
                <h3>1. Information We Collect</h3>
                <p>
                    We collect information you provide directly to us, such as:
                    - **Account Data**: Name, email, company name.
                    - **Compliance Data**: CSD Reports, Tax Certificates, CIDB data.
                    - **Usage Data**: How you interact with our dashboard.
                </p>

                <h3>2. How We Use Your Information</h3>
                <p>
                    We use your information to:
                    - Provide, maintain, and improve our services.
                    - Process checks to see if you qualify for specific tenders.
                    - Communicate with you about services, offers, and events.
                </p>

                <h3>3. Data Security</h3>
                <p>
                    We implement industry-standard security measures, including:
                    - **Encryption**: Data is encrypted in transit (TLS) and at rest.
                    - **Access Control**: Strict Row Level Security (RLS) ensures nobody can see your files but you and authorized admins.
                </p>

                <h3>4. Sharing of Information</h3>
                <p>
                    We do not share your personal information with third parties except:
                    - With your consent.
                    - To comply with laws.
                    - With service providers (e.g., Payment Processors, Hosting) who need access to perform services for us.
                </p>

                <h3>5. Your Rights</h3>
                <p>
                    You have the right to:
                    - Access the personal information we hold about you.
                    - Request correction of inaccurate data.
                    - Request deletion of your account and data.
                </p>

                <p className="mt-12 text-sm text-gray-400">
                    For privacy concerns, contact privacy@antigravity.co.za.
                </p>
            </div>
        </div>
    )
}
