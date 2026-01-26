import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FeedbackService } from '@/services/api'

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
    tenderId: string
    onSuccess?: () => void
}

export default function FeedbackModal({ isOpen, onClose, tenderId, onSuccess }: FeedbackModalProps) {
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (rating === 0) return
        setSubmitting(true)
        await FeedbackService.submit(tenderId, rating, message)
        setSubmitting(false)
        if (onSuccess) onSuccess()
        onClose()
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white text-center relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="inline-flex p-3 bg-white/20 rounded-full mb-3 backdrop-blur-md">
                            <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
                        </div>
                        <h2 className="text-2xl font-bold">Excellent Work!</h2>
                        <p className="text-blue-100 mt-1">Your tender is 100% compliant.</p>
                    </div>

                    {/* Body */}
                    <div className="p-8">
                        <p className="text-center text-gray-600 mb-6 font-medium">
                            How would you rate your experience with Antigravity?
                        </p>

                        {/* Star Rating */}
                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-colors ${(hoverRating || rating) >= star
                                                ? 'text-yellow-400 fill-yellow-400'
                                                : 'text-gray-200'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>

                        {/* Optional Message */}
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Additional Feedback (Optional)
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tell us what you liked or how we can improve..."
                                className="w-full h-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={rating === 0 || submitting}
                            className={`
                                w-full py-3 rounded-lg font-bold text-white transition-all
                                ${rating > 0
                                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/25'
                                    : 'bg-gray-300 cursor-not-allowed'}
                            `}
                        >
                            {submitting ? 'Sending...' : 'Submit Rating'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
