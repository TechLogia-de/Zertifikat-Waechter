import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Certificates from './pages/Certificates'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Connectors from './pages/Connectors'
import AgentLogs from './pages/AgentLogs'
import Integrations from './pages/Integrations'
import ACME from './pages/ACME'
import AuditLog from './pages/AuditLog'
import LoadingBar from './components/ui/LoadingBar'
import LoadingState from './components/ui/LoadingState'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingState size="lg" text="Wird geladen..." fullScreen />
  }

  return (
    <BrowserRouter>
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


