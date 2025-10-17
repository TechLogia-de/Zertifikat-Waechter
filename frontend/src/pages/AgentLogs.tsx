import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/ui/Badge'

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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [selectedConnector, setSelectedConnector] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConnectors()
    fetchLogs()

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
          setLogs(prev => [newLog, ...prev].slice(0, 200))
          
          if (autoScroll) {
            scrollToTop()
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  async function fetchConnectors() {
    const { data } = await supabase
      .from('connectors')
      .select('id, name')
      .order('name')
    
    setConnectors(data || [])
  }

  async function fetchLogs() {
    setLoading(true)
    try {
      let query = supabase
        .from('agent_logs')
        .select('*')
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
    fetchLogs()
  }, [selectedConnector, selectedLevel])

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">Agent Logs</h1>
        <p className="text-sm md:text-base text-[#64748B] mt-1">
          Strukturierte Logs aller Agents in Echtzeit • Automatische Updates via WebSocket
        </p>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
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
                    <div className="mt-2 ml-8 text-xs text-[#94A3B8]">
                      {JSON.stringify(log.metadata, null, 2)}
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

