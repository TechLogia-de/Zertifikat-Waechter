import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import Badge from '../components/ui/Badge'
import PageInfoBox from '../components/ui/PageInfoBox'

interface LogEntry {
  id: string
  connector_id: string
  connector_name: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  metadata: any
  timestamp: string
}

export default function AgentLogs() {
  const { user } = useAuth()
  const { tenantId } = useTenantId()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [selectedConnector, setSelectedConnector] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    loadTenantData()

    // Realtime Log-Updates
    const channel = supabase
      .channel('agent-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
        },
        (payload) => {
          const newLog = payload.new as LogEntry
          // Only add if it belongs to our tenant's connectors
          if (connectors.some(c => c.id === newLog.connector_id)) {
            setLogs(prev => [newLog, ...prev].slice(0, 200))

            if (autoScroll) {
              scrollToTop()
            }
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [tenantId])

  async function loadTenantData() {
    if (!tenantId) return

    try {
      await fetchConnectors(tenantId)
      await fetchLogs()
    } catch (err) {
      console.error('Failed to load tenant data:', err)
    }
  }

  async function fetchConnectors(tenant: string) {
    const { data } = await supabase
      .from('connectors')
      .select('id, name')
      .eq('tenant_id', tenant)
      .order('name')

    setConnectors(data || [])
  }

  async function fetchLogs() {
    if (!tenantId) return

    setLoading(true)
    try {
      // Hole nur Connectors des eigenen Tenants
      const { data: myConnectors } = await supabase
        .from('connectors')
        .select('id')
        .eq('tenant_id', tenantId) // ✅ TENANT-FILTER!

      const connectorIds = myConnectors?.map(c => c.id) || []

      if (connectorIds.length === 0) {
        setLogs([])
        setLoading(false)
        return
      }

      // NUR Logs der eigenen Connectors laden!
      let query = supabase
        .from('agent_logs')
        .select('*')
        .in('connector_id', connectorIds) // ✅ NUR EIGENE CONNECTORS!
        .order('timestamp', { ascending: false })
        .limit(200)

      if (selectedConnector !== 'all') {
        query = query.eq('connector_id', selectedConnector)
      }

      if (selectedLevel !== 'all') {
        query = query.eq('level', selectedLevel)
      }

      const { data } = await query
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  function scrollToTop() {
    const logContainer = document.getElementById('log-container')
    if (logContainer) {
      logContainer.scrollTop = 0
    }
  }

  function getLevelBadge(level: string) {
    switch (level) {
      case 'error':
        return <Badge variant="error">ERROR</Badge>
      case 'warning':
        return <Badge variant="warning">WARN</Badge>
      case 'info':
        return <Badge variant="info">INFO</Badge>
      case 'debug':
        return <Badge variant="neutral">DEBUG</Badge>
      default:
        return <Badge variant="neutral">{level}</Badge>
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp) // Konvertiert UTC zu lokaler Zeit
    const time = date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    const ms = String(date.getMilliseconds()).padStart(3, '0')
    return `${time}.${ms}` // HH:MM:SS.mmm
  }

  useEffect(() => {
    if (tenantId) {
      fetchLogs()
    }
  }, [selectedConnector, selectedLevel, tenantId])

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
            <span className="text-xl sm:text-2xl">📡</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Agent Logs</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
          Realtime Logs • WebSocket • Strukturierte JSON-Ausgaben • Log-Levels
        </p>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <PageInfoBox title="Agent Logs - Echtzeit-Protokollierung" variant="info" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-[#1E3A5F]">
                Hier sehen Sie die Echtzeit-Logs aller verbundenen Agenten. Neue Log-Einträge werden automatisch
                per WebSocket-Verbindung empfangen und angezeigt - ohne manuelles Aktualisieren.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Log-Level</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                    <li><strong>INFO:</strong> Normale Betriebsmeldungen (Scan gestartet, Zertifikat gefunden)</li>
                    <li><strong>WARN:</strong> Potenzielle Probleme (Zertifikat läuft bald ab, langsame Verbindung)</li>
                    <li><strong>ERROR:</strong> Fehler bei Scans oder Verbindungen (Timeout, DNS-Fehler)</li>
                    <li><strong>DEBUG:</strong> Detaillierte technische Informationen zur Fehlersuche</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Was Agenten melden</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                    <li>TLS-Scan-Ergebnisse und entdeckte Zertifikate</li>
                    <li>Netzwerk-Discovery (neue Hosts und offene Ports)</li>
                    <li>Heartbeat-Status und Verbindungsinformationen</li>
                    <li>Fehler bei der Kommunikation mit dem Backend</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Filteroptionen</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                    <li>Nach Agent filtern, um Logs eines bestimmten Connectors zu sehen</li>
                    <li>Nach Log-Level filtern, um nur Fehler oder Warnungen anzuzeigen</li>
                    <li>Auto-Scroll aktivieren, um automatisch zu neuen Einträgen zu springen</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Hinweise</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                    <li>Es werden maximal die letzten 200 Einträge angezeigt</li>
                    <li>Strukturierte JSON-Metadaten werden bei Bedarf ausgeklappt</li>
                    <li>Logs sind durch Row Level Security mandantenisoliert</li>
                  </ul>
                </div>
              </div>
            </div>
          </PageInfoBox>

          {/* Filter */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium text-[#64748B] mr-2">Agent:</label>
              <select
                value={selectedConnector}
                onChange={(e) => setSelectedConnector(e.target.value)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="all">Alle Agents</option>
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#64748B] mr-2">Level:</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="all">Alle</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm text-[#64748B] flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                Auto-Scroll
              </label>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">Live</span>
            </div>
          </div>
          </div>

          {/* Logs */}
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#334155] bg-[#0F172A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">📋 Live Logs</span>
              <Badge variant="success">{logs.length} Einträge</Badge>
            </div>
            <button
              onClick={() => fetchLogs()}
              className="px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
            >
              🔄 Aktualisieren
            </button>
          </div>

          <div
            id="log-container"
            className="h-[600px] overflow-y-auto p-4 space-y-2 font-mono text-sm"
          >
            {loading ? (
              <div className="text-center text-[#94A3B8] py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
                Lade Logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center text-[#94A3B8] py-8">
                Keine Logs gefunden. Warte auf Agent-Activity...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border ${
                    log.level === 'error'
                      ? 'bg-red-950/50 border-red-800/50'
                      : log.level === 'warning'
                      ? 'bg-yellow-950/50 border-yellow-800/50'
                      : 'bg-[#334155]/30 border-[#475569]/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-[#94A3B8] text-xs flex-shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <div className="flex-shrink-0">
                      {getLevelBadge(log.level)}
                    </div>
                    <span className="text-[#CBD5E1] flex-shrink-0 text-xs">
                      [{log.connector_name}]
                    </span>
                    <span className={`flex-1 ${
                      log.level === 'error' ? 'text-red-300' :
                      log.level === 'warning' ? 'text-yellow-300' :
                      'text-[#E2E8F0]'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 ml-8">
                      {/* Structured metadata display */}
                      <div className="flex flex-wrap gap-1.5">
                        {log.metadata.phase && (
                          <span className="px-2 py-0.5 bg-indigo-900/60 text-indigo-300 text-[10px] rounded-full border border-indigo-700/50 font-medium">
                            Phase: {log.metadata.phase_label || log.metadata.phase}
                          </span>
                        )}
                        {log.metadata.percentage !== undefined && (
                          <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 text-[10px] rounded-full border border-blue-700/50 font-medium">
                            {log.metadata.percentage}%
                          </span>
                        )}
                        {log.metadata.device_type && (
                          <span className="px-2 py-0.5 bg-orange-900/60 text-orange-300 text-[10px] rounded-full border border-orange-700/50 font-medium">
                            {log.metadata.device_type}
                          </span>
                        )}
                        {log.metadata.hostname && (
                          <span className="px-2 py-0.5 bg-cyan-900/60 text-cyan-300 text-[10px] rounded-full border border-cyan-700/50 font-mono">
                            {log.metadata.hostname}
                          </span>
                        )}
                        {log.metadata.ip && (
                          <span className="px-2 py-0.5 bg-slate-700/60 text-slate-300 text-[10px] rounded-full border border-slate-600/50 font-mono">
                            {log.metadata.ip}
                          </span>
                        )}
                        {log.metadata.is_gateway && (
                          <span className="px-2 py-0.5 bg-yellow-900/60 text-yellow-300 text-[10px] rounded-full border border-yellow-700/50 font-bold">
                            ⭐ Gateway
                          </span>
                        )}
                        {log.metadata.os_type && log.metadata.os_type !== 'unknown' && (
                          <span className="px-2 py-0.5 bg-green-900/60 text-green-300 text-[10px] rounded-full border border-green-700/50">
                            OS: {log.metadata.os_type}
                          </span>
                        )}
                        {log.metadata.open_ports && (
                          <span className="px-2 py-0.5 bg-purple-900/60 text-purple-300 text-[10px] rounded-full border border-purple-700/50">
                            {log.metadata.open_ports.length} Ports
                          </span>
                        )}
                        {log.metadata.hosts_found !== undefined && (
                          <span className="px-2 py-0.5 bg-teal-900/60 text-teal-300 text-[10px] rounded-full border border-teal-700/50">
                            {log.metadata.hosts_found} Hosts
                          </span>
                        )}
                        {log.metadata.certificates !== undefined && (
                          <span className="px-2 py-0.5 bg-emerald-900/60 text-emerald-300 text-[10px] rounded-full border border-emerald-700/50">
                            {log.metadata.certificates} Zertifikate
                          </span>
                        )}
                        {log.metadata.duration_ms !== undefined && (
                          <span className="px-2 py-0.5 bg-slate-700/60 text-slate-300 text-[10px] rounded-full border border-slate-600/50">
                            {log.metadata.duration_ms >= 1000
                              ? `${(log.metadata.duration_ms / 1000).toFixed(1)}s`
                              : `${log.metadata.duration_ms}ms`}
                          </span>
                        )}
                        {log.metadata.errors !== undefined && log.metadata.errors > 0 && (
                          <span className="px-2 py-0.5 bg-red-900/60 text-red-300 text-[10px] rounded-full border border-red-700/50">
                            {log.metadata.errors} Fehler
                          </span>
                        )}
                        {log.metadata.subject_cn && (
                          <span className="px-2 py-0.5 bg-emerald-900/60 text-emerald-300 text-[10px] rounded-full border border-emerald-700/50 font-mono">
                            CN: {log.metadata.subject_cn}
                          </span>
                        )}
                        {log.metadata.port && (
                          <span className="px-2 py-0.5 bg-slate-700/60 text-slate-300 text-[10px] rounded-full border border-slate-600/50 font-mono">
                            :{log.metadata.port}
                          </span>
                        )}
                        {log.metadata.scan_mode && (
                          <span className="px-2 py-0.5 bg-violet-900/60 text-violet-300 text-[10px] rounded-full border border-violet-700/50">
                            {log.metadata.scan_mode}
                          </span>
                        )}
                      </div>
                      {/* Device type distribution in final summary */}
                      {log.metadata.device_types && typeof log.metadata.device_types === 'object' && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(log.metadata.device_types).map(([type, count]) => (
                            <span key={type} className="px-2 py-0.5 bg-slate-700/40 text-slate-400 text-[10px] rounded border border-slate-600/30">
                              {type}: {String(count)}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Services list */}
                      {log.metadata.services && Array.isArray(log.metadata.services) && log.metadata.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {log.metadata.services.map((svc: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-900/40 text-blue-400 text-[10px] rounded border border-blue-800/30">
                              {svc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}

