import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'

interface Connector {
  id: string
  tenant_id: string
  name: string
  type: string
  status: 'active' | 'inactive' | 'error'
  last_seen: string | null
  auth_token: string | null
  config?: {
    scan_targets?: string[]
    scan_ports?: number[]
    scanning?: boolean
    scan_progress?: {
      current: number
      total: number
      status: string
    }
    last_scan?: {
      total: number
      success: number
      failed: number
      timestamp: string
    }
  } | null
  created_at: string
}

interface ConnectorWithToken extends Connector {
  auth_token: string
}

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

  function getDockerCommand(connector: ConnectorWithToken): string {
    const targets = connector.config?.scan_targets?.join(',') || 'localhost'
    const ports = connector.config?.scan_ports?.join(',') || '443'
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ethwkzwsxkhcexibuvwp.supabase.co'
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'
    
    return `docker run -d \\
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \\
  --network host \\
  -e SUPABASE_URL=${supabaseUrl} \\
  -e SUPABASE_ANON_KEY=${anonKey} \\
  -e CONNECTOR_TOKEN=${connector.auth_token} \\
  -e CONNECTOR_NAME="${connector.name}" \\
  -e SCAN_TARGETS=${targets} \\
  -e SCAN_PORTS=${ports} \\
  -e SCAN_INTERVAL=3600 \\
  certwatcher/agent:latest`
  }

  function getDockerComposeContent(connector: ConnectorWithToken): string {
    const targets = connector.config?.scan_targets?.join(',') || 'localhost'
    const ports = connector.config?.scan_ports?.join(',') || '443'
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ethwkzwsxkhcexibuvwp.supabase.co'
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'
    
    return `version: '3.8'

services:
  agent:
    image: certwatcher/agent:latest
    container_name: certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')}
    environment:
      SUPABASE_URL: ${supabaseUrl}
      SUPABASE_ANON_KEY: ${anonKey}
      CONNECTOR_TOKEN: ${connector.auth_token}
      CONNECTOR_NAME: "${connector.name}"
      SCAN_TARGETS: ${targets}
      SCAN_PORTS: ${ports}
      SCAN_INTERVAL: 3600
      LOG_LEVEL: INFO
    ports:
      - "8080:8080"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3`
  }

  function getWindowsCommand(connector: ConnectorWithToken): string {
    const targets = connector.config?.scan_targets?.join(',') || 'localhost'
    const ports = connector.config?.scan_ports?.join(',') || '443'
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ethwkzwsxkhcexibuvwp.supabase.co'
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'
    
    return `# Windows PowerShell
docker run -d \`
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \`
  --network host \`
  -e SUPABASE_URL=${supabaseUrl} \`
  -e SUPABASE_ANON_KEY=${anonKey} \`
  -e CONNECTOR_TOKEN=${connector.auth_token} \`
  -e CONNECTOR_NAME="${connector.name}" \`
  -e SCAN_TARGETS=${targets} \`
  -e SCAN_PORTS=${ports} \`
  certwatcher/agent:latest`
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

  function maskToken(token: string | null): string {
    if (!token) return '••••••••••••••••'
    if (token.length < 20) return token
    const start = token.substring(0, 12)
    const end = token.substring(token.length - 8)
    return `${start}...${end}`
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

  function getSetupCommand(connector: Connector, showToken: boolean = false): string {
    const targets = connector.config?.scan_targets?.join(',') || 'localhost'
    const ports = connector.config?.scan_ports?.join(',') || '443'
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ethwkzwsxkhcexibuvwp.supabase.co'
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'
    const token = showToken ? (connector.auth_token || '<TOKEN_NICHT_VERFÜGBAR>') : maskToken(connector.auth_token)
    
    return `docker run -d \\
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \\
  --network host \\
  -e SUPABASE_URL=${supabaseUrl} \\
  -e SUPABASE_ANON_KEY=${anonKey} \\
  -e CONNECTOR_TOKEN=${token} \\
  -e CONNECTOR_NAME="${connector.name}" \\
  -e SCAN_TARGETS=${targets} \\
  -e SCAN_PORTS=${ports} \\
  -e SCAN_INTERVAL=3600 \\
  certwatcher/agent:latest`
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge variant="success">Aktiv</Badge>
      case 'inactive':
        return <Badge variant="neutral">Inaktiv</Badge>
      case 'error':
        return <Badge variant="error">Fehler</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  function formatLastSeen(lastSeen: string | null) {
    if (!lastSeen) return 'Noch nie'
    const date = new Date(lastSeen)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    
    if (diffSec < 30) return 'Gerade eben'
    if (diffSec < 60) return `vor ${diffSec} Sek`
    if (diffMin < 60) return `vor ${diffMin} Min`
    if (diffHour < 24) return `vor ${diffHour} Std`
    if (diffDay < 7) return `vor ${diffDay} Tag${diffDay !== 1 ? 'en' : ''}`
    
    // Älter als 7 Tage → zeige Datum (lokale Zeit, deutsche Formatierung)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
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
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">Connectors</h1>
          <p className="text-sm md:text-base text-[#64748B] mt-1">
            Verwalte deine Scan-Agents • Updates alle 30s automatisch
          </p>
        </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => {
                setInitialLoad(false)
                fetchConnectors()
              }}
              className="px-3 md:px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F1F5F9] transition-colors flex items-center gap-2"
            >
              🔄
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span className="hidden md:inline">➕ Neuen Agent erstellen</span>
              <span className="md:hidden">➕ Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
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
              <div
                key={connector.id}
                className="bg-white rounded-xl border border-[#E2E8F0] p-4 md:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 md:gap-4 flex-1">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-xl md:text-2xl">🤖</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-base md:text-lg font-bold text-[#0F172A] truncate">
                          {connector.name}
                        </h3>
                        {getStatusBadge(connector.status)}
                      </div>
                      <div className="text-sm text-[#64748B] space-y-2">
                        {/* Status Info mit Activity Indicator */}
                        <div className="flex items-center gap-2">
                          {connector.status === 'active' ? (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-green-700 font-medium">Verbunden</span>
                              <span className="text-[#94A3B8]">•</span>
                              <span>{formatLastSeen(connector.last_seen)}</span>
                              {connector.config?.scanning && (
                                <>
                                  <span className="text-[#94A3B8]">•</span>
                                  <span className="text-blue-600 font-medium animate-pulse">🔍 Scannt...</span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span className="text-gray-600 font-medium">Offline</span>
                              <span className="text-[#94A3B8]">•</span>
                              <span>{formatLastSeen(connector.last_seen)}</span>
                            </>
                          )}
                        </div>

                        {/* Scan Progress - nur anzeigen wenn aktiv am Scannen */}
                        {connector.config?.scanning && connector.config?.scan_progress && connector.config.scan_progress.total > 0 && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <span className="text-[#0F172A] font-semibold flex items-center gap-1">
                                <span className="animate-spin">🔄</span>
                                Scanning läuft...
                              </span>
                              <span className="text-blue-600 font-bold">
                                {Math.round((connector.config.scan_progress.current / connector.config.scan_progress.total) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-white rounded-full h-2 shadow-inner">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 shadow-sm"
                                style={{ width: `${(connector.config.scan_progress.current / connector.config.scan_progress.total) * 100}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-[#64748B] mt-1">
                              {connector.config.scan_progress.current} / {connector.config.scan_progress.total} Hosts
                            </div>
                          </div>
                        )}

                        {/* Scan Configuration - Kompakt für Mobile */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {connector.config?.scan_targets && connector.config.scan_targets[0] !== 'localhost' ? (
                            <span className="text-[#0F172A]">
                              <span className="text-[#94A3B8]">Targets:</span>{' '}
                              <span className="font-medium">{connector.config.scan_targets.length} Host(s)</span>
                            </span>
                          ) : (
                            <span className="text-[#0F172A]">
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold">
                                🧠 Auto-Discovery
                              </span>
                            </span>
                          )}
                          {connector.config?.scan_ports && (
                            <span className="text-[#0F172A]">
                              <span className="text-[#94A3B8]">•</span>{' '}
                              <span className="font-medium">{connector.config.scan_ports.length} Port(s)</span>
                            </span>
                          )}
                        </div>

                        {/* Scan Statistiken */}
                        {connector.config?.last_scan && (
                          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[#0F172A] font-medium">Letzter Scan:</span>
                              <span className="text-[#64748B]">
                                {formatLastSeen(connector.config.last_scan.timestamp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-green-700">
                                ✓ {connector.config.last_scan.success} erfolgreich
                              </span>
                              {connector.config.last_scan.failed > 0 && (
                                <span className="text-red-700">
                                  ✗ {connector.config.last_scan.failed} fehlgeschlagen
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-[#94A3B8] pt-1 border-t border-[#E2E8F0]">
                          Erstellt: {new Date(connector.created_at).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} (Lokale Zeit)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => showSetup(connector)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-all shadow-md hover:shadow-lg"
                      title="Details und Scan-Results anzeigen"
                    >
                      📊 Details
                    </button>
                    <button
                      onClick={() => triggerScan(connector.id)}
                      disabled={connector.status !== 'active'}
                      className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-green-200"
                      title={connector.status === 'active' ? 'Scan jetzt ausführen' : 'Agent muss online sein'}
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => editConnector(connector)}
                      className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                      title="Einstellungen bearbeiten"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={() => deleteConnector(connector.id)}
                      disabled={deleting === connector.id}
                      className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 border border-red-200"
                      title="Agent löschen"
                    >
                      {deleting === connector.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Connector Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="Neuen Agent erstellen"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-2">
                  Agent-Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Büro-Agent oder Home-Scanner"
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                />
              </div>

              {/* Scan-Modus Auswahl */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-3">
                  Scan-Modus *
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors bg-white">
                    <input
                      type="radio"
                      name="scanMode"
                      value="auto"
                      checked={formData.scanMode === 'auto'}
                      onChange={(e) => setFormData({ ...formData, scanMode: e.target.value })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[#0F172A] flex items-center gap-2">
                        🧠 Auto-Discovery (Empfohlen)
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-semibold">SMART</span>
                      </div>
                      <p className="text-sm text-[#64748B] mt-1">
                        <strong>Intelligenter Netzwerk-Scan:</strong> Der Agent scannt automatisch alle privaten IP-Bereiche 
                        (192.168.x.x, 10.x.x.x), findet aktive Hosts und analysiert 25+ Standard-Ports.
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-2">
                        <strong>Erkennt:</strong> Web-Server (80, 443, 8080, 8443), Mail (25, 465, 587, 993, 995), 
                        LDAP (389, 636), Datenbanken (3306, 5432, 27017), Remote (22, 3389), File-Shares (445)
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-medium">🌐 Netzwerk-Discovery</span>
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded font-medium">🔍 Port-Scan</span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded font-medium">🏷️ Service-ID</span>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors bg-white">
                    <input
                      type="radio"
                      name="scanMode"
                      value="manual"
                      checked={formData.scanMode === 'manual'}
                      onChange={(e) => setFormData({ ...formData, scanMode: e.target.value })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[#0F172A]">
                        🎯 Manuelle Targets
                      </div>
                      <p className="text-sm text-[#64748B] mt-1">
                        <strong>Präzise Überwachung:</strong> Definiere exakte Hosts (Hostnamen oder IPs) und 
                        Ports für gezieltes Scanning. Ideal für produktive Systeme oder wenn nur bestimmte 
                        Server überwacht werden sollen.
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-2">
                        <strong>Beispiel:</strong> mail.firma.de,ldap.intern,192.168.1.10 → Port 443,636,993
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Manuelle Targets (nur wenn Modus = manual) */}
              {formData.scanMode === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A] mb-2">
                      Scan-Targets * (Komma-separiert)
                    </label>
                    <input
                      type="text"
                      value={formData.scanTargets}
                      onChange={(e) => setFormData({ ...formData, scanTargets: e.target.value })}
                      placeholder="server1.intern,192.168.1.10,mail.corp"
                      className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                    <p className="text-xs text-[#64748B] mt-1">
                      Hostnamen oder IP-Adressen deiner Server
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#0F172A] mb-2">
                      Ports (Komma-separiert)
                    </label>
                    <input
                      type="text"
                      value={formData.scanPorts}
                      onChange={(e) => setFormData({ ...formData, scanPorts: e.target.value })}
                      placeholder="443,8443,636"
                      className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                    <p className="text-xs text-[#64748B] mt-1">
                      Standard: 443 (HTTPS), 8443 (Alt-HTTPS), 636 (LDAPS)
                    </p>
                  </div>
                </>
              )}

              {/* Auto-Discovery Info */}
              {formData.scanMode === 'auto' && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                    <span className="text-xl">🧠</span>
                    Auto-Discovery Scan-Prozess
                  </h4>
                  <div className="text-sm text-[#64748B] space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">1.</span>
                      <div>
                        <strong>Netzwerk-Erkennung:</strong> Scannt alle privaten IP-Bereiche 
                        (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">2.</span>
                      <div>
                        <strong>Port-Scanning:</strong> 25+ Standard-Ports pro Host 
                        (Web: 80/443/8080/8443 • Mail: 25/465/587/993/995 • LDAP: 389/636 • DB: 3306/5432/27017 • Remote: 22/3389 • SMB: 445)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">3.</span>
                      <div>
                        <strong>Service-Identifikation:</strong> Erkennt Dienste automatisch (HTTP, HTTPS, SSH, RDP, SMTP, IMAP, LDAP, MySQL, PostgreSQL, etc.)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">4.</span>
                      <div>
                        <strong>TLS-Zertifikat-Extraktion:</strong> Scannt alle TLS-fähigen Ports und extrahiert Zertifikat-Metadaten (CN, SAN, Issuer, Ablaufdatum, Fingerprint)
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-[#64748B] italic">
                      💡 Tipp: Nutze manuelle Targets für produktive Umgebungen oder wenn nur bestimmte Server überwacht werden sollen.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={createConnector}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Erstelle...' : 'Agent erstellen'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F1F5F9] transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Token Modal (zeigt Docker-Befehl) */}
        {showTokenModal && newConnector && (
          <Modal
            isOpen={showTokenModal}
            onClose={() => setShowTokenModal(false)}
            title={`✅ Agent "${newConnector.name}" erstellt!`}
          >
            <div className="space-y-6">
              {/* Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h4 className="font-semibold text-[#0F172A] mb-1">
                      Agent erfolgreich erstellt!
                    </h4>
                    <p className="text-sm text-[#64748B]">
                      <strong>Nächster Schritt:</strong> Kopiere den Docker-Befehl unten und führe ihn auf deinem 
                      Server/PC aus. Der Agent verbindet sich automatisch und beginnt mit dem Scanning.
                      <br /><br />
                      <strong>Wichtig:</strong> Der Token bleibt in der Datenbank gespeichert und kann später 
                      jederzeit über "📊 Details" abgerufen werden. Bei Kompromittierung kann ein neuer Token 
                      generiert werden.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#E2E8F0]">
                <button
                  onClick={() => setSelectedTab('docker')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    selectedTab === 'docker'
                      ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  🐳 Docker Run
                </button>
                <button
                  onClick={() => setSelectedTab('compose')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    selectedTab === 'compose'
                      ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  📦 Docker Compose
                </button>
                <button
                  onClick={() => setSelectedTab('windows')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    selectedTab === 'windows'
                      ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  🪟 Windows
                </button>
              </div>

              {/* Command Output */}
              <div>
                {selectedTab === 'docker' && (
                  <div className="relative">
                    <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                      {getDockerCommand(newConnector)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getDockerCommand(newConnector), 0)}
                      className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
                    >
                      {copiedIndex === 0 ? '✓ Kopiert!' : '📋 Kopieren'}
                    </button>
                  </div>
                )}

                {selectedTab === 'compose' && (
                  <div className="relative">
                    <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                      {getDockerComposeContent(newConnector)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getDockerComposeContent(newConnector), 1)}
                      className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
                    >
                      {copiedIndex === 1 ? '✓ Kopiert!' : '📋 Kopieren'}
                    </button>
                  </div>
                )}

                {selectedTab === 'windows' && (
                  <div className="relative">
                    <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                      {getWindowsCommand(newConnector)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getWindowsCommand(newConnector), 2)}
                      className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
                    >
                      {copiedIndex === 2 ? '✓ Kopiert!' : '📋 Kopieren'}
                    </button>
                  </div>
                )}
              </div>

              {/* Nächste Schritte */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-[#0F172A] mb-2">🚀 Nächste Schritte:</h4>
                <ol className="text-sm text-[#64748B] space-y-1 list-decimal list-inside">
                  <li>Kopiere den Docker-Befehl oben</li>
                  <li>Führe ihn auf deinem Computer/Server aus</li>
                  <li>Agent startet und meldet sich automatisch (Status wird 🟢 Online)</li>
                  <li>Klicke "📊 Details" um Live-Ergebnisse zu sehen!</li>
                </ol>
              </div>

              {/* Wichtiger Hinweis */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <span className="text-xl">💡</span>
                  <div>
                    <h4 className="font-semibold text-[#0F172A] mb-1">Wichtig für Auto-Discovery!</h4>
                    <p className="text-sm text-[#64748B]">
                      Der Befehl verwendet <code className="bg-white px-1 rounded">--network host</code>. 
                      Das ist wichtig, damit der Agent dein lokales Netzwerk sehen kann!
                      <br /><br />
                      <strong>Windows Docker Desktop:</strong> Host-Network funktioniert nur auf Linux. 
                      Für Windows: Verwende manuelle Targets statt Auto-Discovery.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowTokenModal(false)}
                className="w-full px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
              >
                Verstanden, Modal schließen
              </button>
            </div>
          </Modal>
        )}

        {/* Edit Settings Modal */}
        {showEditModal && selectedConnector && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title={`⚙️ Einstellungen: ${selectedConnector.name}`}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-2">
                  Scan-Targets (Komma-separiert)
                </label>
                <input
                  type="text"
                  defaultValue={selectedConnector.config?.scan_targets?.join(',') || ''}
                  id="edit-targets"
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  placeholder="server1.intern,mail.corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-2">
                  Ports (Komma-separiert)
                </label>
                <input
                  type="text"
                  defaultValue={selectedConnector.config?.scan_ports?.join(',') || '443'}
                  id="edit-ports"
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  placeholder="443,8443,636"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-2">
                  Scan-Intervall (Minuten)
                </label>
                <select
                  id="edit-interval"
                  defaultValue="60"
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                >
                  <option value="5">5 Minuten</option>
                  <option value="15">15 Minuten</option>
                  <option value="30">30 Minuten</option>
                  <option value="60">1 Stunde</option>
                  <option value="120">2 Stunden</option>
                  <option value="360">6 Stunden</option>
                  <option value="1440">24 Stunden</option>
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-[#64748B]">
                  ⚠️ <strong>Wichtig:</strong> Nach dem Speichern musst du den Agent neu starten, 
                  damit die Änderungen wirksam werden!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const targets = (document.getElementById('edit-targets') as HTMLInputElement)?.value
                    const ports = (document.getElementById('edit-ports') as HTMLInputElement)?.value
                    const interval = (document.getElementById('edit-interval') as HTMLSelectElement)?.value
                    
                    const newSettings = {
                      ...selectedConnector.config,
                      scan_targets: targets.split(',').map(t => t.trim()).filter(t => t),
                      scan_ports: ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p)),
                      scan_interval: parseInt(interval) * 60
                    }
                    
                    updateConnectorSettings(selectedConnector.id, newSettings)
                  }}
                  className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
                >
                  💾 Speichern
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F1F5F9] transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Setup Modal (für bestehende Connectors) */}
        {showSetupModal && selectedConnector && (
          <Modal
            isOpen={showSetupModal}
            onClose={() => setShowSetupModal(false)}
            title={`📊 Agent Details: ${selectedConnector.name}`}
          >
            <div className="space-y-4">
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <h4 className="font-semibold text-[#0F172A] mb-1">
                      Setup-Informationen
                    </h4>
                    <p className="text-sm text-[#64748B]">
                      Dies sind die Einstellungen für diesen Agent. 
                      <strong className="text-red-600"> Der Token wurde aus Sicherheitsgründen bereits gelöscht.</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Activity Feed */}
              {activityLog.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold text-[#0F172A]">🔴 Live Activity</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
                    {activityLog.map((log, idx) => (
                      <div key={idx} className="text-[#64748B] animate-fade-in">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Übersicht */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <div className="text-2xl mb-1">🤖</div>
                  <div className="text-sm text-[#64748B]">Status</div>
                  <div className="mt-1">{getStatusBadge(selectedConnector.status)}</div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {formatLastSeen(selectedConnector.last_seen)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                  <div className="text-2xl mb-1">🌐</div>
                  <div className="text-sm text-[#64748B]">Hosts entdeckt</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">
                    {discoveryResults.length}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <div className="text-2xl mb-1">🔐</div>
                  <div className="text-sm text-[#64748B]">Zertifikate</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">
                    {connectorCertificates.length}
                  </div>
                </div>
              </div>

              {/* Discovery Results (Network Scan) */}
              {loadingDetails ? (
                <div className="text-center py-4 text-[#64748B]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
                  Lade Details...
                </div>
              ) : discoveryResults.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-[#0F172A]">🌐 Netzwerk-Scan Ergebnisse</h4>
                    <span className="text-xs text-[#64748B]">
                      Letzte Aktualisierung: {new Date(discoveryResults[0]?.discovered_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {discoveryResults.map((result) => (
                      <div key={result.id} className="bg-white rounded-lg p-4 border border-[#E2E8F0] shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-bold text-[#0F172A]">{result.host}</span>
                            {result.ip_address !== result.host && (
                              <span className="text-sm text-[#64748B] ml-2">({result.ip_address})</span>
                            )}
                          </div>
                          <span className="text-xs text-[#64748B]">
                            {result.response_time}ms
                          </span>
                        </div>
                        
                        {/* Offene Ports */}
                        <div className="mb-2">
                          <span className="text-xs font-medium text-[#64748B]">Offene Ports:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.open_ports?.map((port: number, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono"
                              >
                                {port}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Services */}
                        {result.services && result.services.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-[#64748B]">Services:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.services.map((service: string, idx: number) => (
                                <Badge key={idx} variant="info">
                                  {service}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Assets Liste */}
              {loadingDetails ? (
                <div className="text-center py-4 text-[#64748B]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
                  Lade Details...
                </div>
              ) : connectorAssets.length > 0 ? (
                <div>
                  <h4 className="font-semibold text-[#0F172A] mb-2">📡 Gescannte Assets</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {connectorAssets.map((asset) => (
                      <div key={asset.id} className="bg-[#F8FAFC] rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#0F172A]">
                            {asset.host}:{asset.port}
                          </span>
                          <Badge variant={asset.status === 'active' ? 'success' : 'neutral'}>
                            {asset.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-[#64748B] mt-1">
                          Protocol: {asset.proto} • Erstellt: {new Date(asset.created_at).toLocaleString('de-DE')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Certificates Vorschau */}
              {connectorCertificates.length > 0 && (
                <div>
                  <h4 className="font-semibold text-[#0F172A] mb-2">🔐 Zertifikate (letzte 10)</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {connectorCertificates.map((cert) => {
                      const daysLeft = Math.floor((new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      return (
                        <div key={cert.id} className="bg-[#F8FAFC] rounded-lg p-3 text-sm border border-[#E2E8F0]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-[#0F172A]">{cert.subject_cn}</span>
                            <Badge variant={daysLeft < 30 ? 'warning' : 'success'}>
                              {daysLeft} Tage
                            </Badge>
                          </div>
                          <div className="text-xs text-[#64748B]">
                            Issuer: {cert.issuer} • Gültig bis: {new Date(cert.not_after).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Token anzeigen/verstecken */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#0F172A]">
                    🔑 Connector Token
                  </label>
                  <button
                    onClick={() => setShowFullToken(showFullToken === selectedConnector.id ? null : selectedConnector.id)}
                    className="px-3 py-1 text-xs font-medium text-[#3B82F6] hover:bg-blue-100 rounded transition-colors"
                  >
                    {showFullToken === selectedConnector.id ? '🙈 Verstecken' : '👁️ Anzeigen'}
                  </button>
                </div>
                <div className="bg-white rounded px-3 py-2 font-mono text-sm break-all border border-blue-200">
                  {showFullToken === selectedConnector.id 
                    ? selectedConnector.auth_token 
                    : maskToken(selectedConnector.auth_token)}
                </div>
                {showFullToken === selectedConnector.id && (
                  <p className="text-xs text-orange-600 mt-2 font-medium">
                    ⚠️ Token ist sichtbar! Teile ihn nicht mit anderen.
                  </p>
                )}
              </div>

              {/* Command Template */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-2">
                  Docker-Befehl
                </label>
                <div className="relative">
                  <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono max-h-96">
                    {getSetupCommand(selectedConnector, showFullToken === selectedConnector.id)}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(getSetupCommand(selectedConnector, true), 99)}
                    className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
                    title="Kopiert mit echtem Token!"
                  >
                    {copiedIndex === 99 ? '✓ Kopiert!' : '📋 Kopieren'}
                  </button>
              </div>
                <p className="text-xs text-[#64748B] mt-2">
                  💡 Der Kopieren-Button kopiert den Befehl mit dem <strong>echten Token</strong> (auch wenn maskiert angezeigt).
              </p>
            </div>

              {/* Token regenerieren */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[#0F172A] mb-1">
                      Token neu generieren
                    </h4>
                    <p className="text-sm text-[#64748B] mb-3">
                      Wenn der Token kompromittiert wurde oder du den Agent neu installieren musst, 
                      kannst du einen neuen Token generieren. Der alte wird ungültig.
                    </p>
                    <button
                      onClick={() => {
                        setShowSetupModal(false)
                        regenerateToken(selectedConnector.id)
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors text-sm"
                    >
                      🔄 Neuen Token generieren
            </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSetupModal(false)}
                className="w-full px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
              >
                Schließen
              </button>
            </div>
          </Modal>
        )}

        {/* Quick Start Guide */}
        <div className="mt-8 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              Quick Start: Agent in 3 Schritten
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Vollautomatisiertes Deployment - kein Setup, keine Konfiguration
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  1
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 h-full">
                  <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Agent konfigurieren</h3>
                  <p className="text-sm text-[#64748B] mb-3">
                    Klicke oben auf <strong>"Neuen Agent erstellen"</strong>
                  </p>
                  <ul className="text-xs text-[#64748B] space-y-1">
                    <li>✓ Wähle Auto-Discovery (empfohlen)</li>
                    <li>✓ Oder manuelle Targets (für Produktion)</li>
                    <li>✓ Token wird automatisch generiert</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  2
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 h-full">
                  <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Befehl kopieren</h3>
                  <p className="text-sm text-[#64748B] mb-3">
                    Der Docker-Befehl wird fertig generiert
                  </p>
                  <ul className="text-xs text-[#64748B] space-y-1">
                    <li>✓ Enthält Token & alle Credentials</li>
                    <li>✓ Vorkonfiguriert (keine .env nötig)</li>
                    <li>✓ 3 Varianten: Docker, Compose, Windows</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  3
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 h-full">
                  <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Starten & Überwachen</h3>
                  <p className="text-sm text-[#64748B] mb-3">
                    Befehl ausführen - fertig!
                  </p>
                  <ul className="text-xs text-[#64748B] space-y-1">
                    <li>✓ Auto-Connect & Status 🟢 Online</li>
                    <li>✓ Heartbeat alle 30s</li>
                    <li>✓ Live-Results im Dashboard</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Tech Specs */}
            <div className="mt-6 bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚙️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#0F172A] text-sm mb-2">Technische Spezifikationen</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#64748B]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Runtime:</strong> Go 1.22.0</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Image:</strong> Alpine Linux (~10MB)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Auth:</strong> Token-based (bcrypt hash)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Protocol:</strong> HTTPS/TLS x509</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Scanning:</strong> 50 concurrent workers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Monitoring:</strong> Heartbeat 30s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Logging:</strong> Structured JSON</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>API:</strong> Supabase REST + Realtime</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}