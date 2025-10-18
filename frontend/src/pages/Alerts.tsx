import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import NotificationRules from './NotificationRules'

interface Alert {
  id: string
  level: 'info' | 'warning' | 'critical'
  message: string
  first_triggered_at: string
  acknowledged_at: string | null
  certificates: {
    subject_cn: string
    not_after: string
    assets: {
      host: string
      port: number
    }
  }
}

export default function Alerts() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts')

  useEffect(() => {
    loadAlerts()
  }, [user])

  async function loadAlerts() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        const { data: alertsData, error } = await supabase
          .from('alerts')
          .select(`
            *,
            certificates(
              subject_cn,
              not_after,
              assets(host, port)
            )
          `)
          .eq('tenant_id', membership.tenant_id)
          .order('first_triggered_at', { ascending: false })

        if (error) throw error

        setAlerts(alertsData as any[] || [])
      }
    } catch (error) {
      console.error('Failed to load alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function acknowledgeAlert(alertId: string) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id
        })
        .eq('id', alertId)

      if (error) throw error

      loadAlerts()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  function getLevelBadge(level: string) {
    const styles = {
      info: { bg: '#DBEAFE', text: '#1E40AF', label: 'Info' },
      warning: { bg: '#FEF3C7', text: '#92400E', label: 'Warnung' },
      critical: { bg: '#FEE2E2', text: '#991B1B', label: 'Kritisch' }
    }
    return styles[level as keyof typeof styles] || styles.info
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">Alerts & Regeln</h1>
            <p className="text-sm md:text-base text-[#64748B] mt-1">
              Ablauf-Warnungen • Multi-Channel-Benachrichtigungen (Email, Slack, Webhook) • Quittierung
            </p>
            
            {/* Tabs */}
            <div className="flex gap-4 mt-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`pb-2 px-1 font-medium text-sm transition-colors ${
                  activeTab === 'alerts'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🔔 Aktive Alerts
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`pb-2 px-1 font-medium text-sm transition-colors ${
                  activeTab === 'rules'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📢 Benachrichtigungsregeln
              </button>
            </div>
          </div>
          <Link 
            to="/settings"
            className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg font-medium hover:bg-[#E2E8F0] active:scale-95 transition-all"
          >
            ⚙️ Alert-Einstellungen
          </Link>
        </div>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        {activeTab === 'rules' ? (
          <NotificationRules />
        ) : loading ? (
          <div className="py-12">
            <LoadingState size="md" text="Lade Alerts..." />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] mb-2">🎉 Alles sieht gut aus!</h3>
              <p className="text-[#64748B] mb-6">
                Alle Zertifikate sind gültig. Alerts werden automatisch erstellt, wenn Zertifikate bald ablaufen.
              </p>
              <Link 
                to="/certificates"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] active:scale-95 transition-all shadow-md"
              >
                <span>Zu den Zertifikaten</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const badge = getLevelBadge(alert.level)
              const cert = alert.certificates as any
              const asset = cert?.assets
              
              return (
                <div 
                  key={alert.id}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span 
                          className="px-3 py-1 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {badge.label.toUpperCase()}
                        </span>
                        {alert.acknowledged_at ? (
                          <span className="text-xs text-[#10B981] flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Bestätigt
                          </span>
                        ) : (
                          <span className="text-xs text-[#F59E0B] flex items-center">
                            <span className="w-2 h-2 bg-[#F59E0B] rounded-full mr-2 animate-pulse"></span>
                            Aktiv
                          </span>
                        )}
                      </div>

                      <p className="text-lg font-semibold text-[#0F172A] mb-2">{alert.message}</p>
                      
                      {cert && asset && (
                        <div className="flex items-center space-x-4 text-sm text-[#64748B]">
                          <span>🔒 {cert.subject_cn}</span>
                          <span>•</span>
                          <span>🌐 {asset.host}:{asset.port}</span>
                          <span>•</span>
                          <span>📅 {new Date(cert.not_after).toLocaleDateString('de-DE')}</span>
                        </div>
                      )}

                      <p className="text-xs text-[#94A3B8] mt-2">
                        Erstellt: {new Date(alert.first_triggered_at).toLocaleString('de-DE')}
                      </p>
                    </div>

                    {!alert.acknowledged_at && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="ml-4 px-4 py-2 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-[#059669] transition-colors"
                      >
                        ✓ Bestätigen
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}


