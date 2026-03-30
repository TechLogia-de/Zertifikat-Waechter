// Custom webhook configuration form with HMAC signing and payload documentation

interface WebhookConfig {
  url: string
  secret: string
  timeout_seconds?: number
  retry_count?: number
  validate_ssl?: boolean
}

interface WebhookConfigFormProps {
  webhookConfig: WebhookConfig
  onWebhookConfigChange: (config: WebhookConfig) => void
  saving: boolean
  onSave: () => void
  onTest: () => void
}

export default function WebhookConfigForm({
  webhookConfig,
  onWebhookConfigChange,
  saving,
  onSave,
  onTest,
}: WebhookConfigFormProps) {
  return (
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Webhook URL *
          </label>
          <input
            type="url"
            value={webhookConfig.url}
            onChange={(e) => onWebhookConfigChange({ ...webhookConfig, url: e.target.value })}
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
            onChange={(e) => onWebhookConfigChange({ ...webhookConfig, secret: e.target.value })}
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
                onWebhookConfigChange({ ...webhookConfig, secret: randomSecret })
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
                onChange={(e) => onWebhookConfigChange({ ...webhookConfig, timeout_seconds: parseInt(e.target.value) || 5 })}
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
                onChange={(e) => onWebhookConfigChange({ ...webhookConfig, retry_count: parseInt(e.target.value) || 3 })}
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
              onChange={(e) => onWebhookConfigChange({ ...webhookConfig, validate_ssl: e.target.checked })}
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
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Speichere...' : '💾 Webhook speichern'}
          </button>
          <button
            onClick={onTest}
            disabled={saving}
            className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Teste...' : '🔗 Test senden'}
          </button>
        </div>
      </div>
    </div>
  )
}
