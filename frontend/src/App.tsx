import React, { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, CheckCircle, FileText, AlertTriangle } from "lucide-react"
import { TenderService, CompanyService } from "@/services/api"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import Layout from "@/components/Layout"
import AuthPage from "@/pages/Auth"
import LegalModal from "@/components/LegalModal"
import TenderIngest from "@/pages/TenderIngest"
import Tenders from "@/pages/Tenders"
import TenderDetails from "@/pages/TenderDetails"
import Compliance from "@/pages/Compliance"

import Profile from "@/pages/Profile"
import Alerts from "@/pages/Alerts"
import Templates from "@/pages/Templates"
import Settings from "@/pages/Settings"
import AdminDashboard from "@/pages/AdminDashboard"
import AdminTemplates from "@/pages/AdminTemplates"
import AdminTemplateHistory from "@/pages/AdminTemplateHistory"
import AdminRevenue from "@/pages/AdminRevenue"
import AdminRevenueHistory from "@/pages/AdminRevenueHistory"
import AdminSubscriptions from "@/pages/AdminSubscriptions"
import AdminUsers from "@/pages/AdminUsers"
import AdminFeedback from "@/pages/AdminFeedback"
import AdminErrors from "@/pages/AdminErrors"
import Pricing from "@/pages/Pricing"
import Terms from "@/pages/Terms"
import Privacy from "@/pages/Privacy"

// Simple Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>
  if (!session) return <Navigate to="/auth" replace />

  return <>{children}</>
}

function Dashboard() {
  const navigate = useNavigate()
  const [activeTendersCount, setActiveTendersCount] = useState<number | null>(null)
  const [avgReadiness, setAvgReadiness] = useState<number | null>(null)
  const [complianceScore, setComplianceScore] = useState<number | null>(null)
  const [expiringDocs, setExpiringDocs] = useState<number>(0)
  const [recentTenders, setRecentTenders] = useState<any[]>([])

  useEffect(() => {
    async function loadStats() {
      // 1. Active Tenders
      const { count } = await TenderService.getStats()
      setActiveTendersCount(count)

      // 2. Readiness Stats
      const { avg } = await TenderService.getReadinessStats()
      setAvgReadiness(avg)

      // 3. Compliance Stats
      const { score, expiring } = await CompanyService.getComplianceStats()
      setComplianceScore(score)
      setExpiringDocs(expiring)

      // 4. Recent Activity
      const { data } = await TenderService.getRecent()
      if (data) setRecentTenders(data)
    }
    loadStats()
  }, [])

  const CHART_DATA = [
    { name: 'Average', score: avgReadiness || 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Last updated: Just now</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Readiness Score</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{avgReadiness !== null ? avgReadiness + '%' : '-'}</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
            <span>Based on active tenders</span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => navigate('/tenders')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Tenders</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{activeTendersCount !== null ? activeTendersCount : '-'}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500">
            <span>Click to view all</span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-orange-300 transition-colors" onClick={() => navigate('/compliance')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Compliance Health</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{complianceScore !== null ? complianceScore + '%' : '-'}</h3>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <div className={`mt-4 flex items-center text-xs ${expiringDocs > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
            {expiringDocs > 0 && <AlertTriangle className="h-3 w-3 mr-1" />}
            <span>{expiringDocs} document{expiringDocs !== 1 ? 's' : ''} expiring soon</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Readiness Overview</h3>
          <div className="h-[300px]">
            {/* If we have no data, show empty state */}
            {activeTendersCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>No active tenders to analyze</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentTenders.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity found.</p>
            ) : (
              recentTenders.map((tender) => (
                <div key={tender.id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors" onClick={() => navigate(`/tenders/${tender.id}`)}>
                  <div className={`w-2 h-2 mt-2 rounded-full ${tender.status === 'COMPLIANT' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tender.title}</p>
                    <p className="text-xs text-gray-500 mt-1">Readiness Score: {tender.readiness_score || 0}%</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(tender.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      // Log to our new service
      // We use 'import' inside callback or assume global? Better to use the imported service.
      // Needs import { ErrorService } from "@/services/api" at top
      console.error("Global Error Caught:", event.error)
      // Just fire and forget to DB
      import("@/services/api").then(({ ErrorService }) => {
        ErrorService.logError(event.error || "Unknown Error", window.location.pathname, 'critical')
      })
    }

    // Also catch unhandled promises
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Rejection:", event.reason)
      import("@/services/api").then(({ ErrorService }) => {
        ErrorService.logError(event.reason || "Unhandled Promise Rejection", window.location.pathname, 'critical')
      })
    }

    window.addEventListener('error', handleGlobalError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleGlobalError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
              <LegalModal />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />

            <Route path="tenders" element={<Tenders />} />
            <Route path="tenders/new" element={<TenderIngest />} />
            <Route path="tenders/:id" element={<TenderDetails />} />
            <Route path="compliance" element={<Compliance />} />
            <Route path="profile" element={<Profile />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="templates" element={<Templates />} />
            <Route path="settings" element={<Settings />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />

            {/* Admin Routes - Should be protected by Role Check Component in production */}
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/revenue" element={<AdminRevenue />} />
            <Route path="admin/revenue/history" element={<AdminRevenueHistory />} />
            <Route path="admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/feedback" element={<AdminFeedback />} />
            <Route path="admin/errors" element={<AdminErrors />} />
            <Route path="admin/templates" element={<AdminTemplates />} />
            <Route path="admin/templates/history" element={<AdminTemplateHistory />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
