import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'

interface SecurityEvent {
  id: string
  event_type: string
  ip_address: string
  user_agent: string
  user_email: string | null
  metadata: Record<string, any>
  created_at: string
}

interface BlockedIP {
  id: string
  ip_address: string
  reason: string
  blocked_at: string
  expires_at: string | null
  block_count: number
}

interface FailedLogin {
  id: string
  email: string
  ip_address: string
  user_agent: string
  error_message: string
  attempted_at: string
}

interface SystemMetric {
  name: string
  value: number
  trend: 'up' | 'down' | 'stable'
  color: string
  icon: string
}

export default function DevSecurity() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'blocked' | 'logins' | 'mfa'>('overview')

  // Data States
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [failedLogins, setFailedLogins] = useState<FailedLogin[]>([])
  const [mfaEvents, setMfaEvents] = useState<SecurityEvent[]>([])

  // Filters
  const [eventFilter, setEventFilter] = useState('')
  const [ipFilter, setIpFilter] = useState('')
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')

  // Metrics
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { name: 'Failed Logins (24h)', value: 0, trend: 'stable', color: '#EF4444', icon: '🔐' },
    { name: 'Blocked IPs', value: 0, trend: 'stable', color: '#F59E0B', icon: '🚫' },
    { name: 'Security Events (24h)', value: 0, trend: 'stable', color: '#3B82F6', icon: '⚠️' },
    { name: 'Active Sessions', value: 0, trend: 'stable', color: '#10B981', icon: '👥' },
  ])

  useEffect(() => {
    loadSecurityData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadSecurityData()
    }, 30000)

    return () => clearInterval(interval)
  }, [user, timeRange])

  async function loadSecurityData() {
    if (!user) return

    try {
      // In einer echten Implementierung würdest du hier deine Security-Tabellen abfragen
      // Für Demo-Zwecke verwenden wir Mock-Daten und Events

      // Load audit events as security events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .or('type.ilike.%login%,type.ilike.%security%')
        .order('ts', { ascending: false })
        .limit(100)

      // Load MFA events specifically
      const { data: mfaEventsData } = await supabase
        .from('events')
        .select('*')
        .ilike('type', '%mfa%')
        .order('ts', { ascending: false })
        .limit(100)

      // Transform events to security events
      const events: SecurityEvent[] = (eventsData || []).map((e: any) => ({
        id: e.id,
        event_type: e.type,
        ip_address: e.payload?.ip_address || 'Unknown',
        user_agent: e.payload?.user_agent || 'Unknown',
        user_email: e.payload?.email || null,
        metadata: e.payload || {},
        created_at: e.ts || e.created_at
      }))

      setSecurityEvents(events)

      // Transform MFA events
      const mfaEventsTransformed: SecurityEvent[] = (mfaEventsData || []).map((e: any) => ({
        id: e.id,
        event_type: e.type,
        ip_address: e.payload?.ip_address || 'Unknown',
        user_agent: e.payload?.user_agent || 'Unknown',
        user_email: e.payload?.user_email || null,
        metadata: e.payload || {},
        created_at: e.ts || e.created_at
      }))
      setMfaEvents(mfaEventsTransformed)

      // Mock data for blocked IPs (in Production würdest du eine echte Tabelle haben)
      const mockBlockedIPs: BlockedIP[] = [
        {
          id: '1',
          ip_address: '192.168.1.100',
          reason: 'Too many failed login attempts',
          blocked_at: new Date(Date.now() - 3600000).toISOString(),
          expires_at: new Date(Date.now() + 82800000).toISOString(),
          block_count: 5
        },
        {
          id: '2',
          ip_address: '10.0.0.50',
          reason: 'Suspicious activity detected',
          blocked_at: new Date(Date.now() - 7200000).toISOString(),
          expires_at: null, // Permanent block
          block_count: 12
        }
      ]
      setBlockedIPs(mockBlockedIPs)

      // Mock failed logins
      const mockFailedLogins: FailedLogin[] = [
        {
          id: '1',
          email: 'attacker@evil.com',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          error_message: 'Invalid credentials',
          attempted_at: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: '2',
          email: 'test@example.com',
          ip_address: '10.0.0.50',
          user_agent: 'curl/7.68.0',
          error_message: 'Account locked',
          attempted_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]
      setFailedLogins(mockFailedLogins)

      // Update metrics
      const mfaFailedCount = mfaEventsTransformed.filter(e =>
        e.event_type.includes('failed') || e.event_type.includes('challenge.failed')
      ).length

      setMetrics([
        { name: 'Failed Logins (24h)', value: mockFailedLogins.length, trend: 'down', color: '#EF4444', icon: '🔐' },
        { name: 'MFA Events (24h)', value: mfaEventsTransformed.length, trend: mfaFailedCount > 0 ? 'up' : 'stable', color: '#8B5CF6', icon: '🛡️' },
        { name: 'Blocked IPs', value: mockBlockedIPs.length, trend: 'stable', color: '#F59E0B', icon: '🚫' },
        { name: 'Security Events (24h)', value: events.length, trend: 'up', color: '#3B82F6', icon: '⚠️' },
      ])

    } catch (error) {
      console.error('Failed to load security data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function unblockIP(ipAddress: string) {
    if (!confirm(`IP-Adresse ${ipAddress} entsperren?`)) return

    // In Production würdest du die Datenbank aktualisieren
    setBlockedIPs(prev => prev.filter(ip => ip.ip_address !== ipAddress))
    alert(`✅ IP ${ipAddress} wurde entsperrt`)
  }

  function getTrendIcon(trend: 'up' | 'down' | 'stable') {
    if (trend === 'up') return '📈'
    if (trend === 'down') return '📉'
    return '➡️'
  }

  function getTimeRangeLabel() {
    switch (timeRange) {
      case '1h': return 'Letzte Stunde'
      case '24h': return 'Letzte 24 Stunden'
      case '7d': return 'Letzte 7 Tage'
      case '30d': return 'Letzte 30 Tage'
    }
  }

  const filteredEvents = securityEvents.filter(event => {
    if (eventFilter && !event.event_type.toLowerCase().includes(eventFilter.toLowerCase())) {
      return false
    }
    if (ipFilter && !event.ip_address.includes(ipFilter)) {
      return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-b border-red-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-lg shadow-red-500/20">
                <span className="text-xl sm:text-2xl">🔒</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Security Monitoring</h1>
              <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs font-bold text-red-300">
                DEV ONLY
              </span>
            </div>
            <p className="text-xs sm:text-sm text-red-200 mt-0.5 ml-0.5">
              Angriffe • Gesperrte IPs • Failed Logins • Security Events • Realtime
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 bg-red-800/50 border border-red-600/50 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="1h">Letzte Stunde</option>
              <option value="24h">Letzte 24h</option>
              <option value="7d">Letzte 7 Tage</option>
              <option value="30d">Letzte 30 Tage</option>
            </select>
            <button
              onClick={loadSecurityData}
              className="px-3 py-2 bg-red-700/50 border border-red-600/50 text-white rounded-lg text-sm hover:bg-red-700 transition-all duration-200"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3 ml-0.5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              activeTab === 'overview'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-red-200 hover:text-white hover:bg-red-700/50'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              activeTab === 'events'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-red-200 hover:text-white hover:bg-red-700/50'
            }`}
          >
            ⚠️ Security Events
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              activeTab === 'blocked'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-red-200 hover:text-white hover:bg-red-700/50'
            }`}
          >
            🚫 Blocked IPs ({blockedIPs.length})
          </button>
          <button
            onClick={() => setActiveTab('logins')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              activeTab === 'logins'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-red-200 hover:text-white hover:bg-red-700/50'
            }`}
          >
            🔐 Failed Logins ({failedLogins.length})
          </button>
          <button
            onClick={() => setActiveTab('mfa')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              activeTab === 'mfa'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-red-200 hover:text-white hover:bg-red-700/50'
            }`}
          >
            🛡️ MFA/2FA Events ({mfaEvents.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-slate-950">
        {loading ? (
          <LoadingState size="lg" text="Lade Security-Daten..." />
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {metrics.map((metric, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">{metric.icon}</span>
                        <span className="text-xl">{getTrendIcon(metric.trend)}</span>
                      </div>
                      <h3 className="text-sm text-slate-400 mb-1">{metric.name}</h3>
                      <p className="text-3xl font-bold" style={{ color: metric.color }}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Recent Activity */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>⚡</span>
                    <span>Aktuelle Aktivität ({getTimeRangeLabel()})</span>
                  </h2>
                  <div className="space-y-3">
                    {securityEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all"
                      >
                        <div className="text-2xl">
                          {event.event_type.includes('failed') ? '❌' :
                           event.event_type.includes('success') ? '✅' :
                           event.event_type.includes('blocked') ? '🚫' : '⚠️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white text-sm">
                              {event.event_type.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </h3>
                            <span className="text-xs text-slate-500">
                              {new Date(event.created_at).toLocaleString('de-DE')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <span>🌐</span>
                              <span>{event.ip_address}</span>
                            </span>
                            {event.user_email && (
                              <span className="flex items-center gap-1">
                                <span>📧</span>
                                <span>{event.user_email}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Health */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span>💚</span>
                      <span>System Health</span>
                    </h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">Database</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Online
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">API Server</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Online
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">WebSocket</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Connected
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">Rate Limiter</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span>🛡️</span>
                      <span>Security Status</span>
                    </h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">Firewall</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">DDoS Protection</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Enabled
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">Brute Force Protection</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ Enabled
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-300">IP Blocking</span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                          ✓ {blockedIPs.length} Blocked
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Security Events Tab */}
            {activeTab === 'events' && (
              <>
                {/* Filters */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      placeholder="Event-Typ filtern..."
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <input
                      type="text"
                      value={ipFilter}
                      onChange={(e) => setIpFilter(e.target.value)}
                      placeholder="IP-Adresse filtern..."
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Events List */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Zeit</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Event-Typ</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">IP-Adresse</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">User</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredEvents.map((event) => (
                          <tr key={event.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                              {new Date(event.created_at).toLocaleString('de-DE')}
                            </td>
                            <td className="px-4 py-3 text-sm text-white font-medium">
                              {event.event_type}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                              {event.ip_address}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {event.user_email || '-'}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {event.user_agent.substring(0, 50)}...
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Blocked IPs Tab */}
            {activeTab === 'blocked' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800 border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">IP-Adresse</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Grund</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Blockiert am</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Läuft ab</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Versuche</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {blockedIPs.map((ip) => (
                        <tr key={ip.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-white font-mono font-bold">
                            {ip.ip_address}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {ip.reason}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(ip.blocked_at).toLocaleString('de-DE')}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {ip.expires_at ? (
                              <span className="text-yellow-400">
                                {new Date(ip.expires_at).toLocaleString('de-DE')}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">
                                Permanent
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300 text-center">
                            {ip.block_count}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => unblockIP(ip.ip_address)}
                              className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold rounded hover:bg-green-500/30 transition-all"
                            >
                              🔓 Entsperren
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MFA/2FA Events Tab */}
            {activeTab === 'mfa' && (
              <>
                <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-800/50 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">🛡️</div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white mb-2">Multi-Factor Authentication (MFA/2FA) Security</h2>
                      <p className="text-purple-200 text-sm mb-3">
                        Überwache alle MFA-Aktivitäten: Enrollment, Verifizierung, Fehlversuche und Brute-Force-Schutz.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-purple-800/30 rounded-lg p-3 border border-purple-700/30">
                          <div className="text-xs text-purple-300 mb-1">Gesamt MFA Events</div>
                          <div className="text-2xl font-bold text-white">{mfaEvents.length}</div>
                        </div>
                        <div className="bg-red-800/30 rounded-lg p-3 border border-red-700/30">
                          <div className="text-xs text-red-300 mb-1">Fehlversuche</div>
                          <div className="text-2xl font-bold text-white">
                            {mfaEvents.filter(e => e.event_type.includes('failed')).length}
                          </div>
                        </div>
                        <div className="bg-green-800/30 rounded-lg p-3 border border-green-700/30">
                          <div className="text-xs text-green-300 mb-1">Erfolgreiche Enrollments</div>
                          <div className="text-2xl font-bold text-white">
                            {mfaEvents.filter(e => e.event_type.includes('enrollment.completed')).length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Zeit</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Event</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">User</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">IP-Adresse</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {mfaEvents.map((event) => {
                          const isFailed = event.event_type.includes('failed')
                          const isSuccess = event.event_type.includes('completed') || event.event_type.includes('success')
                          const isEnrollment = event.event_type.includes('enrollment')
                          const isVerification = event.event_type.includes('verification')

                          return (
                            <tr key={event.id} className="hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                {new Date(event.created_at).toLocaleString('de-DE')}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">
                                    {isEnrollment && '📝'}
                                    {isVerification && '🔐'}
                                    {event.event_type.includes('disabled') && '🚫'}
                                    {event.event_type.includes('challenge') && '⚡'}
                                  </span>
                                  <span className="text-sm text-white font-medium">
                                    {event.event_type.split('.').slice(1).join(' ').toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-300">
                                {event.user_email || event.metadata?.user_email || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                                {event.ip_address}
                              </td>
                              <td className="px-4 py-3">
                                {isFailed ? (
                                  <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">
                                    ❌ Failed
                                  </span>
                                ) : isSuccess ? (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                                    ✅ Success
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded">
                                    ℹ️ Info
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {event.metadata?.error_message && (
                                  <div className="text-red-400 font-semibold mb-1">
                                    Error: {event.metadata.error_message}
                                  </div>
                                )}
                                {event.metadata?.method && (
                                  <div>Method: {event.metadata.method}</div>
                                )}
                                {event.metadata?.attempt_count && (
                                  <div className="text-orange-400">
                                    Attempts: {event.metadata.attempt_count}
                                  </div>
                                )}
                                {event.metadata?.factor_id && (
                                  <div className="font-mono text-xs">
                                    Factor: {event.metadata.factor_id.substring(0, 8)}...
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {mfaEvents.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                              <div className="text-4xl mb-2">🛡️</div>
                              <div>Keine MFA-Events gefunden</div>
                              <div className="text-xs mt-1">MFA-Aktivitäten werden hier angezeigt</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Failed Logins Tab */}
            {activeTab === 'logins' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800 border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Zeit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">E-Mail</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">IP-Adresse</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Fehler</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">User Agent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {failedLogins.map((login) => (
                        <tr key={login.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                            {new Date(login.attempted_at).toLocaleString('de-DE')}
                          </td>
                          <td className="px-4 py-3 text-sm text-white font-medium">
                            {login.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                            {login.ip_address}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">
                              {login.error_message}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {login.user_agent.substring(0, 40)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}
