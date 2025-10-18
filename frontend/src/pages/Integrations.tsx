import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface SMTPConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
  secure: boolean
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
  const [tenantId, setTenantId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'smtp' | 'slack' | 'webhook'>('smtp')
  
  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    user: '',
    password: '',
    from: '',
    secure: true
  })

  const [testEmail, setTestEmail] = useState<TestEmailState>({
    recipient: '',
    subject: '🛡️ Test von Zertifikat-Wächter',
    body: 'Dies ist eine Test-E-Mail um zu prüfen ob deine SMTP-Konfiguration funktioniert.'
  })

  // Slack State
  const [slackConfig, setSlackConfig] = useState<SlackConfig>({
    webhook_url: '',
    channel: '#alerts'
  })

  // Webhook State
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: '',
    secret: '',
    timeout_seconds: 5,
    retry_count: 3,
    validate_ssl: true
  })

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
    // Setze Standard Test-E-Mail auf User-Email
    if (user?.email) {
      setTestEmail(prev => ({ ...prev, recipient: user.email || '' }))
    }
  }, [user])

  async function loadIntegrations() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        setTenantId((membership as any).tenant_id)

        // Load integrations from DB
        const { data: integrations } = await (supabase as any)
          .from('integrations')
          .select('*')
          .eq('tenant_id', (membership as any).tenant_id)

        if (integrations) {
          integrations.forEach((integration: any) => {
            if (integration.type === 'smtp' && integration.config) {
              setSmtpConfig(integration.config as SMTPConfig)
            } else if (integration.type === 'slack' && integration.config) {
              setSlackConfig(integration.config as SlackConfig)
            } else if (integration.type === 'webhook' && integration.config) {
              const config = integration.config as any
              setWebhookConfig({
                url: config.url || '',
                secret: config.secret || '',
                timeout_seconds: config.timeout_seconds || 5,
                retry_count: config.retry_count || 3,
                validate_ssl: config.validate_ssl !== undefined ? config.validate_ssl : true
              })
            }
          })
        }
      }
    } catch (err) {
      console.error('Failed to load integrations:', err)
    }
  }

  async function saveSMTP() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const integrationData: any = {
        tenant_id: tenantId,
        type: 'smtp',
        name: 'SMTP Server',
        config: smtpConfig as any,
        enabled: true
      }

      const { error: upsertError } = await (supabase as any)
        .from('integrations')
        .upsert(integrationData, {
          onConflict: 'tenant_id,type,name'
        })

      if (upsertError) throw upsertError

      setSuccess('✅ SMTP-Einstellungen erfolgreich gespeichert!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function saveSlack() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const integrationData: any = {
        tenant_id: tenantId,
        type: 'slack',
        name: 'Slack Workspace',
        config: slackConfig as any,
        enabled: true
      }

      const { error: upsertError } = await (supabase as any)
        .from('integrations')
        .upsert(integrationData, {
          onConflict: 'tenant_id,type,name'
        })

      if (upsertError) throw upsertError

      setSuccess('✅ Slack-Einstellungen erfolgreich gespeichert!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function saveWebhook() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const integrationData: any = {
        tenant_id: tenantId,
        type: 'webhook',
        name: 'Custom Webhook',
        config: webhookConfig as any,
        enabled: true
      }

      const { error: upsertError } = await (supabase as any)
        .from('integrations')
        .upsert(integrationData, {
          onConflict: 'tenant_id,type,name'
        })

      if (upsertError) throw upsertError

      setSuccess('✅ Webhook-Einstellungen erfolgreich gespeichert!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function testSMTPConnection() {
    setError(null)
    setSaving(true)

    try {
      // Validierung
      if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password || !smtpConfig.from) {
        throw new Error('Bitte fülle alle SMTP-Felder aus')
      }

      if (!testEmail.recipient) {
        throw new Error('Bitte gib eine Test-E-Mail-Adresse ein')
      }

      setSuccess(`📧 Sende Test-E-Mail an ${testEmail.recipient}...`)

      // Sende über Worker API
      // In Production: /api/ (Nginx Reverse Proxy)
      // In Development: http://localhost:5000
      const apiUrl = (import.meta as any).env.VITE_WORKER_API_URL || '/api'
      
      const workerResponse = await fetch(`${apiUrl}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_config: smtpConfig,
          to: testEmail.recipient,
          subject: testEmail.subject,
          body: testEmail.body
        })
      })

      const result = await workerResponse.json()

      if (!workerResponse.ok || !result.success) {
        throw new Error(result.error || 'E-Mail-Versand fehlgeschlagen')
      }

      // Speichere Config
      await (supabase as any).from('integrations').upsert({
        tenant_id: tenantId,
        type: 'smtp',
        name: 'SMTP Server',
        config: smtpConfig as any,
        enabled: true
      } as any, { onConflict: 'tenant_id,type,name' })

      setSuccess(`✅ Test-E-Mail erfolgreich an ${testEmail.recipient} gesendet!\n\nPrüfe dein Postfach.`)
      setTimeout(() => setSuccess(null), 5000)

    } catch (err: any) {
      setError(err.message || 'SMTP-Test fehlgeschlagen')
      setTimeout(() => setError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function testSlackConnection() {
    setError(null)
    setSaving(true)

    try {
      if (!slackConfig.webhook_url) {
        throw new Error('Bitte gib eine Webhook URL ein')
      }

      setSuccess('💬 Sende Test-Nachricht an Slack...')

      // Sende Test-Nachricht direkt an Slack
      const response = await fetch(slackConfig.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🛡️ Test-Nachricht von Zertifikat-Wächter',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Test-Benachrichtigung*\n✅ Slack Integration funktioniert!'
              }
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error('Slack Webhook ungültig')
      }

      setSuccess(`✅ Test-Nachricht erfolgreich an Slack (${slackConfig.channel}) gesendet!`)
      await saveSlack()
      setTimeout(() => setSuccess(null), 5000)

    } catch (err: any) {
      setError(err.message || 'Slack-Test fehlgeschlagen')
      setTimeout(() => setError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Hilfsfunktion: URL-Validierung (keine privaten IPs erlauben)
  function validateWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      
      // Nur HTTPS erlauben (außer localhost für Dev)
      if (parsed.protocol !== 'https:' && !parsed.hostname.includes('localhost')) {
        throw new Error('Nur HTTPS URLs sind erlaubt (außer localhost)')
      }

      // Blockiere private IP-Ranges
      const hostname = parsed.hostname.toLowerCase()
      const privatePatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^::1$/,
        /^fe80:/,
        /^fc00:/
      ]

      // localhost ist OK für Development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true
      }

      // Blockiere private IPs in Produktion
      if (privatePatterns.some(pattern => pattern.test(hostname))) {
        throw new Error('Private IP-Adressen sind nicht erlaubt')
      }

      return true
    } catch (err: any) {
      throw new Error(`Ungültige URL: ${err.message}`)
    }
  }

  // Hilfsfunktion: HMAC-SHA256 Signatur berechnen
  async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const hashArray = Array.from(new Uint8Array(signature))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex
  }

  async function testWebhookConnection() {
    setError(null)
    setSaving(true)

    try {
      if (!webhookConfig.url) {
        throw new Error('Bitte gib eine Webhook URL ein')
      }

      // URL-Validierung
      validateWebhookUrl(webhookConfig.url)

      setSuccess('🔗 Validiere Webhook und sende Test-Payload...')

      // Sende Test-Payload
      const testPayload = {
        event: 'connection.test',
        tenant_id: tenantId,
        certificate: null,
        message: '✅ Webhook-Integration erfolgreich konfiguriert!',
        timestamp: new Date().toISOString(),
        test: true
      }

      const payloadString = JSON.stringify(testPayload)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Zertifikat-Waechter/1.0',
        'X-Webhook-Event': 'connection.test'
      }

      // HMAC-Signatur hinzufügen wenn Secret vorhanden
      if (webhookConfig.secret) {
        const signature = await generateWebhookSignature(payloadString, webhookConfig.secret)
        headers['X-Webhook-Signature'] = `sha256=${signature}`
        headers['X-Webhook-Signature-Timestamp'] = new Date().toISOString()
      }

      // Sende mit Timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (webhookConfig.timeout_seconds || 5) * 1000)

      try {
        const response = await fetch(webhookConfig.url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Keine Details verfügbar')
          throw new Error(`Webhook antwortete mit Status ${response.status}: ${errorText}`)
        }

        // Webhook erfolgreich
        console.log('✅ Webhook test successful:', {
          url: webhookConfig.url,
          status: response.status,
          has_signature: !!webhookConfig.secret
        })

        setSuccess(`✅ Webhook erfolgreich getestet!\n\n• Status: ${response.status}\n• Signatur: ${webhookConfig.secret ? 'HMAC-SHA256 ✅' : 'Keine'}\n• Timeout: ${webhookConfig.timeout_seconds}s`)
        await saveWebhook()
        setTimeout(() => setSuccess(null), 7000)

      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        
        if (fetchErr.name === 'AbortError') {
          throw new Error(`Webhook Timeout nach ${webhookConfig.timeout_seconds} Sekunden`)
        }
        throw fetchErr
      }

    } catch (err: any) {
      // Log Fehler nur in Console
      console.error('❌ Webhook test failed:', {
        url: webhookConfig.url,
        error: err.message
      })

      let errorMessage = err.message

      // Bessere Fehlermeldungen für häufige Probleme
      if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        const isLocalhost = webhookConfig.url.includes('localhost')
        
        if (isLocalhost) {
          errorMessage = `❌ Lokaler Webhook-Server nicht erreichbar!\n\n` +
            `Bitte starte den Test-Server:\n\n` +
            `1️⃣ Öffne ein Terminal im Projekt-Root\n` +
            `2️⃣ Führe aus: node test-webhook-server.js\n` +
            `3️⃣ Warte bis "Test-Webhook-Server gestartet!" erscheint\n` +
            `4️⃣ Klicke erneut auf "Test senden"\n\n` +
            `Verwendete URL: ${webhookConfig.url}\n` +
            `Erwartete URL: http://localhost:3333/webhook`
        } else {
          errorMessage = `Verbindung zum Webhook fehlgeschlagen.\n\n` +
            `Mögliche Ursachen:\n` +
            `• Webhook-Server läuft nicht oder ist nicht erreichbar\n` +
            `• Firewall blockiert die Verbindung\n` +
            `• CORS-Header fehlen auf dem Server\n` +
            `• URL ist falsch: ${webhookConfig.url}\n\n` +
            `Prüfe ob der Server läuft:\n` +
            `curl -X POST ${webhookConfig.url} -d '{"test": true}'`
        }
      } else if (err.message.includes('Timeout')) {
        errorMessage = `Webhook antwortet nicht (Timeout nach ${webhookConfig.timeout_seconds}s).\n\n` +
          `Mögliche Ursachen:\n` +
          `• Server ist langsam oder nicht erreichbar\n` +
          `• Erhöhe den Timeout in den Einstellungen\n` +
          `• Prüfe Firewall-Regeln`
      }

      setError(`❌ Webhook-Test fehlgeschlagen:\n\n${errorMessage}`)
      setTimeout(() => setError(null), 10000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">Integrationen</h1>
        <p className="text-sm md:text-base text-[#64748B] mt-1">
          Notification Channels • SMTP (TLS/STARTTLS) • Slack Bot API • MS Teams Webhooks • Custom HTTP Endpoints
        </p>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
        {success && (
          <div className="mb-6 bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg">
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-1">Erfolg!</p>
                <p className="text-sm whitespace-pre-line">{success}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
            <div className="flex items-start">
              <span className="text-2xl mr-3">❌</span>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-1">Fehler</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 bg-white rounded-lg p-2 border border-[#E2E8F0]">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'smtp'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            📧 SMTP / E-Mail
          </button>
          <button
            onClick={() => setActiveTab('slack')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'slack'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            💬 Slack
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'webhook'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            🔗 Webhook
          </button>
        </div>

        {/* SMTP Configuration */}
        {activeTab === 'smtp' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-[#DBEAFE] rounded-lg">
                <span className="text-2xl">📧</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">SMTP Server Konfiguration</h2>
                <p className="text-sm text-[#64748B]">Verbinde deinen eigenen E-Mail Server</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                  />
                  <p className="text-xs text-[#64748B] mt-1">Standard: 587 (TLS), 465 (SSL)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Benutzername / E-Mail
                </label>
                <input
                  type="text"
                  value={smtpConfig.user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                  placeholder="alerts@example.com"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Passwort / App-Password
                </label>
                <input
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
                <p className="text-xs text-[#64748B] mt-1">
                  💡 Gmail: Verwende ein App-Passwort (nicht dein normales Passwort)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Absender (From)
                </label>
                <input
                  type="email"
                  value={smtpConfig.from}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                  placeholder="noreply@example.com"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
              </div>

              <div className="flex items-center space-x-3 p-4 bg-[#F8FAFC] rounded-lg">
                <input
                  type="checkbox"
                  id="smtp-secure"
                  checked={smtpConfig.secure}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                  className="w-5 h-5 text-[#3B82F6] border-[#CBD5E1] rounded focus:ring-[#3B82F6]"
                />
                <label htmlFor="smtp-secure" className="text-sm font-medium text-[#0F172A]">
                  SSL/TLS Verschlüsselung verwenden (empfohlen)
                </label>
              </div>

              {/* Test Email Section */}
              <div className="border-t border-[#E2E8F0] pt-4 mt-4">
                <h3 className="text-sm font-bold text-[#0F172A] mb-3">📧 Test-E-Mail senden</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Empfänger
                    </label>
                    <input
                      type="email"
                      value={testEmail.recipient}
                      onChange={(e) => setTestEmail({ ...testEmail, recipient: e.target.value })}
                      placeholder={user?.email || 'test@example.com'}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Betreff
                    </label>
                    <input
                      type="text"
                      value={testEmail.subject}
                      onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Nachricht
                    </label>
                    <textarea
                      value={testEmail.body}
                      onChange={(e) => setTestEmail({ ...testEmail, body: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={saveSMTP}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Speichere...' : '💾 SMTP speichern'}
                </button>
                <button
                  onClick={testSMTPConnection}
                  disabled={saving}
                  className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Teste...' : '📧 Test-Mail senden'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slack Configuration */}
        {activeTab === 'slack' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-[#E0E7FF] rounded-lg">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">Slack Integration</h2>
                <p className="text-sm text-[#64748B]">Erhalte Benachrichtigungen in Slack</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  value={slackConfig.webhook_url}
                  onChange={(e) => setSlackConfig({ ...slackConfig, webhook_url: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
                <p className="text-xs text-[#64748B] mt-2">
                  💡 <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener" className="text-[#3B82F6] hover:underline">
                    Webhook URL erstellen
                  </a> in deinem Slack Workspace
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Channel
                </label>
                <input
                  type="text"
                  value={slackConfig.channel}
                  onChange={(e) => setSlackConfig({ ...slackConfig, channel: e.target.value })}
                  placeholder="#alerts"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={saveSlack}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Speichere...' : '💾 Slack speichern'}
                </button>
                <button
                  onClick={testSlackConnection}
                  disabled={saving}
                  className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Teste...' : '💬 Test-Nachricht'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Configuration */}
        {activeTab === 'webhook' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-[#FEF3C7] rounded-lg">
                <span className="text-2xl">🔗</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">Custom Webhook</h2>
                <p className="text-sm text-[#64748B]">Verbinde mit deinen eigenen Systemen (HMAC-SHA256 signiert)</p>
              </div>
            </div>

            {/* Security Info Banner */}
            <div className="mb-6 bg-[#DBEAFE] border border-[#3B82F6] rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-[#3B82F6] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div className="text-sm text-[#1E40AF]">
                  <p className="font-semibold mb-1">🔒 Sicherheitshinweise:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Nur HTTPS URLs erlaubt (außer localhost für Tests)</li>
                    <li>Private IP-Adressen werden blockiert (10.x, 192.168.x, 172.16-31.x)</li>
                    <li>HMAC-SHA256 Signatur im Header: <code className="bg-white px-1 rounded">X-Webhook-Signature</code></li>
                    <li>Secret wird verschlüsselt in der Datenbank gespeichert</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Test Server Hinweis */}
            <div className="mb-6 bg-[#FEF3C7] border border-[#F59E0B] rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-xl mr-3 flex-shrink-0">💡</span>
                <div className="text-sm text-[#92400E] flex-1">
                  <p className="font-semibold mb-2">Lokale Tests - Test-Server starten:</p>
                  
                  <div className="bg-[#1E293B] rounded p-3 font-mono text-xs text-white mb-3">
                    <div className="mb-2 text-[#10B981]"># Im Projekt-Root ausführen:</div>
                    <div>node test-webhook-server.js</div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="font-semibold mb-1">Dann diese URL verwenden:</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-white px-3 py-1.5 rounded font-mono text-sm flex-1">
                        http://localhost:3333/webhook
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setWebhookConfig({ 
                            ...webhookConfig, 
                            url: 'http://localhost:3333/webhook',
                            secret: 'test-secret-12345'
                          })
                        }}
                        className="px-3 py-1.5 bg-[#3B82F6] text-white rounded text-xs font-semibold hover:bg-[#2563EB] transition-colors whitespace-nowrap"
                      >
                        📋 Übernehmen
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs">
                    ⚠️ <strong>Wichtig:</strong> Der Test-Server muss laufen, damit der Test funktioniert!
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Webhook URL *
                </label>
                <input
                  type="url"
                  value={webhookConfig.url}
                  onChange={(e) => setWebhookConfig({ ...webhookConfig, url: e.target.value })}
                  placeholder="https://your-api.com/webhook/alerts"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
                <p className="text-xs text-[#64748B] mt-1">
                  Muss HTTPS verwenden (außer localhost für Development)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Secret (empfohlen)
                </label>
                <input
                  type="password"
                  value={webhookConfig.secret}
                  onChange={(e) => setWebhookConfig({ ...webhookConfig, secret: e.target.value })}
                  placeholder="Generiere ein starkes Secret (min. 32 Zeichen)"
                  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[#64748B]">
                    Für HMAC-SHA256 Signatur-Validierung
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const randomSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('')
                      setWebhookConfig({ ...webhookConfig, secret: randomSecret })
                    }}
                    className="text-xs text-[#3B82F6] hover:underline font-medium"
                  >
                    🎲 Zufälliges Secret generieren
                  </button>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="border-t border-[#E2E8F0] pt-4">
                <h3 className="text-sm font-bold text-[#0F172A] mb-3">⚙️ Erweiterte Einstellungen</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Timeout (Sekunden)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={webhookConfig.timeout_seconds || 5}
                      onChange={(e) => setWebhookConfig({ ...webhookConfig, timeout_seconds: parseInt(e.target.value) || 5 })}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                    <p className="text-xs text-[#64748B] mt-1">Standard: 5 Sekunden</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Retry-Versuche
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={webhookConfig.retry_count || 3}
                      onChange={(e) => setWebhookConfig({ ...webhookConfig, retry_count: parseInt(e.target.value) || 3 })}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                    <p className="text-xs text-[#64748B] mt-1">Standard: 3 Versuche</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-[#F8FAFC] rounded-lg mt-4">
                  <input
                    type="checkbox"
                    id="webhook-validate-ssl"
                    checked={webhookConfig.validate_ssl !== false}
                    onChange={(e) => setWebhookConfig({ ...webhookConfig, validate_ssl: e.target.checked })}
                    className="w-5 h-5 text-[#3B82F6] border-[#CBD5E1] rounded focus:ring-[#3B82F6]"
                  />
                  <label htmlFor="webhook-validate-ssl" className="text-sm font-medium text-[#0F172A]">
                    SSL-Zertifikate validieren (empfohlen)
                  </label>
                </div>
              </div>

              {/* Payload Documentation */}
              <div className="border-t border-[#E2E8F0] pt-4">
                <h3 className="text-sm font-bold text-[#0F172A] mb-3">📋 Payload Format</h3>
                
                <div className="bg-[#1E293B] rounded-lg p-4 mb-3">
                  <p className="text-sm font-semibold text-white mb-2">Beispiel Payload:</p>
                  <pre className="text-xs text-[#94A3B8] font-mono overflow-x-auto">
{`{
  "event": "certificate.expiring",
  "tenant_id": "uuid",
  "certificate": {
    "id": "uuid",
    "subject_cn": "example.com",
    "issuer": "Let's Encrypt",
    "expires_at": "2025-12-31T23:59:59Z",
    "days_left": 14,
    "fingerprint": "sha256:abcd..."
  },
  "severity": "warning",
  "timestamp": "2025-10-18T12:00:00Z"
}`}
                  </pre>
                </div>

                <div className="bg-[#1E293B] rounded-lg p-4">
                  <p className="text-sm font-semibold text-white mb-2">Headers:</p>
                  <pre className="text-xs text-[#94A3B8] font-mono">
{`Content-Type: application/json
User-Agent: Zertifikat-Waechter/1.0
X-Webhook-Event: certificate.expiring
X-Webhook-Signature: sha256=<hmac_hex>
X-Webhook-Signature-Timestamp: 2025-10-18T12:00:00Z`}
                  </pre>
                </div>

                <div className="mt-3 text-xs text-[#64748B] bg-[#F8FAFC] p-3 rounded-lg">
                  <p className="font-semibold mb-2">🔐 Signatur verifizieren (Pseudocode):</p>
                  <code className="block text-[#0F172A] font-mono">
                    expected_sig = hmac_sha256(secret, request_body)<br />
                    received_sig = request.headers['X-Webhook-Signature'].split('=')[1]<br />
                    if expected_sig == received_sig: # ✅ Valid
                  </code>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={saveWebhook}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Speichere...' : '💾 Webhook speichern'}
                </button>
                <button
                  onClick={testWebhookConnection}
                  disabled={saving}
                  className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
                >
                  {saving ? '⏳ Teste...' : '🔗 Test senden'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

