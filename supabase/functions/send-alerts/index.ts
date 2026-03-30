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

const ALLOWED_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*'
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
        { headers: corsHeaders }
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

      // Read tenant-specific alert interval from policies table, default to 24 hours
      const { data: policy } = await supabase
        .from('policies')
        .select('alert_interval_hours')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      const alertIntervalHours = policy?.alert_interval_hours ?? 24

      // Rate limit alerts based on tenant-configured interval
      const recentAlerts = tenantAlerts.filter(alert => {
        if (!alert.last_notified_at) return true
        const lastSent = new Date(alert.last_notified_at)
        const hoursSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60)
        return hoursSinceLastSent >= alertIntervalHours
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
              headers: corsHeaders,
              body: JSON.stringify(slackPayload)
            })

            if (slackResponse.ok) {
              console.log(`✅ Slack notification sent for tenant ${tenantId}`)
              totalSent += recentAlerts.length
            } else {
              console.error(`❌ Slack notification failed for tenant ${tenantId}`)
              totalFailed += recentAlerts.length
            }
          } else if (integration.type === 'smtp' || integration.type === 'email') {
            // SMTP-Integration: Sende E-Mail-Benachrichtigungen
            const config = integration.config as any
            const smtpHost = config.host || Deno.env.get('SMTP_HOST')
            const smtpPort = parseInt(config.port || Deno.env.get('SMTP_PORT') || '587', 10)
            if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
              console.log(`Invalid SMTP port ${smtpPort} for tenant ${tenantId}, skipping`)
              continue
            }
            const smtpUser = config.user || Deno.env.get('SMTP_USER')
            const smtpPassword = config.password || Deno.env.get('SMTP_PASSWORD')
            const smtpFrom = config.from || Deno.env.get('SMTP_FROM')
            const recipientEmail = config.recipient_email || config.to

            if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom || !recipientEmail) {
              console.log(`SMTP not fully configured for tenant ${tenantId}, skipping`)
              continue
            }

            // Build alert summary email
            const alertRows = recentAlerts.map(alert => {
              const cert = alert.certificate
              const daysLeft = getDaysUntilExpiry(cert.not_after)
              const severity = getSeverity(daysLeft)
              const color = severity === 'critical' ? '#EF4444' : severity === 'error' ? '#F97316' : severity === 'warning' ? '#F59E0B' : '#3B82F6'
              return `<tr>
                <td style="padding:8px;border-bottom:1px solid #E2E8F0"><strong>${cert.subject_cn}</strong></td>
                <td style="padding:8px;border-bottom:1px solid #E2E8F0">${cert.issuer || 'N/A'}</td>
                <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:${color};font-weight:bold">${daysLeft} Tage</td>
              </tr>`
            }).join('')

            const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#F8FAFC;font-family:Arial,sans-serif">
              <div style="max-width:600px;margin:0 auto">
                <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);padding:24px;text-align:center;border-radius:12px 12px 0 0">
                  <h1 style="color:white;margin:0">🛡️ Zertifikat-Wächter</h1>
                  <p style="color:rgba(255,255,255,0.9);margin:8px 0 0">Zertifikats-Ablauf-Warnung</p>
                </div>
                <div style="background:white;padding:24px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">
                  <p style="color:#334155">${recentAlerts.length} Zertifikat(e) benötigen Aufmerksamkeit:</p>
                  <table style="width:100%;border-collapse:collapse;margin-top:16px">
                    <thead><tr style="background:#F8FAFC">
                      <th style="padding:8px;text-align:left;font-size:12px;color:#64748B">Domain</th>
                      <th style="padding:8px;text-align:left;font-size:12px;color:#64748B">Aussteller</th>
                      <th style="padding:8px;text-align:left;font-size:12px;color:#64748B">Verbleibend</th>
                    </tr></thead>
                    <tbody>${alertRows}</tbody>
                  </table>
                  <p style="margin-top:20px;font-size:12px;color:#94A3B8">Diese E-Mail wurde automatisch von Zertifikat-Wächter generiert.</p>
                </div>
              </div>
            </body></html>`

            let smtpConn: Deno.Conn | null = null
            try {
              // Use Deno's native TCP for SMTP
              smtpConn = smtpPort === 465
                ? await Deno.connectTls({ hostname: smtpHost, port: smtpPort })
                : await Deno.connect({ hostname: smtpHost, port: smtpPort })

              const conn = smtpConn
              const encoder = new TextEncoder()
              const decoder = new TextDecoder()

              const readResponse = async () => {
                const buf = new Uint8Array(1024)
                const n = await conn.read(buf)
                return n ? decoder.decode(buf.subarray(0, n)) : ''
              }

              const sendCommand = async (cmd: string) => {
                await conn.write(encoder.encode(cmd + '\r\n'))
                return await readResponse()
              }

              await readResponse() // greeting
              await sendCommand(`EHLO zertifikat-waechter`)

              if (smtpPort !== 465) {
                await sendCommand('STARTTLS')
                const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtpHost })
                smtpConn = tlsConn
                await sendCommand(`EHLO zertifikat-waechter`)
              }

              // AUTH LOGIN
              await sendCommand('AUTH LOGIN')
              await sendCommand(btoa(smtpUser))
              await sendCommand(btoa(smtpPassword))

              await sendCommand(`MAIL FROM:<${smtpFrom}>`)
              await sendCommand(`RCPT TO:<${recipientEmail}>`)
              await sendCommand('DATA')

              const emailData = [
                `From: ${smtpFrom}`,
                `To: ${recipientEmail}`,
                `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(`🛡️ ${recentAlerts.length} Zertifikat-Warnung(en)`)))}?=`,
                `MIME-Version: 1.0`,
                `Content-Type: text/html; charset=UTF-8`,
                ``,
                emailHtml,
                `.`
              ].join('\r\n')

              await sendCommand(emailData)
              await sendCommand('QUIT')

              console.log(`✅ SMTP email sent for tenant ${tenantId}`)
              totalSent += recentAlerts.length
            } catch (smtpErr) {
              console.error(`❌ SMTP failed for tenant ${tenantId}:`, smtpErr)
              totalFailed += recentAlerts.length
            } finally {
              try { smtpConn?.close() } catch { /* ignore */ }
            }
          } else if (integration.type === 'teams') {
            // Microsoft Teams Webhook Integration
            const config = integration.config as any
            if (!config.webhook_url) continue

            const alertFacts = recentAlerts.map(alert => {
              const cert = alert.certificate
              const daysLeft = getDaysUntilExpiry(cert.not_after)
              const emoji = daysLeft <= 1 ? '🔴' : daysLeft <= 7 ? '🟠' : '🟡'
              return {
                name: `${emoji} ${cert.subject_cn}`,
                value: `Läuft ab in ${daysLeft} Tagen (${new Date(cert.not_after).toLocaleDateString('de-DE')})`
              }
            })

            // Adaptive Card payload for Teams
            const teamsPayload = {
              type: 'message',
              attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                  '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                  type: 'AdaptiveCard',
                  version: '1.4',
                  body: [
                    {
                      type: 'TextBlock',
                      size: 'Large',
                      weight: 'Bolder',
                      text: '🛡️ Zertifikat-Ablauf-Warnung'
                    },
                    {
                      type: 'TextBlock',
                      text: `${recentAlerts.length} Zertifikat(e) benötigen Aufmerksamkeit:`,
                      wrap: true
                    },
                    {
                      type: 'FactSet',
                      facts: alertFacts
                    },
                    {
                      type: 'TextBlock',
                      text: 'Automatisch generiert von Zertifikat-Wächter',
                      size: 'Small',
                      isSubtle: true
                    }
                  ]
                }
              }]
            }

            const teamsResponse = await fetch(config.webhook_url, {
              method: 'POST',
              headers: corsHeaders,
              body: JSON.stringify(teamsPayload)
            })

            if (teamsResponse.ok) {
              console.log(`✅ Teams notification sent for tenant ${tenantId}`)
              totalSent += recentAlerts.length
            } else {
              console.error(`❌ Teams notification failed for tenant ${tenantId}: ${teamsResponse.status}`)
              totalFailed += recentAlerts.length
            }
          }

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
      { headers: corsHeaders }
    )

  } catch (error: any) {
    console.error('Send alerts failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
})


