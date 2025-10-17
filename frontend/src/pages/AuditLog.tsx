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

  useEffect(() => {
    loadEvents()
  }, [user, filter])

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
    return '📝'
  }

  function getEventColor(type: string): string {
    if (type.includes('error') || type.includes('expired')) return '#EF4444'
    if (type.includes('warning')) return '#F59E0B'
    if (type.includes('success') || type.includes('created')) return '#10B981'
    return '#3B82F6'
  }

  function formatEventType(type: string): string {
    return type
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function verifyHashChain(events: Event[]): boolean {
    for (let i = events.length - 1; i > 0; i--) {
      const currentEvent = events[i]
      const nextEvent = events[i - 1]
      
      if (nextEvent.prev_hash !== currentEvent.hash) {
        console.warn(`Hash chain broken at event ${nextEvent.id}`)
        return false
      }
    }
    return true
  }

  const filteredEvents = events.filter(event => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      event.type.toLowerCase().includes(searchLower) ||
      JSON.stringify(event.payload).toLowerCase().includes(searchLower)
    )
  })

  const isChainValid = verifyHashChain(events)

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Audit Log</h1>
            <p className="text-[#64748B] mt-1 text-sm sm:text-base">
              Unveränderliche Event-Historie • Kryptographische Hash-Chain (SHA-256) • Manipulationssicher
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
              isChainValid 
                ? 'bg-[#D1FAE5] text-[#065F46]' 
                : 'bg-[#FEE2E2] text-[#991B1B]'
            }`}>
              {isChainValid ? '✓ Hash-Kette valide' : '✗ Hash-Kette beschädigt'}
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
              className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium hover:bg-[#2563EB] transition-colors text-sm whitespace-nowrap"
            >
              📥 Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
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
                <option value="certificate">Zertifikate</option>
                <option value="connector">Agents</option>
                <option value="discovery">Network Discovery</option>
                <option value="alert">Alerts</option>
                <option value="user">Benutzer</option>
                <option value="scan">Scans</option>
                <option value="integration">Integrationen</option>
              </select>
            </div>
          </div>
        </div>

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
                        </div>
                        {index < filteredEvents.length - 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[#94A3B8] font-mono">Prev:</span>
                            <code className="bg-[#F1F5F9] px-2 py-1 rounded text-[#334155] font-mono break-all">
                              {event.prev_hash.substring(0, 16)}...
                            </code>
                            {event.prev_hash === filteredEvents[index + 1].hash ? (
                              <span className="text-[#10B981]">✓</span>
                            ) : (
                              <span className="text-[#EF4444]">✗</span>
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

