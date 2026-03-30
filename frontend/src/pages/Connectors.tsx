import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import PageInfoBox from '../components/ui/PageInfoBox'
import {
  ConnectorCard,
  CreateConnectorModal,
  TokenModal,
  EditConnectorModal,
  ConnectorDetailsModal,
  QuickStartGuide,
} from '../components/features/connectors'
import type { Connector, ConnectorWithToken } from '../components/features/connectors'

export default function Connectors() {
  const { user } = useAuth()
  const { tenantId: cachedTenantId } = useTenantId()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [newConnector, setNewConnector] = useState<ConnectorWithToken | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showFullToken, setShowFullToken] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [selectedTab, setSelectedTab] = useState<'docker' | 'compose' | 'windows'>('docker')
  const [initialLoad, setInitialLoad] = useState(true)
  // Track which connector is currently scanning + cooldown
  const [scanningId, setScanningId] = useState<string | null>(null)
  const scanCooldownRef = useRef<Record<string, number>>({})
  const setupCleanupRef = useRef<(() => void) | null>(null)
  const connectorsRef = useRef<Connector[]>([])

  // Assets und Certificates für ausgewählten Connector
  const [connectorAssets, setConnectorAssets] = useState<any[]>([])
  const [connectorCertificates, setConnectorCertificates] = useState<any[]>([])
  const [discoveryResults, setDiscoveryResults] = useState<any[]>([])
  const [activityLog, setActivityLog] = useState<string[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    scanMode: 'auto', // 'auto' oder 'manual'
    scanTargets: '',
    scanPorts: '443,8443,636'
  })

  // Load Connectors
  useEffect(() => {
    if (!cachedTenantId) return

    fetchConnectors()

    // Realtime Updates for own tenant only
    const channel = supabase
      .channel('connectors-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connectors',
          filter: `tenant_id=eq.${cachedTenantId}`
        },
        () => {
          setInitialLoad(false)
          fetchConnectors()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [cachedTenantId])

  async function fetchConnectors() {
    try {
      // Only show loading state on first load
      if (initialLoad) {
        setLoading(true)
      }

      if (!cachedTenantId) return

      // Only load connectors for own tenant (multi-tenant security)
      const { data, error } = await supabase
        .from('connectors')
        .select('*')
        .eq('tenant_id', cachedTenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Only update if data actually changed (prevents unnecessary re-renders)
      const newData = data || []
      if (JSON.stringify(newData) !== JSON.stringify(connectorsRef.current)) {
        connectorsRef.current = newData
        setConnectors(newData)
      }
    } catch (error) {
      console.error('Error fetching connectors:', error)
    } finally {
      if (initialLoad) {
        setLoading(false)
        setInitialLoad(false)
      }
    }
  }

  async function fetchConnectorDetails(connectorId: string) {
    setLoadingDetails(true)
    try {
      // Discovery Results holen
      const { data: discovery, error: discoveryError } = await supabase
        .from('discovery_results')
        .select('*')
        .eq('connector_id', connectorId)
        .order('discovered_at', { ascending: false })
        .limit(50)

      if (!discoveryError) {
        setDiscoveryResults(discovery || [])
      }

      // Assets holen
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .eq('connector_id', connectorId)
        .order('created_at', { ascending: false })

      if (!assetsError) {
        setConnectorAssets(assets || [])
      }

      // Certificates für diese Assets holen
      const assetIds = assets?.map((a: any) => a.id) || []
      if (assetIds.length > 0) {
        const { data: certs, error: certsError } = await supabase
          .from('certificates')
          .select('*')
          .in('asset_id', assetIds)
          .order('not_after', { ascending: true })
          .limit(20)

        if (!certsError) {
          setConnectorCertificates(certs || [])
        }
      }
    } catch (error) {
      console.error('Error fetching connector details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  async function updateConnectorSettings(connectorId: string, newSettings: any) {
    try {
      const { error } = await (supabase
        .from('connectors') as any)
        .update({
          config: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectorId)

      if (error) throw error

      alert('✅ Einstellungen gespeichert! Agent wird beim nächsten Heartbeat aktualisiert.')
      setTimeout(() => fetchConnectors(), 1000)
      setShowEditModal(false)
    } catch (error: any) {
      console.error('Error updating connector:', error)
      alert(`Fehler: ${error.message}`)
    }
  }

  async function createConnector() {
    if (!formData.name.trim()) {
      alert('Bitte Agent-Name eingeben!')
      return
    }

    if (formData.scanMode === 'manual' && !formData.scanTargets.trim()) {
      alert('Bitte Scan-Targets eingeben oder Auto-Discovery wählen!')
      return
    }

    setCreating(true)
    try {
      // Parse scan targets and ports
      const scanTargets = formData.scanMode === 'auto'
        ? ['localhost'] // Trigger für Auto-Discovery im Agent
        : formData.scanTargets.split(',').map(t => t.trim()).filter(t => t)

      const scanPorts = formData.scanPorts
        .split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p))

      if (!cachedTenantId) {
        throw new Error('Kein Tenant gefunden')
      }

      // Call RPC to create connector with token
      const result = await supabase.rpc('create_connector_with_token', {
        p_tenant_id: cachedTenantId,
        p_name: formData.name,
        p_scan_targets: scanTargets,
        p_scan_ports: scanPorts
      } as any)

      if (result.error) throw result.error

      const data = result.data as ConnectorWithToken[]
      if (!data || data.length === 0) {
        throw new Error('Connector konnte nicht erstellt werden')
      }

      const connector = data[0]

      // Token-Modal anzeigen
      setNewConnector(connector)
      setShowCreateModal(false)
      setShowTokenModal(true)

      // Liste aktualisieren (Token bleibt jetzt in DB!)
      fetchConnectors()

      // Form zurücksetzen
      setFormData({
        name: '',
        scanMode: 'auto',
        scanTargets: '',
        scanPorts: '443,8443,636'
      })
    } catch (error: any) {
      console.error('Error creating connector:', error)
      alert(`Fehler: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  async function deleteConnector(connectorId: string) {
    if (!confirm('Agent wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) {
      return
    }

    setDeleting(connectorId)
    try {
      const { error } = await supabase
        .from('connectors')
        .delete()
        .eq('id', connectorId)

      if (error) throw error

      // Liste aktualisieren
      setConnectors(connectors.filter(c => c.id !== connectorId))
      alert('Agent erfolgreich gelöscht!')
    } catch (error: any) {
      console.error('Error deleting connector:', error)
      alert(`Fehler beim Löschen: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  async function regenerateToken(connectorId: string) {
    if (!confirm('Token wirklich neu generieren? Der alte Token wird ungültig und du musst den Agent neu deployen!')) {
      return
    }

    try {
      if (!user?.id) {
        throw new Error('Nicht eingeloggt')
      }

      const result = await supabase.rpc('regenerate_connector_token', {
        p_connector_id: connectorId,
        p_user_id: user.id
      } as any)

      if (result.error) throw result.error

      const data = result.data as { new_token: string }[]
      if (!data || data.length === 0) {
        throw new Error('Kein Token erhalten')
      }

      const newToken = data[0].new_token

      // Update local state
      const updatedConnectors = connectors.map(c =>
        c.id === connectorId
          ? { ...c, auth_token: newToken, status: 'inactive' as const }
          : c
      )
      setConnectors(updatedConnectors)

      // Zeige Token-Modal mit neuem Token
      const connector = updatedConnectors.find(c => c.id === connectorId)
      if (connector) {
        setNewConnector({ ...connector, auth_token: newToken } as ConnectorWithToken)
        setShowTokenModal(true)
      }

      alert('✅ Neuer Token generiert! Kopiere den Docker-Befehl und deploye den Agent neu.')
    } catch (error: any) {
      console.error('Error regenerating token:', error)
      alert(`Fehler: ${error.message}`)
    }
  }

  function showSetup(connector: Connector) {
    // Clean up any previous subscription before opening a new one
    if (setupCleanupRef.current) {
      setupCleanupRef.current()
      setupCleanupRef.current = null
    }

    setSelectedConnector(connector)
    setShowSetupModal(true)
    setShowFullToken(null)
    setActivityLog([])
    fetchConnectorDetails(connector.id)

    // Realtime updates for discovery results
    const discoveryChannel = supabase
      .channel(`discovery-${connector.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discovery_results',
          filter: `connector_id=eq.${connector.id}`,
        },
        (payload) => {
          const newHost = payload.new as any
          const deviceIcon: Record<string, string> = { router: '🌐', firewall: '🛡️', server: '🖥️', nas: '💾', printer: '🖨️', hypervisor: '☁️', switch: '🔀', 'access-point': '📡', camera: '📷' }
          const icon = deviceIcon[newHost.device_type] || '🔵'
          const hostLabel = newHost.hostname || newHost.ip_address
          const deviceLabel = newHost.device_type ? ` [${newHost.device_type}]` : ''
          const gatewayLabel = newHost.is_gateway ? ' ⭐Gateway' : ''
          setActivityLog(prev => [
            `${icon} Host: ${hostLabel}${deviceLabel}${gatewayLabel} - ${newHost.open_ports?.length || 0} Ports`,
            ...prev
          ].slice(0, 30))
          fetchConnectorDetails(connector.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'certificates',
          filter: `tenant_id=eq.${connector.tenant_id}`,
        },
        (payload) => {
          const newCert = payload.new as any
          setActivityLog(prev => [
            `🔐 Zertifikat gefunden: ${newCert.subject_cn} (läuft ab in ${Math.floor((new Date(newCert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Tagen)`,
            ...prev
          ].slice(0, 20))
          fetchConnectorDetails(connector.id)
        }
      )
      .subscribe()

    setupCleanupRef.current = () => {
      discoveryChannel.unsubscribe()
    }
  }

  function editConnector(connector: Connector) {
    setSelectedConnector(connector)
    setShowEditModal(true)
  }

  async function triggerScan(connectorId: string) {
    // Prevent concurrent scans and enforce 5-second cooldown
    if (scanningId === connectorId) return
    const lastScanTime = scanCooldownRef.current[connectorId] || 0
    if (Date.now() - lastScanTime < 5000) return

    setScanningId(connectorId)
    try {
      // Update Config to trigger the agent
      const connector = connectors.find(c => c.id === connectorId)
      if (!connector) return

      const updateData = {
        config: {
          ...connector.config,
          trigger_scan: Date.now()
        }
      }

      const { error } = await (supabase.from('connectors') as any).update(updateData).eq('id', connectorId)

      if (error) throw error

      scanCooldownRef.current[connectorId] = Date.now()
      alert('✅ Scan-Request gesendet! Der Agent scannt in den nächsten 30 Sekunden.')

      // Refresh Connectors after 2 seconds
      setTimeout(() => fetchConnectors(), 2000)
    } catch (error: any) {
      console.error('Error triggering scan:', error)
      alert(`Fehler: ${error.message}`)
    } finally {
      // Keep the button disabled for the full 5-second cooldown
      setTimeout(() => {
        setScanningId((prev) => (prev === connectorId ? null : prev))
      }, 5000)
    }
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // KEIN sichtbarer Loading-State mehr! (nur beim allerersten Laden)
  // Die Seite zeigt immer Daten - auch während Refresh im Hintergrund

  // Zeige nur beim ALLERERSTEN Laden einen Spinner
  if (loading && connectors.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B82F6] mx-auto mb-4"></div>
            <p className="text-[#64748B]">Lade Agents...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
              <span className="text-xl sm:text-2xl">🤖</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Connectors</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
            Scan-Agents • Auto-Discovery • Network-Mapping • Live-Updates
          </p>
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInitialLoad(false)
                fetchConnectors()
              }}
              className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg font-medium text-sm hover:bg-slate-700 hover:border-slate-500 transition-all duration-200"
              aria-label="Aktualisieren"
            >
              🔄
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 whitespace-nowrap"
            >
              <span>➕ Neuen Agent erstellen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <PageInfoBox title="Was sind Connectors und wie funktionieren sie?" variant="info" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-[#1E3A5F]">
                Connectors sind leichtgewichtige Scan-Agents, die in Ihrem Intranet oder Netzwerk laufen. Sie erkennen automatisch Hosts, offene Ports und TLS/SSL-Zertifikate und melden die Ergebnisse in Echtzeit an Ihr Dashboard.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Funktionsweise</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Jeder Agent authentifiziert sich mit einem eindeutigen Token (Bearer-Token)</li>
                    <li>Heartbeat-Signal alle 30 Sekunden zeigt den Online-Status</li>
                    <li>Auto-Discovery scannt Netzwerke nach aktiven Hosts und Services</li>
                    <li>TLS-Zertifikate werden automatisch extrahiert und analysiert</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Deployment-Optionen</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Docker-Container (empfohlen): Einfachste Installation</li>
                    <li>Docker Compose: Fuer Multi-Agent-Setups</li>
                    <li>Windows-Service: Nativer Betrieb auf Windows-Servern</li>
                    <li>Scan-Targets und Ports koennen pro Agent konfiguriert werden</li>
                  </ul>
                </div>
              </div>
            </div>
          </PageInfoBox>
        </div>

        {/* Connector Liste */}
        {connectors.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <div className="w-20 h-20 bg-[#F1F5F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-2">
              Noch keine Agents konfiguriert
            </h3>
            <p className="text-[#64748B] mb-4">
              Agents sind leichtgewichtige Scanner, die in deinem Netzwerk laufen und
              automatisch Hosts, Services und TLS-Zertifikate entdecken.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left max-w-2xl mx-auto">
              <p className="text-sm text-[#64748B] mb-2">
                <strong className="text-[#0F172A]">Was macht ein Agent?</strong>
              </p>
              <ul className="text-sm text-[#64748B] space-y-1 list-disc list-inside">
                <li>Scannt Netzwerk nach aktiven Hosts (Nmap-ähnlich)</li>
                <li>Identifiziert offene Ports und Services</li>
                <li>Extrahiert TLS/SSL-Zertifikate automatisch</li>
                <li>Sendet Daten in Echtzeit ans Dashboard</li>
              </ul>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
            >
              ➕ Ersten Agent erstellen
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {connectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                deleting={deleting}
                scanningId={scanningId}
                onShowSetup={showSetup}
                onTriggerScan={triggerScan}
                onEditConnector={editConnector}
                onDeleteConnector={deleteConnector}
              />
            ))}
          </div>
        )}

        {/* Create Connector Modal */}
        {showCreateModal && (
          <CreateConnectorModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            formData={formData}
            onFormDataChange={setFormData}
            onCreateConnector={createConnector}
            creating={creating}
          />
        )}

        {/* Token Modal (zeigt Docker-Befehl) */}
        {showTokenModal && newConnector && (
          <TokenModal
            isOpen={showTokenModal}
            onClose={() => setShowTokenModal(false)}
            connector={newConnector}
            copiedIndex={copiedIndex}
            onCopyToClipboard={copyToClipboard}
            selectedTab={selectedTab}
            onSelectedTabChange={setSelectedTab}
          />
        )}

        {/* Edit Settings Modal */}
        {showEditModal && selectedConnector && (
          <EditConnectorModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            connector={selectedConnector}
            onSave={updateConnectorSettings}
          />
        )}

        {/* Setup Modal (für bestehende Connectors) */}
        {showSetupModal && selectedConnector && (
          <ConnectorDetailsModal
            isOpen={showSetupModal}
            onClose={() => {
              setShowSetupModal(false)
              if (setupCleanupRef.current) {
                setupCleanupRef.current()
                setupCleanupRef.current = null
              }
            }}
            connector={selectedConnector}
            activityLog={activityLog}
            discoveryResults={discoveryResults}
            connectorAssets={connectorAssets}
            connectorCertificates={connectorCertificates}
            loadingDetails={loadingDetails}
            showFullToken={showFullToken}
            onToggleFullToken={() => setShowFullToken(showFullToken === selectedConnector.id ? null : selectedConnector.id)}
            copiedIndex={copiedIndex}
            onCopyToClipboard={copyToClipboard}
            onRegenerateToken={regenerateToken}
          />
        )}

        {/* Quick Start Guide */}
        <QuickStartGuide />
        </div>
      </main>
    </div>
  )
}
