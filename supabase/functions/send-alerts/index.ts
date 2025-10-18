import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Alert {
  id: string
  certificate_id: string
  tenant_id: string
  level: string
  first_triggered_at: string
  last_notified_at: string | null
  certificate: any
}

// Berechne Tage bis Ablauf
function getDaysUntilExpiry(notAfter: string): number {
  const expiryDate = new Date(notAfter)
  const now = new Date()
  const diffMs = expiryDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

// Bestimme Severity basierend auf Tagen
function getSeverity(days: number): 'critical' | 'error' | 'warning' | 'info' {
  if (days <= 1) return 'critical'
  if (days <= 7) return 'error'
  if (days <= 14) return 'warning'
  return 'info'
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending alerts (nicht acknowledgiert)
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select(`
        *,
        certificate:certificates(*)
      `)
      .is('acknowledged_at', null)
      .order('first_triggered_at', { ascending: true })

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`)
    }

    console.log(`Found ${alerts?.length || 0} pending alerts`)

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No alerts to process' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Gruppiere Alerts nach Tenant
    const alertsByTenant = new Map<string, Alert[]>()
    for (const alert of alerts) {
      const tenantId = alert.certificate?.tenant_id
      if (!tenantId) continue

      if (!alertsByTenant.has(tenantId)) {
        alertsByTenant.set(tenantId, [])
      }
      alertsByTenant.get(tenantId)!.push(alert as Alert)
    }

    console.log(`Processing alerts for ${alertsByTenant.size} tenants`)

    let totalSent = 0
    let totalFailed = 0

    // Verarbeite jeden Tenant
    for (const [tenantId, tenantAlerts] of alertsByTenant) {
      console.log(`Processing ${tenantAlerts.length} alerts for tenant ${tenantId}`)

      // Hole Integrations für diesen Tenant
      const { data: integrations } = await supabase
        .from('integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)

      if (!integrations || integrations.length === 0) {
        console.log(`No integrations configured for tenant ${tenantId}`)
        continue
      }

      // Prüfe ob Alert in letzten 24h bereits gesendet wurde (Rate Limiting)
      const recentAlerts = tenantAlerts.filter(alert => {
        if (!alert.last_notified_at) return true
        const lastSent = new Date(alert.last_notified_at)
        const hoursSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60)
        return hoursSinceLastSent >= 24 // Nur alle 24h senden
      })

      if (recentAlerts.length === 0) {
        console.log(`All alerts for tenant ${tenantId} were sent recently, skipping`)
        continue
      }

      console.log(`Sending ${recentAlerts.length} alerts for tenant ${tenantId}`)

      // Sende an jede Integration
      for (const integration of integrations) {
        try {
          if (integration.type === 'webhook') {
            // Queue Webhooks für jeden Alert
            for (const alert of recentAlerts) {
              const cert = alert.certificate
              const daysLeft = getDaysUntilExpiry(cert.not_after)

              const webhookPayload = {
                event: 'certificate.expiring',
                certificate: {
                  id: cert.id,
                  subject_cn: cert.subject_cn,
                  issuer: cert.issuer,
                  expires_at: cert.not_after,
                  days_left: daysLeft,
                  fingerprint: cert.fingerprint
                },
                severity: getSeverity(daysLeft),
                alert_level: alert.level,
                alert_id: alert.id,
                first_triggered_at: alert.first_triggered_at,
                timestamp: new Date().toISOString()
              }

              // Queue Webhook Delivery
              const { data: delivery } = await supabase.rpc('queue_webhook_delivery', {
                p_tenant_id: tenantId,
                p_integration_id: integration.id,
                p_event_type: 'certificate.expiring',
                p_payload: webhookPayload,
                p_max_attempts: (integration.config as any)?.retry_count || 3
              })

              console.log(`📨 Webhook queued for alert ${alert.id}, delivery_id: ${delivery}`)
              totalSent++
            }
          } else if (integration.type === 'slack') {
            // Sende Slack-Nachricht (zusammengefasst)
            const config = integration.config as any
            if (!config.webhook_url) continue

            const alertsText = recentAlerts.map(alert => {
              const cert = alert.certificate
              const daysLeft = getDaysUntilExpiry(cert.not_after)
              const emoji = daysLeft <= 1 ? '🔴' : daysLeft <= 7 ? '🟠' : '🟡'
              return `${emoji} *${cert.subject_cn}* läuft in ${daysLeft} Tagen ab`
            }).join('\n')

            const slackPayload = {
              text: `🛡️ Zertifikat-Warnung`,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: '🛡️ Zertifikat-Ablauf-Warnung'
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `${recentAlerts.length} Zertifikat(e) läuft/laufen bald ab:\n\n${alertsText}`
                  }
                }
              ]
            }

            const slackResponse = await fetch(config.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(slackPayload)
            })

            if (slackResponse.ok) {
              console.log(`✅ Slack notification sent for tenant ${tenantId}`)
              totalSent += recentAlerts.length
            } else {
              console.error(`❌ Slack notification failed for tenant ${tenantId}`)
              totalFailed += recentAlerts.length
            }
          }
          // TODO: SMTP-Integration implementieren (ruft Worker API auf)
          // TODO: Teams-Integration implementieren

        } catch (err) {
          console.error(`Failed to send via ${integration.type}:`, err)
          totalFailed++
        }
      }

      // Aktualisiere last_notified_at für alle versendeten Alerts
      for (const alert of recentAlerts) {
        await supabase
          .from('alerts')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', alert.id)
      }
    }

    console.log(`✅ Sent ${totalSent} alerts, ${totalFailed} failed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_alerts: alerts.length,
        sent: totalSent,
        failed: totalFailed
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Send alerts failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})


