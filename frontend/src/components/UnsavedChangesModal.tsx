import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle } from "lucide-react"

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function UnsavedChangesModal({ isOpen, onConfirm, onCancel }: UnsavedChangesModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-100"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4 mx-auto">
                                <AlertTriangle className="h-6 w-6 text-orange-600" />
                            </div>
                            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Unsaved Changes</h3>
                            <p className="text-center text-gray-500 mb-6 text-sm">
                                You have unsaved changes. Are you sure you want to leave this page?
                            </p>
                            
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={onCancel}
                                    className="w-full px-4 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Stay on page
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Leave without saving
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
