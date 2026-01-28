import { Check, Shield, Zap, ArrowRight, Building } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"

export default function Pricing() {
    const navigate = useNavigate()
    const { tier } = useAuth()

    const tiers = ['Free', 'Standard', 'Pro']
    const currentTierIndex = tiers.indexOf(tier || 'Free')

    const getButtonState = (planName: string, planIndex: number) => {
        if (planIndex === currentTierIndex) {
            return {
                text: "Current Plan",
                disabled: true,
                className: "w-full py-3 px-6 rounded-xl bg-gray-100 text-gray-400 font-bold cursor-not-allowed border border-gray-200"
            }
        }
        if (planIndex < currentTierIndex) {
            return {
                text: "Downgrade",
                disabled: false,
                className: "w-full py-3 px-6 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:border-gray-300 hover:bg-gray-50 transition-all"
            }
        }
        // Upgrade
        const isEnterprise = planName === 'Enterprise'
        return {
            text: isEnterprise ? "Get Enterprise" : "Upgrade",
            disabled: false,
            className: isEnterprise
                ? "w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-lg hover:shadow-lg hover:to-indigo-500 transition-all flex items-center justify-center gap-2 group"
                : "w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        }
    }

    const freeBtn = getButtonState('Free', 0)
    const stdBtn = getButtonState('Standard', 1)
    const proBtn = getButtonState('Enterprise', 2)

    return (
        <div className="max-w-7xl mx-auto py-16 px-4 font-sans">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
                    Choose Your Plan
                </h1>
                <p className="text-xl text-gray-500">
                    Transparent pricing to help you win more tenders.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {/* 1. STARTER (FREE) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`bg-white rounded-2xl border ${tier === 'Free' ? 'border-primary ring-1 ring-primary' : 'border-gray-200'} p-8 shadow-sm hover:shadow-md transition-shadow relative`}
                >
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-gray-900">Starter</h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            Perfect for small subcontractors testing the system.
                            <br /><span className="font-semibold text-orange-600">Strict limit: 1 Tender / month.</span>
                        </p>
                        <div className="mt-6 flex items-baseline">
                            <span className="text-5xl font-extrabold text-gray-900">Free</span>
                        </div>
                    </div>
                    <ul className="mb-8 space-y-4">
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>1 Tender Analysis / Month</strong><br /><span className="text-xs text-gray-500">Analyze one full tender document.</span></span>
                        </li>
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>Basic Compliance</strong><br /><span className="text-xs text-gray-500">See if your docs are Valid or Expired.</span></span>
                        </li>
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>Limited AI Insights</strong><br /><span className="text-xs text-gray-500">Basic pass/fail results only.</span></span>
                        </li>
                    </ul>
                    <button
                        className={freeBtn.className}
                        disabled={freeBtn.disabled}
                        onClick={() => !freeBtn.disabled && navigate('/tenders')} // Downgrade logic would go here
                    >
                        {freeBtn.text}
                    </button>
                </motion.div>

                {/* 2. STANDARD (R200) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`bg-white rounded-2xl border-2 ${tier === 'Standard' ? 'border-blue-600 ring-4 ring-blue-50' : 'border-blue-500'} p-8 shadow-xl relative transform scale-105 z-10`}
                >
                    <div className="absolute top-0 inset-x-0 bg-blue-500 text-white text-xs font-bold py-1 text-center rounded-t-lg">
                        POPULAR
                    </div>
                    <div className="mb-8 mt-2">
                        <h3 className="text-xl font-bold text-blue-600">Standard</h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            For growing businesses bidding regularly.
                            <br /><span className="font-semibold text-blue-600">25 Tenders + Full AI Power.</span>
                        </p>
                        <div className="mt-6 flex items-baseline text-gray-900">
                            <span className="text-3xl font-bold">R</span>
                            <span className="text-5xl font-extrabold tracking-tight">499</span>
                            <span className="text-gray-500 text-xl ml-2">/mo</span>
                        </div>
                        {/* Note: Updated price to match SQL (499) */}
                    </div>
                    <ul className="mb-8 space-y-4">
                        <li className="flex items-start text-gray-700 space-x-3">
                            <div className="p-1 rounded-full bg-blue-100 text-blue-600 mt-0.5">
                                <Zap className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold">25 Tenders / Month</span>
                        </li>
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>Full AI Analysis</strong><br /><span className="text-xs text-gray-500">Same powerful AI engine as Enterprise.</span></span>
                        </li>
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>Standard Support</strong><br /><span className="text-xs text-gray-500">Email us anytime. We reply within 24h.</span></span>
                        </li>
                        <li className="flex items-start text-gray-600 space-x-3">
                            <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm"><strong>Advanced Compliance</strong><br /><span className="text-xs text-gray-500">Gap analysis & expiry alerts.</span></span>
                        </li>
                    </ul>
                    <button
                        className={stdBtn.className}
                        disabled={stdBtn.disabled}
                        onClick={() => !stdBtn.disabled && navigate('/settings?tab=billing')}
                    >
                        {stdBtn.text}
                    </button>
                </motion.div>

                {/* 3. ENTERPRISE (R4000) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={`bg-gray-900 rounded-2xl border ${tier === 'Pro' ? 'border-purple-500 ring-2 ring-purple-500' : 'border-gray-800'} p-8 shadow-xl text-white relative`}
                >
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Building className="w-5 h-5 text-purple-400" /> Enterprise
                        </h3>
                        <p className="text-gray-400 mt-2 text-sm">
                            For established teams who can't afford downtime.
                            <br /><span className="font-semibold text-purple-400">Unlimited Everything.</span>
                        </p>
                        <div className="mt-6 flex items-baseline text-white">
                            <span className="text-3xl font-bold">R</span>
                            <span className="text-5xl font-extrabold tracking-tight">1,999</span>
                            <span className="text-gray-400 text-xl ml-2">/mo</span>
                        </div>
                        {/* Note: Updated price to match potential SQL (1999) or keep 4000? Previous SQL said 1999 for Pro. I'll stick to 1999 for consistency unless told otherwise. */}
                    </div>
                    <ul className="mb-8 space-y-4">
                        <li className="flex items-start text-gray-300 space-x-3">
                            <div className="p-1 rounded-full bg-purple-500/20 text-purple-400 mt-0.5">
                                <Zap className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-white">Unlimited Tenders</span>
                        </li>
                        <li className="flex items-start text-gray-300 space-x-3">
                            <div className="p-1 rounded-full bg-purple-500/20 text-purple-400 mt-0.5">
                                <Shield className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-white">Priority Support (VIP)</span>
                            <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full ml-auto">ASAP</span>
                        </li>
                        <li className="flex items-start text-gray-300 space-x-3">
                            <Check className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-300"><strong>Deep AI Insights</strong><br /><span className="text-xs text-gray-500">Full analysis & strategy suggestions.</span></span>
                        </li>
                        <li className="flex items-start text-gray-300 space-x-3">
                            <Check className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-300"><strong>Full System Access</strong><br /><span className="text-xs text-gray-500">Compliance Vault, Templates, History.</span></span>
                        </li>
                    </ul>
                    <button
                        className={proBtn.className}
                        disabled={proBtn.disabled}
                        onClick={() => !proBtn.disabled && navigate('/settings?tab=billing')}
                    >
                        {proBtn.text}
                        {proBtn.text.includes('Enterprise') && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                </motion.div>
            </div>


        </div>
    )
}
