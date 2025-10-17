import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingState from '../ui/LoadingState'

interface Event {
  id: string
  type: string
  payload: Record<string, any>
  ts: string
}

interface ActivityTimelineProps {
  tenantId: string
  limit?: number
}

export default function ActivityTimeline({ tenantId, limit = 10 }: ActivityTimelineProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    loadActivity()

    // Realtime subscription für agent_logs und certificates
    const channel = supabase
      .channel(`activity_timeline_${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadActivity()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'certificates',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadActivity()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime subscription failed, but app works without it')
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [tenantId])

  async function loadActivity() {
    try {
      // Nutze agent_logs für Activity (bis Events-System implementiert ist)
      const { data: agentLogs } = await supabase
        .from('agent_logs')
        .select('id, connector_name, level, message, metadata, timestamp')
        .eq('tenant_id', tenantId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      // Konvertiere agent_logs zu Events-Format
      const convertedEvents: Event[] = (agentLogs || []).map((log: any) => ({
        id: log.id,
        type: `agent.${log.level}`,
        payload: {
          connector: log.connector_name,
          message: log.message,
          ...log.metadata
        },
        ts: log.timestamp
      }))

      // Zusätzlich: Hole letzte Zertifikat-Erstellungen
      const { data: recentCerts } = await supabase
        .from('certificates')
        .select('id, subject_cn, created_at, assets(host)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5)

      const certEvents: Event[] = (recentCerts || []).map((cert: any) => ({
        id: `cert-${cert.id}`,
        type: 'certificate.created',
        payload: {
          subject_cn: cert.subject_cn,
          host: cert.assets?.host || 'Unbekannt'
        },
        ts: cert.created_at
      }))

      // Kombiniere und sortiere
      const allEvents = [...convertedEvents, ...certEvents]
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, limit)

      setEvents(allEvents)
    } catch (error) {
      console.error('Failed to load activity:', error)
    } finally {
      setLoading(false)
    }
  }

  function getActivityIcon(type: string): string {
    if (type.startsWith('certificate.')) return '🔐'
    if (type.startsWith('agent.')) return '🤖'
    if (type.startsWith('alert.')) return '🔔'
    if (type.startsWith('user.')) return '👤'
    if (type.startsWith('scan.')) return '🔍'
    if (type.startsWith('integration.')) return '🔗'
    return '📝'
  }

  function getActivityColor(type: string): string {
    if (type.includes('error')) return '#EF4444'
    if (type.includes('warning')) return '#F59E0B'
    if (type.includes('created') || type.includes('info')) return '#10B981'
    return '#3B82F6'
  }

  function formatActivityMessage(event: Event): string {
    const { type, payload } = event

    // Agent Logs (von agent_logs Tabelle)
    if (type.startsWith('agent.')) {
      const connector = payload.connector ? `[${payload.connector}]` : ''
      return `${connector} ${payload.message || type}`
    }

    // Certificate Events
    switch (type) {
      case 'certificate.created':
        return `Zertifikat ${payload.subject_cn} für ${payload.host} gefunden`
      case 'certificate.expiring':
        return `Zertifikat läuft bald ab: ${payload.subject_cn || 'Unbekannt'}`
      case 'certificate.expired':
        return `Zertifikat abgelaufen: ${payload.subject_cn || 'Unbekannt'}`
      case 'certificate.renewed':
        return `Zertifikat erneuert: ${payload.subject_cn || 'Unbekannt'}`
      case 'alert.created':
        return `Neuer Alert erstellt: ${payload.level || 'Info'}`
      case 'alert.acknowledged':
        return `Alert quittiert für ${payload.subject_cn || 'Zertifikat'}`
      case 'scan.started':
        return `Scan gestartet für ${payload.host || 'Host'}`
      case 'scan.completed':
        return `Scan abgeschlossen: ${payload.count || 0} Zertifikate gefunden`
      case 'scan.failed':
        return `Scan fehlgeschlagen für ${payload.host || 'Host'}`
      default:
        return payload.message || type.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  function getRelativeTime(timestamp: string): string {
    const now = new Date()
    const time = new Date(timestamp) // UTC wird automatisch zu lokaler Zeit konvertiert
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)

    if (diffInSeconds < 30) return 'Gerade eben'
    if (diffInSeconds < 60) return `vor ${diffInSeconds} Sek`
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Min`
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Std`
    if (diffInSeconds < 604800) return `vor ${Math.floor(diffInSeconds / 86400)} Tag${Math.floor(diffInSeconds / 86400) !== 1 ? 'en' : ''}`
    
    // Älter als 7 Tage → zeige Datum
    return time.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return <LoadingState size="sm" text="Lade Aktivitäten..." />
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[#64748B]">Keine Aktivitäten vorhanden</p>
        <p className="text-xs text-[#94A3B8] mt-1">Aktivitäten werden hier angezeigt</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div
          key={event.id}
          className="flex items-start space-x-3 pb-3 border-b border-[#F1F5F9] last:border-0 last:pb-0 hover:bg-[#F8FAFC] p-2 rounded-lg transition-colors"
        >
          {/* Icon */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${getActivityColor(event.type)}15` }}
          >
            <span className="text-base">{getActivityIcon(event.type)}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">
              {formatActivityMessage(event)}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              {getRelativeTime(event.ts)}
            </p>
          </div>

          {/* Status Indicator */}
          <div
            className="flex-shrink-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: getActivityColor(event.type) }}
          />
        </div>
      ))}

      {events.length >= limit && (
        <div className="text-center pt-3">
          <Link
            to="/audit-log"
            className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium inline-block"
          >
            Alle Aktivitäten anzeigen →
          </Link>
        </div>
      )}
    </div>
  )
}

