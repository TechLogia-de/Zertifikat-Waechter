import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface WebhookDelivery {
  id: string
  event_type: string
  status: 'pending' | 'success' | 'failed' | 'retrying'
  attempts: number
  max_attempts: number
  status_code?: number
  error_message?: string
  created_at: string
  delivered_at?: string
  next_retry_at?: string
  payload: any
}

interface WebhookStats {
  date: string
  total_deliveries: number
  successful: number
  failed: number
  retrying: number
  pending: number
  success_rate: number
}

export default function WebhookLogs() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string>('')
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [stats, setStats] = useState<WebhookStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending' | 'retrying'>('all')

  useEffect(() => {
    loadData()
    
    // Auto-refresh alle 30 Sekunden
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [user, filter])

  async function loadData() {
    if (!user) return

    try {
      // Hole Tenant ID
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) return
      const tid = (membership as any).tenant_id
      setTenantId(tid)

      // Hole Webhook Deliveries
      let query = (supabase as any)
        .from('webhook_deliveries')
        .select('*')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data: deliveriesData } = await query
      setDeliveries(deliveriesData || [])

      // Hole Stats
      const { data: statsData } = await (supabase as any)
        .from('webhook_delivery_stats')
        .select('*')
        .eq('tenant_id', tid)
        .order('date', { ascending: false })
        .limit(7)

      setStats(statsData || [])

    } catch (err) {
      console.error('Failed to load webhook logs:', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      success: 'bg-[#D1FAE5] text-[#065F46] border-[#10B981]',
      failed: 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]',
      pending: 'bg-[#DBEAFE] text-[#1E40AF] border-[#3B82F6]',
      retrying: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
    }

    const icons = {
      success: '✅',
      failed: '❌',
      pending: '⏳',
      retrying: '🔄'
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {icons[status as keyof typeof icons]} {status.toUpperCase()}
      </span>
    )
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B82F6]"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-8 py-6">
        <h1 className="text-3xl font-bold text-[#0F172A]">Webhook Logs</h1>
        <p className="text-[#64748B] mt-1">
          Monitoring & Delivery Status aller Webhook-Benachrichtigungen
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Stats Cards */}
        {stats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="text-sm font-semibold text-[#64748B] mb-2">Gesamt (Heute)</div>
              <div className="text-3xl font-bold text-[#0F172A]">{stats[0]?.total_deliveries || 0}</div>
            </div>
            
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="text-sm font-semibold text-[#64748B] mb-2">Erfolgreich</div>
              <div className="text-3xl font-bold text-[#10B981]">{stats[0]?.successful || 0}</div>
              <div className="text-xs text-[#64748B] mt-1">{stats[0]?.success_rate || 0}% Success Rate</div>
            </div>
            
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="text-sm font-semibold text-[#64748B] mb-2">Fehlgeschlagen</div>
              <div className="text-3xl font-bold text-[#EF4444]">{stats[0]?.failed || 0}</div>
            </div>
            
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="text-sm font-semibold text-[#64748B] mb-2">Wird wiederholt</div>
              <div className="text-3xl font-bold text-[#F59E0B]">{stats[0]?.retrying || 0}</div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6">
          {(['all', 'success', 'failed', 'pending', 'retrying'] as const).map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === filterOption
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
              }`}
            >
              {filterOption === 'all' ? 'Alle' : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>

        {/* Deliveries Table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Versuche
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Erstellt
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Zugestellt
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#64748B]">
                      Keine Webhook-Deliveries gefunden
                    </td>
                  </tr>
                ) : (
                  deliveries.map(delivery => (
                    <tr key={delivery.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-6 py-4">
                        {getStatusBadge(delivery.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0F172A]">{delivery.event_type}</div>
                        {delivery.payload?.certificate?.subject_cn && (
                          <div className="text-xs text-[#64748B] mt-1">
                            {delivery.payload.certificate.subject_cn}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#0F172A]">
                        {delivery.attempts} / {delivery.max_attempts}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748B]">
                        {formatDate(delivery.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748B]">
                        {delivery.delivered_at ? formatDate(delivery.delivered_at) : '-'}
                        {delivery.next_retry_at && (
                          <div className="text-xs text-[#F59E0B] mt-1">
                            Retry: {formatDate(delivery.next_retry_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {delivery.status === 'success' && delivery.status_code && (
                          <span className="text-sm text-[#10B981]">HTTP {delivery.status_code}</span>
                        )}
                        {delivery.status === 'failed' && (
                          <div className="text-xs text-[#EF4444] max-w-xs truncate" title={delivery.error_message}>
                            {delivery.error_message}
                          </div>
                        )}
                        {delivery.status === 'retrying' && (
                          <div className="text-xs text-[#F59E0B]">Wird wiederholt...</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#DBEAFE] border border-[#3B82F6] rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-xl mr-3">ℹ️</span>
            <div className="text-sm text-[#1E40AF]">
              <p className="font-semibold mb-2">Automatische Verarbeitung:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Webhook-Queue wird jede Minute verarbeitet</li>
                <li>Fehlgeschlagene Webhooks werden automatisch wiederholt (Exponential Backoff)</li>
                <li>Erfolgreich zugestellte Webhooks werden nach 30 Tagen automatisch gelöscht</li>
                <li>Diese Seite aktualisiert sich automatisch alle 30 Sekunden</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

