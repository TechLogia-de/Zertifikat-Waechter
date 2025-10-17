import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingState from '../ui/LoadingState'

interface Check {
  id: string
  certificate_id: string
  ran_at: string
  status: 'success' | 'warning' | 'error' | 'expired'
  details: Record<string, any> | null
  created_at: string
}

interface CertificateHistoryProps {
  certificateId: string
}

export default function CertificateHistory({ certificateId }: CertificateHistoryProps) {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [certificateId])

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('checks')
        .select('*')
        .eq('certificate_id', certificateId)
        .order('ran_at', { ascending: false })
        .limit(50)

      setChecks((data as Check[]) || [])
    } catch (error) {
      console.error('Failed to load certificate history:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status: Check['status']): string {
    switch (status) {
      case 'success':
        return '#10B981'
      case 'warning':
        return '#F59E0B'
      case 'error':
        return '#EF4444'
      case 'expired':
        return '#991B1B'
      default:
        return '#64748B'
    }
  }

  function getStatusIcon(status: Check['status']): string {
    switch (status) {
      case 'success':
        return '✓'
      case 'warning':
        return '⚠'
      case 'error':
        return '✗'
      case 'expired':
        return '⏱'
      default:
        return '•'
    }
  }

  function getStatusLabel(status: Check['status']): string {
    switch (status) {
      case 'success':
        return 'Erfolgreich'
      case 'warning':
        return 'Warnung'
      case 'error':
        return 'Fehler'
      case 'expired':
        return 'Abgelaufen'
      default:
        return 'Unbekannt'
    }
  }

  if (loading) {
    return <LoadingState size="sm" text="Lade Historie..." />
  }

  if (checks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[#64748B]">Keine Scan-Historie verfügbar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Timeline */}
      <div className="relative">
        {checks.map((check, index) => (
          <div key={check.id} className="relative pb-8 last:pb-0">
            {/* Timeline Line */}
            {index < checks.length - 1 && (
              <div 
                className="absolute left-4 top-8 bottom-0 w-0.5 bg-[#E2E8F0]"
                style={{ height: 'calc(100% - 2rem)' }}
              />
            )}

            {/* Check Item */}
            <div className="relative flex items-start space-x-4">
              {/* Status Badge */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold z-10"
                style={{ backgroundColor: getStatusColor(check.status) }}
              >
                {getStatusIcon(check.status)}
              </div>

              {/* Content */}
              <div className="flex-1 bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className="px-2 py-1 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: getStatusColor(check.status) }}
                    >
                      {getStatusLabel(check.status)}
                    </span>
                    <span className="text-xs text-[#94A3B8]">
                      {new Date(check.ran_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                </div>

                {/* Details */}
                {check.details && Object.keys(check.details).length > 0 && (
                  <div className="mt-3 bg-white rounded p-3 border border-[#E2E8F0]">
                    <p className="text-xs font-semibold text-[#64748B] mb-2">Details:</p>
                    <div className="space-y-1">
                      {Object.entries(check.details).map(([key, value]) => (
                        <div key={key} className="flex items-start text-xs">
                          <span className="text-[#94A3B8] min-w-[100px]">{key}:</span>
                          <span className="text-[#0F172A] font-mono break-all">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 mt-4">
        <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Statistiken</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#10B981]">
              {checks.filter(c => c.status === 'success').length}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Erfolge</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#F59E0B]">
              {checks.filter(c => c.status === 'warning').length}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Warnungen</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#EF4444]">
              {checks.filter(c => c.status === 'error').length}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Fehler</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#3B82F6]">
              {checks.length}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Gesamt</div>
          </div>
        </div>
      </div>

      {/* Last Check */}
      {checks.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <span className="font-semibold">Letzter Check:</span>{' '}
          {new Date(checks[0].ran_at).toLocaleString('de-DE')} ({getStatusLabel(checks[0].status)})
        </div>
      )}
    </div>
  )
}

