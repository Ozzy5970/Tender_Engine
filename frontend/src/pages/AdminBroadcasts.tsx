import { useState, useEffect } from 'react'
import { AdminService } from "@/services/api"
import { AlertTriangle, MessageSquare, Trash2, Loader2, Send } from 'lucide-react'

export default function AdminBroadcasts() {
    const [broadcasts, setBroadcasts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'active' | 'create'>('active')

    // Form State
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [priority, setPriority] = useState('INFO')
    const [sending, setSending] = useState(false)

    useEffect(() => {
        loadBroadcasts()
    }, [])

    const loadBroadcasts = async () => {
        try {
            setLoading(true)
            const { data } = await AdminService.getBroadcasts()
            setBroadcasts((data as any[]) || [])
        } catch (error) {
            console.error("Failed to load broadcasts", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !message) return

        setSending(true)
        try {
            await AdminService.broadcast(title, message, priority as 'INFO' | 'WARNING' | 'CRITICAL')
            setTitle('')
            setMessage('')
            setPriority('INFO')
            setActiveTab('active')
            await loadBroadcasts()
        } catch (error) {
            console.error("Failed to create broadcast", error)
        } finally {
            setSending(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this broadcast?')) return
        try {
            await AdminService.deleteBroadcast(id)
            setBroadcasts(prev => prev.filter(b => b.id !== id))
        } catch (error) {
            console.error("Failed to delete broadcast", error)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Broadcast Manager</h1>
                <p className="text-gray-500 mt-2">Manage system-wide alerts and announcements for all users.</p>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 bg-gray-50 flex">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-6 py-4 text-sm font-medium ${activeTab === 'active' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Active Broadcasts
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-6 py-4 text-sm font-medium ${activeTab === 'create' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Create New
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'active' && (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="text-center py-12 text-gray-400">Loading broadcasts...</div>
                            ) : broadcasts.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No active broadcasts</p>
                                    <p className="text-sm text-gray-400">Create one to notify users.</p>
                                </div>
                            ) : (
                                broadcasts.map(b => (
                                    <div key={b.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                                        <div className={`mt-1 p-2 rounded-lg ${b.priority === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                                            b.priority === 'WARNING' ? 'bg-orange-100 text-orange-600' :
                                                'bg-blue-100 text-blue-600'
                                            }`}>
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-gray-900">{b.title}</h3>
                                                <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-gray-600 mt-1 text-sm">{b.message}</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${b.priority === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-100' :
                                                    b.priority === 'WARNING' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    {b.priority}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(b.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Broadcast"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <form onSubmit={handleCreate} className="max-w-2xl mx-auto py-4">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="e.g. Scheduled Maintenance"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                                        placeholder="What do you want to tell your users?"
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {['INFO', 'WARNING', 'CRITICAL'].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPriority(p)}
                                                className={`py-3 px-4 rounded-lg border text-sm font-bold transition-all ${priority === p
                                                    ? 'ring-2 ring-indigo-600 border-transparent bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        {sending ? 'Sending...' : 'Publish Broadcast'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
