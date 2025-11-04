import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useEffect, useState } from 'react'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import Documentation from './pages/Documentation'
import Dashboard from './pages/Dashboard'
import Certificates from './pages/Certificates'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Connectors from './pages/Connectors'
import AgentLogs from './pages/AgentLogs'
import Integrations from './pages/Integrations'
import ACME from './pages/ACME'
import Reports from './pages/Reports'
import AuditLog from './pages/AuditLog'
import SSLHealth from './pages/SSLHealth'
import Compliance from './pages/Compliance'
import APIKeys from './pages/APIKeys'
import WebhookLogs from './pages/WebhookLogs'
import DevSecurity from './pages/DevSecurity'
import LoadingBar from './components/ui/LoadingBar'
import LoadingState from './components/ui/LoadingState'

function AppContent() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [isOAuthCallback, setIsOAuthCallback] = useState(false)

  useEffect(() => {
    // Check if we're returning from OAuth (has code or access_token in URL)
    const params = new URLSearchParams(location.search)
    const hasOAuthCode = params.has('code') || params.has('access_token') || params.has('refresh_token')
    
    if (hasOAuthCode && !user) {
      console.log('🔐 Detected OAuth callback - waiting for auth...')
      setIsOAuthCallback(true)
      
      // Clear flag after 10 seconds to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsOAuthCallback(false)
        console.log('⏱️ OAuth callback timeout - clearing flag')
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
      <Routes>
        {/* Landing Page - shown when not logged in */}
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />

        {/* Documentation - accessible for everyone */}
        <Route path="/docs" element={<Documentation />} />

        {/* Login Page */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

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
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AppContent />
    </BrowserRouter>
  )
}

export default App


