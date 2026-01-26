import { ArrowLeft, Shield } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Terms() {
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

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 mb-12">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Plain English Summary</h2>
                        <ul className="space-y-2 text-sm text-gray-700 list-disc pl-4">
                            <li>We provide software to help you analyze tenders, but **we do not guarantee you will win**.</li>
                            <li>You own your data (documents, profiles). We verify it but **do not share it without permission**.</li>
                            <li>Payments are **R2,500/month**. You can cancel anytime, effective the next billing cycle.</li>
                            <li>We are not a legal firm. Our "Readiness Checks" are automated guides, not legal advice.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
            <p className="text-sm text-gray-400 mb-12">Last Updated: January 26, 2026</p>

            <div className="prose prose-blue max-w-none">
                <h3>1. Introduction</h3>
                <p>
                    Welcome to Antigravity. By using our website and services, you agree to these Terms of Service.
                    If you disagree with any part of these terms, please do not use our services.
                </p>

                <h3>2. Services Provided</h3>
                <p>
                    Antigravity provides an automated tender analysis and compliance readiness platform.
                    While we strive for accuracy, the final responsibility for tender submission lies with you, the user.
                    We are not liable for disqualified tenders or lost contracts.
                </p>

                <h3>3. User Accounts</h3>
                <p>
                    To access certain features, you must register an account. You represent that all information provided is accurate.
                    You are responsible for maintaining the confidentiality of your login credentials.
                </p>

                <h3>4. Payment & Subscriptions</h3>
                <p>
                    We offer a subscription service billed monthly at **R2,500**.
                    - **Cancellation**: You may cancel at any time via your Settings page.
                    - **Refunds**: Fees are non-refundable except as required by law.
                </p>

                <h3>5. Data Privacy & Ownership</h3>
                <p>
                    Your documents (Tax Clearance, CSD reports, etc.) remain your property.
                    We use them solely to perform readiness checks and improve our analysis algorithms.
                    See our **Privacy Policy** for full details.
                </p>

                <h3>6. Limitation of Liability</h3>
                <p>
                    To the maximum extent permitted by law, Antigravity shall not be liable for any indirect, incidental,
                    or consequential damages arising out of the use of our service.
                </p>

                <h3>7. Changes to Terms</h3>
                <p>
                    We reserve the right to modify these terms at any time. We will notify users of significant changes via email or dashboard notifications.
                </p>

                <p className="mt-12 text-sm text-gray-400">
                    Contact us at legal@antigravity.co.za if you have any questions.
                </p>
            </div>
        </div>
    )
}
