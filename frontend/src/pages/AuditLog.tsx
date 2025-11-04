import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'

interface Event {
  id: string
  tenant_id: string
  user_id: string | null
  type: string
  payload: Record<string, any>
  ts: string
  prev_hash: string
  hash: string
  created_at: string
}

export default function AuditLog() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState<string>('')
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyBroken, setShowOnlyBroken] = useState(false)
  const [brokenEvents, setBrokenEvents] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEvents()
  }, [user, filter])

  useEffect(() => {
    if (events.length > 0) {
      verifyHashChain(events)
    }
  }, [events])

  async function loadEvents() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        setTenantId(membership.tenant_id)

        let query = supabase
          .from('events')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .order('ts', { ascending: false })
          .limit(100)

        if (filter !== 'all') {
          query = query.ilike('type', `${filter}%`)
        }

        const { data: eventsData } = await query

        setEvents((eventsData as Event[]) || [])
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  function getEventIcon(type: string): string {
    if (type.startsWith('certificate.')) return '🔐'
    if (type.startsWith('connector.')) return '🤖'
    if (type.startsWith('discovery.')) return '🌐'
    if (type.startsWith('alert.')) return '🔔'
    if (type.startsWith('user.')) return '👤'
    if (type.startsWith('scan.')) return '🔍'
    if (type.startsWith('integration.')) return '🔗'
    if (type.startsWith('acme.')) return '🔄'
    if (type.startsWith('ssl_health.')) return '🔐'
    if (type.startsWith('compliance.')) return '✅'
    if (type.startsWith('api_key.')) return '🔑'
    if (type.startsWith('notification_rule.')) return '📢'
    if (type.startsWith('tag.')) return '🏷️'
    if (type.startsWith('auto_remediation.')) return '🤖'
    if (type.startsWith('report.')) return '📄'
    if (type.startsWith('settings.')) return '⚙️'
    if (type.startsWith('policy.')) return '📋'
    return '📝'
  }

  function getEventColor(type: string): string {
    if (type.includes('error') || type.includes('failed') || type.includes('expired') || type.includes('revoked') || type.includes('deleted')) return '#EF4444'
    if (type.includes('warning') || type.includes('violation')) return '#F59E0B'
    if (type.includes('success') || type.includes('created') || type.includes('completed') || type.includes('passed')) return '#10B981'
    if (type.includes('started') || type.includes('processing')) return '#3B82F6'
    return '#6B7280'
  }

  function formatEventType(type: string): string {
    return type
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function verifyHashChain(events: Event[]): boolean {
    const broken = new Set<string>()
    
    for (let i = events.length - 1; i > 0; i--) {
      const currentEvent = events[i]
      const nextEvent = events[i - 1]
      
      if (nextEvent.prev_hash !== currentEvent.hash) {
        console.warn(`Hash chain broken at event ${nextEvent.id}`)
        broken.add(nextEvent.id)
      }
    }
    
    setBrokenEvents(broken)
    return broken.size === 0
  }

  function isEventHashValid(event: Event, index: number): boolean {
    if (index === events.length - 1) return true // Letztes Event hat keinen Vorgänger
    const prevEvent = events[index + 1]
    return event.prev_hash === prevEvent.hash
  }

  const filteredEvents = events.filter(event => {
    // Filter: Nur kaputte Hash-Chain
    if (showOnlyBroken && !brokenEvents.has(event.id)) {
      return false
    }

    // Filter: Suchbegriff
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      if (!(
        event.type.toLowerCase().includes(searchLower) ||
        JSON.stringify(event.payload).toLowerCase().includes(searchLower)
      )) {
        return false
      }
    }

    return true
  })

  const isChainValid = brokenEvents.size === 0

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                <span className="text-xl sm:text-2xl">📋</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Audit Log</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
              Unveränderliche Events • SHA-256 Hash-Chain • Manipulationssicher
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              isChainValid
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {isChainValid ? '✓ Hash-Kette valide' : `✗ ${brokenEvents.size} Event(s) ungültig`}
            </div>
            <button
              onClick={() => {
                const dataStr = JSON.stringify(events, null, 2)
                const dataBlob = new Blob([dataStr], { type: 'application/json' })
                const url = URL.createObjectURL(dataBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `audit-log-${new Date().toISOString()}.json`
                link.click()
              }}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg font-medium text-sm hover:bg-slate-700 hover:border-slate-500 transition-all duration-200 whitespace-nowrap"
            >
              <span>📥 Export JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Suche
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Event-Typ oder Details durchsuchen..."
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#3B82F6] text-sm"
              />
            </div>

            {/* Filter by Type */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Event-Typ
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#3B82F6] text-sm"
              >
                <option value="all">Alle Events</option>
                <option value="certificate">🔐 Zertifikate</option>
                <option value="ssl_health">🔐 SSL Health Checks</option>
                <option value="compliance">✅ Compliance</option>
                <option value="auto_remediation">🤖 Auto-Remediation</option>
                <option value="alert">🔔 Alerts</option>
                <option value="notification_rule">📢 Notification Rules</option>
                <option value="api_key">🔑 API Keys</option>
                <option value="tag">🏷️ Tags</option>
                <option value="connector">🤖 Agents</option>
                <option value="discovery">🌐 Network Discovery</option>
                <option value="acme">🔄 ACME Auto-Renewal</option>
                <option value="scan">🔍 Scans</option>
                <option value="integration">🔗 Integrationen</option>
                <option value="report">📄 Reports</option>
                <option value="settings">⚙️ Einstellungen</option>
                <option value="policy">📋 Policies</option>
                <option value="user">👤 Benutzer</option>
              </select>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyBroken}
                onChange={(e) => setShowOnlyBroken(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                ⚠️ Nur Events mit Hash-Problemen anzeigen
              </span>
            </label>
          </div>
        </div>

        {/* Broken Hash Warning */}
        {brokenEvents.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Hash-Kette beschädigt!</h3>
                <p className="text-sm text-red-800 mb-2">
                  {brokenEvents.size} Event{brokenEvents.size > 1 ? 's' : ''} mit ungültiger Hash-Verkettung gefunden.
                  Dies könnte auf Manipulation oder Datenbank-Inkonsistenz hinweisen.
                </p>
                <button
                  onClick={() => setShowOnlyBroken(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium underline"
                >
                  Nur betroffene Events anzeigen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Events List */}
        {loading ? (
          <LoadingState size="md" text="Lade Audit Log..." />
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-[#0F172A] mb-2">
              Keine Events gefunden
            </h3>
            <p className="text-[#64748B]">
              {searchTerm ? 'Versuche einen anderen Suchbegriff' : 'Events werden hier angezeigt'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Event Info */}
                  <div className="flex items-start space-x-3 flex-1">
                    <div 
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: `${getEventColor(event.type)}15` }}
                    >
                      <span className="text-xl">{getEventIcon(event.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 
                          className="font-semibold text-sm sm:text-base"
                          style={{ color: getEventColor(event.type) }}
                        >
                          {formatEventType(event.type)}
                        </h3>
                        <span className="text-xs text-[#94A3B8]">
                          {new Date(event.ts).toLocaleString('de-DE')}
                        </span>
                      </div>
                      
                      {/* Payload */}
                      <div className="bg-[#F8FAFC] rounded-lg p-3 mb-3">
                        <pre className="text-xs text-[#475569] overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>

                      {/* Hash Info */}
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#94A3B8] font-mono">Hash:</span>
                          <code className="bg-[#F1F5F9] px-2 py-1 rounded text-[#334155] font-mono break-all">
                            {event.hash.substring(0, 16)}...
                          </code>
                          {brokenEvents.has(event.id) && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                              ⚠️ Hash ungültig
                            </span>
                          )}
                        </div>
                        {index < filteredEvents.length - 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[#94A3B8] font-mono">Prev:</span>
                            <code className="bg-[#F1F5F9] px-2 py-1 rounded text-[#334155] font-mono break-all">
                              {event.prev_hash.substring(0, 16)}...
                            </code>
                            {isEventHashValid(event, index) ? (
                              <span className="text-[#10B981] font-bold">✓ Valid</span>
                            ) : (
                              <span className="text-[#EF4444] font-bold">✗ Ungültig</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && filteredEvents.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#3B82F6]">{events.length}</p>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">Gesamt Events</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#10B981]">
                  {events.filter(e => e.type.includes('success') || e.type.includes('created')).length}
                </p>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">Erfolge</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#F59E0B]">
                  {events.filter(e => e.type.includes('warning')).length}
                </p>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">Warnungen</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#EF4444]">
                  {events.filter(e => e.type.includes('error')).length}
                </p>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">Fehler</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


