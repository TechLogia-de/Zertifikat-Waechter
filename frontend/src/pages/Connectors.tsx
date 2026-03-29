import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
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
    fetchConnectors()

    // Realtime Updates NUR für eigenen Tenant (wird nach fetchConnectors gesetzt)
    let channel: any = null

    if (user?.id) {
      // Hole Tenant-ID für Filter
      supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const tenantId = (data as any).tenant_id

            // Realtime Updates NUR für eigenen Tenant!
            channel = supabase
              .channel('connectors-changes')
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'connectors',
                  filter: `tenant_id=eq.${tenantId}` // ✅ NUR EIGENER TENANT!
                },
                (payload) => {
                  console.log('Connector changed:', payload)
                  setInitialLoad(false)
                  fetchConnectors()
                }
              )
              .subscribe()
          }
        })
    }

    // Auto-Refresh im Hintergrund (alle 30 Sekunden, OHNE Loading-Spinner!)
    const interval = setInterval(() => {
      setInitialLoad(false)
      fetchConnectors()
    }, 30000)

    return () => {
      if (channel) channel.unsubscribe()
      clearInterval(interval)
    }
  }, [user])

  async function fetchConnectors() {
    try {
      // Nur beim ersten Load Loading-State zeigen
      if (initialLoad) {
        setLoading(true)
      }

      // WICHTIG: Erst Tenant-ID holen!
      if (!user?.id) return

      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        console.error('Kein Tenant gefunden!')
        return
      }

      const tenantId = (membership as any).tenant_id

      // NUR Connectors des eigenen Tenants laden! (Multi-Tenant Security!)
      const { data, error } = await supabase
        .from('connectors')
        .select('*')
        .eq('tenant_id', tenantId) // ✅ TENANT-FILTER!
        .order('created_at', { ascending: false })

      if (error) throw error

      // Nur updaten wenn sich Daten geändert haben (verhindert unnötiges Re-Rendering)
      const newData = data || []
      if (JSON.stringify(newData) !== JSON.stringify(connectors)) {
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

      // Get current tenant (für MVP: erste membership)
      if (!user?.id) {
        throw new Error('Nicht eingeloggt')
      }

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (membershipError || !membership) {
        throw new Error('Kein Tenant gefunden')
      }

      // Call RPC to create connector with token
      const result = await supabase.rpc('create_connector_with_token', {
        p_tenant_id: (membership as any).tenant_id,
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
    setSelectedConnector(connector)
    setShowSetupModal(true)
    setShowFullToken(null)
    setActivityLog([])
    fetchConnectorDetails(connector.id)

    // Realtime Updates für Discovery Results
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
          console.log('New discovery:', payload)
          const newHost = payload.new as any
          setActivityLog(prev => [
            `🌐 Host gefunden: ${newHost.ip_address} (${newHost.open_ports?.length || 0} Ports offen)`,
            ...prev
          ].slice(0, 20))
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

    // Cleanup beim Modal-Schließen
    const cleanup = () => {
      discoveryChannel.unsubscribe()
    }

    return cleanup
  }

  function editConnector(connector: Connector) {
    setSelectedConnector(connector)
    setShowEditModal(true)
  }

  async function triggerScan(connectorId: string) {
    try {
      // Update Config um Agent zu triggern
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

      alert('✅ Scan-Request gesendet! Der Agent scannt in den nächsten 30 Sekunden.')

      // Refresh Connectors nach 2 Sekunden
      setTimeout(() => fetchConnectors(), 2000)
    } catch (error: any) {
      console.error('Error triggering scan:', error)
      alert(`Fehler: ${error.message}`)
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
            onClose={() => setShowSetupModal(false)}
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
