import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { lazy, Suspense, useEffect, useState } from 'react'
import { LanguageProvider } from './contexts/LanguageContext'
import Layout from './components/layout/Layout'
import LoadingBar from './components/ui/LoadingBar'
import LoadingState from './components/ui/LoadingState'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Lazy-loaded page components for route-level code splitting
const Login = lazy(() => import('./pages/Login'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Documentation = lazy(() => import('./pages/Documentation'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Certificates = lazy(() => import('./pages/Certificates'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const Connectors = lazy(() => import('./pages/Connectors'))
const AgentLogs = lazy(() => import('./pages/AgentLogs'))
const Integrations = lazy(() => import('./pages/Integrations'))
const ACME = lazy(() => import('./pages/ACME'))
const Reports = lazy(() => import('./pages/Reports'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const SSLHealth = lazy(() => import('./pages/SSLHealth'))
const Compliance = lazy(() => import('./pages/Compliance'))
const APIKeys = lazy(() => import('./pages/APIKeys'))
const WebhookLogs = lazy(() => import('./pages/WebhookLogs'))
const DevSecurity = lazy(() => import('./pages/DevSecurity'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Inline loading fallback for Suspense boundaries
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-3 border-[#E2E8F0] border-t-[#3B82F6] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-[#64748B] font-medium animate-pulse">Wird geladen...</p>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [isOAuthCallback, setIsOAuthCallback] = useState(false)

  useEffect(() => {
    // Check if we're returning from OAuth (has code or access_token in URL)
    const params = new URLSearchParams(location.search)
    const hasOAuthCode = params.has('code') || params.has('access_token') || params.has('refresh_token')
    
    if (hasOAuthCode && !user) {
      setIsOAuthCallback(true)

      // Clear flag after 10 seconds to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsOAuthCallback(false)
      }, 10000)
      
      return () => clearTimeout(timeoutId)
    } else if (user) {
      setIsOAuthCallback(false)
    }
  }, [location.search, user])

  // Show loading if:
  // 1. Auth is still loading, OR
  // 2. We detected an OAuth callback and are waiting for user
  if (loading || isOAuthCallback) {
    return <LoadingState size="lg" text={isOAuthCallback ? "Anmeldung wird abgeschlossen..." : "Wird geladen..."} fullScreen />
  }

  return (
    <>
      <LoadingBar />
      <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Landing Page - accessible for everyone */}
        <Route path="/" element={<LandingPage />} />

        {/* Documentation - accessible for everyone */}
        <Route path="/docs" element={<Documentation />} />

        {/* Login Page */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

        {/* Reset Password Page (accessible without auth) */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Dashboard - main app route when logged in */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/certificates"
          element={
            user ? (
              <Layout>
                <Certificates />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/alerts"
          element={
            user ? (
              <Layout>
                <Alerts />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/connectors"
          element={
            user ? (
              <Layout>
                <Connectors />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/agent-logs"
          element={
            user ? (
              <Layout>
                <AgentLogs />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            user ? (
              <Layout>
                <Settings />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/profile"
          element={
            user ? (
              <Layout>
                <Profile />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/integrations"
          element={
            user ? (
              <Layout>
                <Integrations />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/webhook-logs"
          element={
            user ? (
              <Layout>
                <WebhookLogs />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/acme"
          element={
            user ? (
              <Layout>
                <ACME />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/reports"
          element={
            user ? (
              <Layout>
                <Reports />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/audit-log"
          element={
            user ? (
              <Layout>
                <AuditLog />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/ssl-health"
          element={
            user ? (
              <Layout>
                <SSLHealth />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/compliance"
          element={
            user ? (
              <Layout>
                <Compliance />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/api-keys"
          element={
            user ? (
              <Layout>
                <APIKeys />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dev/security"
          element={
            user ? (
              <Layout>
                <DevSecurity />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        {/* Catch-all route */}
        <Route path="*" element={user ? <Layout><NotFound /></Layout> : <Navigate to="/" />} />
      </Routes>
      </Suspense>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AppContent />
        </BrowserRouter>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default App


