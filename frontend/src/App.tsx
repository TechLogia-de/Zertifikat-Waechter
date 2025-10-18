import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
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
import LoadingBar from './components/ui/LoadingBar'
import LoadingState from './components/ui/LoadingState'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingState size="lg" text="Wird geladen..." fullScreen />
  }

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <LoadingBar />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route
          path="/"
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


