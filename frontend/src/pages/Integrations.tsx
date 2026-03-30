import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { useUserRole } from '../hooks/useUserRole'
import { useAutoDismiss } from '../hooks/useAutoDismiss'
import { supabase } from '../lib/supabase'
import PageInfoBox from '../components/ui/PageInfoBox'
import {
  StatusAlert,
  IntegrationTabs,
  IntegrationPageHeader,
  SmtpConfigForm,
  SlackConfigForm,
  WebhookConfigForm,
  validateWebhookUrl,
  generateWebhookSignature,
  formatWebhookError,
} from '../components/features/integrations'
import { logAuditEvent } from '../utils/auditLogger'
import type { IntegrationTab } from '../components/features/integrations'

interface SMTPConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
  secure: boolean
  use_system_smtp?: boolean
}

interface TestEmailState {
  recipient: string
  subject: string
  body: string
}

interface SlackConfig {
  webhook_url: string
  channel: string
}

interface WebhookConfig {
  url: string
  secret: string
  timeout_seconds?: number
  retry_count?: number
  validate_ssl?: boolean
}

export default function Integrations() {
  const { user } = useAuth()
  const { tenantId } = useTenantId()
  const { isAdminOrOwner, loading: roleLoading } = useUserRole()
  const [activeTab, setActiveTab] = useState<IntegrationTab>('smtp')

  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: '', port: 587, user: '', password: '', from: '', secure: true, use_system_smtp: false
  })

  const [testEmail, setTestEmail] = useState<TestEmailState>({
    recipient: '',
    subject: '🛡️ Test von Zertifikat-Wächter',
    body: 'Dies ist eine Test-E-Mail um zu prüfen ob deine SMTP-Konfiguration funktioniert.'
  })

  const [slackConfig, setSlackConfig] = useState<SlackConfig>({ webhook_url: '', channel: '#alerts' })

  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: '', secret: '', timeout_seconds: 5, retry_count: 3, validate_ssl: true
  })

  const [saving, setSaving] = useState(false)
  const { message: success, show: showSuccess, clear: clearSuccess } = useAutoDismiss()
  const { message: error, show: showError, clear: clearError } = useAutoDismiss()

  useEffect(() => {
    if (user?.email) {
      setTestEmail(prev => ({ ...prev, recipient: user.email || '' }))
    }
  }, [user])

  useEffect(() => {
    if (tenantId) {
      loadIntegrations()
    }
  }, [tenantId])

  async function loadIntegrations() {
    if (!tenantId) return
    try {
      const { data: integrations } = await (supabase as any)
        .from('integrations')
        .select('*')
        .eq('tenant_id', tenantId)

      if (integrations) {
        integrations.forEach((integration: any) => {
          if (integration.type === 'smtp' && integration.config) {
            setSmtpConfig({
              ...integration.config as SMTPConfig,
              use_system_smtp: integration.use_system_smtp || false
            })
          } else if (integration.type === 'slack' && integration.config) {
            setSlackConfig(integration.config as SlackConfig)
          } else if (integration.type === 'webhook' && integration.config) {
            const config = integration.config as any
            setWebhookConfig({
              url: config.url || '', secret: config.secret || '',
              timeout_seconds: config.timeout_seconds || 5,
              retry_count: config.retry_count || 3,
              validate_ssl: config.validate_ssl !== undefined ? config.validate_ssl : true
            })
          }
        })
      }
    } catch (err) {
      console.error('Failed to load integrations:', err)
    }
  }

  async function upsertIntegration(type: string, name: string, config: any, extra?: Record<string, any>) {
    const { error: upsertError } = await (supabase as any)
      .from('integrations')
      .upsert({ tenant_id: tenantId, type, name, config, enabled: true, ...extra } as any, {
        onConflict: 'tenant_id,type,name'
      })
    if (upsertError) throw upsertError
  }

  async function saveIntegration(
    type: string,
    name: string,
    config: Record<string, any>,
    auditEventType: Parameters<typeof logAuditEvent>[2],
    auditPayload: Record<string, any>,
    successMessage: string,
    extra?: Record<string, any>,
  ) {
    setSaving(true); clearError(); clearSuccess()
    try {
      await upsertIntegration(type, name, config, extra)
      await logAuditEvent(tenantId, user?.id ?? '', auditEventType, auditPayload)
      showSuccess(successMessage, 3000)
    } catch (err: any) {
      showError(err.message || 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  function saveSMTP() {
    const mode = smtpConfig.use_system_smtp ? 'System-SMTP' : 'Eigener SMTP'
    return saveIntegration(
      'smtp', 'SMTP Server', smtpConfig,
      'integration.smtp.updated',
      { mode, host: smtpConfig.host, port: smtpConfig.port, from: smtpConfig.from, use_system_smtp: smtpConfig.use_system_smtp || false },
      `✅ SMTP-Einstellungen erfolgreich gespeichert (${mode})!`,
      { use_system_smtp: smtpConfig.use_system_smtp || false },
    )
  }

  function saveSlack() {
    return saveIntegration(
      'slack', 'Slack Workspace', slackConfig,
      'integration.slack.updated',
      { channel: slackConfig.channel, webhook_url_set: !!slackConfig.webhook_url },
      '✅ Slack-Einstellungen erfolgreich gespeichert!',
    )
  }

  function saveWebhook() {
    return saveIntegration(
      'webhook', 'Custom Webhook', webhookConfig,
      'integration.webhook.updated',
      { url: webhookConfig.url, has_secret: !!webhookConfig.secret, timeout_seconds: webhookConfig.timeout_seconds, retry_count: webhookConfig.retry_count, validate_ssl: webhookConfig.validate_ssl },
      '✅ Webhook-Einstellungen erfolgreich gespeichert!',
    )
  }

  async function testSMTPConnection() {
    clearError(); setSaving(true)
    try {
      if (!smtpConfig.use_system_smtp) {
        if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password || !smtpConfig.from) {
          throw new Error('Bitte fülle alle SMTP-Felder aus')
        }
      }
      if (!testEmail.recipient) throw new Error('Bitte gib eine Test-E-Mail-Adresse ein')

      const mode = smtpConfig.use_system_smtp ? 'System-SMTP' : 'Eigener SMTP'
      showSuccess(`📧 Sende Test-E-Mail an ${testEmail.recipient} via ${mode}...`)

      const apiUrl = (import.meta as any).env.VITE_WORKER_API_URL || '/api'
      const workerResponse = await fetch(`${apiUrl}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_config: smtpConfig, use_system_smtp: smtpConfig.use_system_smtp || false,
          to: testEmail.recipient, subject: testEmail.subject, body: testEmail.body
        })
      })

      const result = await workerResponse.json()
      if (!workerResponse.ok || !result.success) throw new Error(result.error || 'E-Mail-Versand fehlgeschlagen')

      await upsertIntegration('smtp', 'SMTP Server', smtpConfig, { use_system_smtp: smtpConfig.use_system_smtp || false })
      showSuccess(`✅ Test-E-Mail erfolgreich an ${testEmail.recipient} gesendet (${mode})!\n\nPrüfe dein Postfach.`, 5000)
    } catch (err: any) {
      showError(err.message || 'SMTP-Test fehlgeschlagen', 5000)
    } finally { setSaving(false) }
  }

  async function testSlackConnection() {
    clearError(); setSaving(true)
    try {
      if (!slackConfig.webhook_url) throw new Error('Bitte gib eine Webhook URL ein')
      showSuccess('💬 Sende Test-Nachricht an Slack...')

      const response = await fetch(slackConfig.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🛡️ Test-Nachricht von Zertifikat-Wächter',
          blocks: [{
            type: 'section',
            text: { type: 'mrkdwn', text: '*Test-Benachrichtigung*\n✅ Slack Integration funktioniert!' }
          }]
        })
      })
      if (!response.ok) throw new Error('Slack Webhook ungültig')

      await saveSlack()
      showSuccess(`✅ Test-Nachricht erfolgreich an Slack (${slackConfig.channel}) gesendet!`, 5000)
    } catch (err: any) {
      showError(err.message || 'Slack-Test fehlgeschlagen', 5000)
    } finally { setSaving(false) }
  }

  async function testWebhookConnection() {
    clearError(); setSaving(true)
    try {
      if (!webhookConfig.url) throw new Error('Bitte gib eine Webhook URL ein')
      validateWebhookUrl(webhookConfig.url)
      showSuccess('🔗 Validiere Webhook und sende Test-Payload...')

      const testPayload = {
        event: 'connection.test', tenant_id: tenantId, certificate: null,
        message: '✅ Webhook-Integration erfolgreich konfiguriert!',
        timestamp: new Date().toISOString(), test: true
      }
      const payloadString = JSON.stringify(testPayload)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Zertifikat-Waechter/1.0',
        'X-Webhook-Event': 'connection.test'
      }

      if (webhookConfig.secret) {
        const signature = await generateWebhookSignature(payloadString, webhookConfig.secret)
        headers['X-Webhook-Signature'] = `sha256=${signature}`
        headers['X-Webhook-Signature-Timestamp'] = new Date().toISOString()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (webhookConfig.timeout_seconds || 5) * 1000)

      try {
        const response = await fetch(webhookConfig.url, {
          method: 'POST', headers, body: payloadString, signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Keine Details verfügbar')
          throw new Error(`Webhook antwortete mit Status ${response.status}: ${errorText}`)
        }

        await saveWebhook()
        showSuccess(`✅ Webhook erfolgreich getestet!\n\n• Status: ${response.status}\n• Signatur: ${webhookConfig.secret ? 'HMAC-SHA256 ✅' : 'Keine'}\n• Timeout: ${webhookConfig.timeout_seconds}s`, 7000)
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          throw new Error(`Webhook Timeout nach ${webhookConfig.timeout_seconds} Sekunden`)
        }
        throw fetchErr
      }
    } catch (err: any) {
      console.error('❌ Webhook test failed:', { url: webhookConfig.url, error: err.message })
      const errorMessage = formatWebhookError(err.message, webhookConfig.url, webhookConfig.timeout_seconds)
      showError(`❌ Webhook-Test fehlgeschlagen:\n\n${errorMessage}`, 10000)
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <IntegrationPageHeader />

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <PageInfoBox title="Integrationen und Benachrichtigungskanaele konfigurieren" variant="info" collapsible defaultOpen={false}>
              <div className="space-y-3">
                <p className="text-[#1E3A5F]">
                  Verbinden Sie Zertifikat-Waechter mit Ihren bestehenden Kommunikationskanaelen. Bei Zertifikat-Ablauf oder Sicherheitsproblemen werden automatisch Benachrichtigungen ueber die konfigurierten Kanaele versendet.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <h4 className="font-semibold text-[#1E40AF] mb-1">Unterstuetzte Kanaele</h4>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>SMTP E-Mail: Eigener oder System-SMTP-Server fuer E-Mail-Alerts</li>
                      <li>Slack: Webhook-basierte Nachrichten an beliebige Slack-Channels</li>
                      <li>Microsoft Teams: Incoming-Webhook-Integration (in Kuerze)</li>
                      <li>Custom Webhooks: HMAC-signierte HTTP-POST-Requests an beliebige Endpunkte</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1E40AF] mb-1">Einrichtung und Test</h4>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Jede Integration kann individuell konfiguriert und getestet werden</li>
                      <li>Test-Nachrichten pruefen die Verbindung vor dem Speichern</li>
                      <li>Webhook-Signaturen sichern die Authentizitaet der Nachrichten</li>
                      <li>Nur Administratoren und Besitzer koennen Integrationen aendern</li>
                    </ul>
                  </div>
                </div>
              </div>
            </PageInfoBox>
          </div>

          {/* Permission warning for non-admin users */}
          {!roleLoading && !isAdminOrOwner && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-yellow-600 text-xl">⚠</span>
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-1">Nur Lesezugriff</h3>
                  <p className="text-sm text-yellow-800">
                    Nur Administratoren und Besitzer können Integrationseinstellungen speichern oder testen.
                  </p>
                </div>
              </div>
            </div>
          )}

          <StatusAlert success={success} error={error} />
          <IntegrationTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'smtp' && (
            <SmtpConfigForm
              smtpConfig={smtpConfig} onSmtpConfigChange={setSmtpConfig}
              testEmail={testEmail} onTestEmailChange={setTestEmail}
              userEmail={user?.email} saving={saving || !isAdminOrOwner}
              onSave={saveSMTP} onTest={testSMTPConnection}
            />
          )}

          {activeTab === 'slack' && (
            <SlackConfigForm
              slackConfig={slackConfig} onSlackConfigChange={setSlackConfig}
              saving={saving || !isAdminOrOwner} onSave={saveSlack} onTest={testSlackConnection}
            />
          )}

          {activeTab === 'webhook' && (
            <WebhookConfigForm
              webhookConfig={webhookConfig} onWebhookConfigChange={setWebhookConfig}
              saving={saving || !isAdminOrOwner} onSave={saveWebhook} onTest={testWebhookConnection}
            />
          )}
        </div>
      </main>
    </div>
  )
}
