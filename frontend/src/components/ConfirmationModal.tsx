import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle } from "lucide-react"

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: "danger" | "warning" | "info"
    loading?: boolean
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    loading = false
}: ConfirmationModalProps) {
    if (!isOpen) return null

    const colors = {
        danger: { bg: "bg-red-50", text: "text-red-900", icon: "text-red-600", button: "bg-red-600 hover:bg-red-700" },
        warning: { bg: "bg-orange-50", text: "text-orange-900", icon: "text-orange-600", button: "bg-orange-600 hover:bg-orange-700" },
        info: { bg: "bg-blue-50", text: "text-blue-900", icon: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" }
    }

    const theme = colors[variant]

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full shrink-0 ${theme.bg}`}>
                                <AlertTriangle className={`w-6 h-6 ${theme.icon}`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={loading}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center ${theme.button}`}
                            >
                                {loading ? "Processing..." : confirmText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
