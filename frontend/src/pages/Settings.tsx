import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import QRCode from 'qrcode'

interface Policy {
  id: string
  tenant_id: string
  warn_days: number[]
  channels: {
    email: boolean
    webhook: boolean
    slack: boolean
    teams: boolean
  }
}

export default function Settings() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string>('')
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // MFA (TOTP) State
  type FactorStatus = 'verified' | 'unverified' | 'pending' | 'errored'
  interface TotpFactor {
    id: string
    factor_type: 'totp'
    status: FactorStatus
    friendly_name?: string | null
  }

  const [mfaLoading, setMfaLoading] = useState<boolean>(false)
  const [totpFactor, setTotpFactor] = useState<TotpFactor | null>(null)
  const [totpEnabled, setTotpEnabled] = useState<boolean>(false)
  const [enrolling, setEnrolling] = useState<boolean>(false)
  const [verifying, setVerifying] = useState<boolean>(false)
  const [disabling, setDisabling] = useState<boolean>(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpIssuer, setTotpIssuer] = useState<string | null>(null)
  const [totpLabel, setTotpLabel] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    loadMfaStatus()
  }, [user])

  async function loadSettings() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        setTenantId(membership.tenant_id)

        const { data: policyData } = await supabase
          .from('policies')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .maybeSingle()

        if (policyData) {
          setPolicy(policyData as Policy)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMfaStatus() {
    if (!user) return
    setMfaLoading(true)
    setMfaError(null)
    try {
      const { data, error } = await (supabase.auth as any).mfa.listFactors()
      if (error) throw error

      const factors: any[] = (data?.factors as any[]) || []
      const totp = factors.find((f) => f.factor_type === 'totp') || null
      if (totp) {
        setTotpFactor({
          id: totp.id,
          factor_type: 'totp',
          status: totp.status as FactorStatus,
          friendly_name: (totp as any).friendly_name ?? null,
        })
        setTotpEnabled(totp.status === 'verified')
      } else {
        setTotpFactor(null)
        setTotpEnabled(false)
      }
    } catch (err: any) {
      console.error('Failed to load MFA status:', err)
      setMfaError(err.message || 'Fehler beim Laden des MFA-Status')
    } finally {
      setMfaLoading(false)
    }
  }

  async function startMfaEnrollment() {
    setEnrolling(true)
    setMfaError(null)
    setMfaSuccess(null)
    setQrImageUrl(null)
    setTotpUri(null)
    setTotpSecret(null)
    setTotpIssuer(null)
    setTotpLabel(null)
    setVerificationCode('')
    try {
      const { data, error } = await (supabase.auth as any).mfa.enroll({ factorType: 'totp' })
      if (error) throw error

      const factorId: string = data?.id
      const totpData = data?.totp || {}
      const qrFromServer: string | undefined = totpData.qr_code
      const otpauthUri: string | undefined = totpData.uri
      const secretFromServer: string | undefined = totpData.secret

      if (factorId) {
        setTotpFactor({ id: factorId, factor_type: 'totp', status: 'unverified' })
      }

      // Parse otpauth URI to extract secret/issuer/label for manual setup
      function parseOtpAuthUri(uri: string): { secret: string | null; issuer: string | null; label: string | null } {
        try {
          const httpUri = uri.replace('otpauth://', 'http://')
          const url = new URL(httpUri)
          const params = new URLSearchParams(url.search)
          const secret = params.get('secret')
          const issuer = params.get('issuer')
          const rawPath = url.pathname.replace(/^\//, '')
          const label = rawPath ? decodeURIComponent(rawPath) : null
          return { secret, issuer, label }
        } catch (_) {
          const secretMatch = uri.match(/secret=([^&]+)/i)
          const issuerMatch = uri.match(/issuer=([^&]+)/i)
          const labelMatch = uri.match(/^otpauth:\/\/totp\/([^?]+)/i)
          return {
            secret: secretMatch ? decodeURIComponent(secretMatch[1]) : null,
            issuer: issuerMatch ? decodeURIComponent(issuerMatch[1]) : null,
            label: labelMatch ? decodeURIComponent(labelMatch[1]) : null,
          }
        }
      }

      if (otpauthUri) {
        setTotpUri(otpauthUri)
        const parsed = parseOtpAuthUri(otpauthUri)
        setTotpSecret(secretFromServer || parsed.secret)
        setTotpIssuer(parsed.issuer)
        setTotpLabel(parsed.label)
      } else {
        setTotpUri(null)
        setTotpSecret(secretFromServer || null)
        setTotpIssuer(null)
        setTotpLabel(null)
      }

      if (qrFromServer) {
        setQrImageUrl(qrFromServer)
      } else if (otpauthUri) {
        const dataUrl = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 2 })
        setQrImageUrl(dataUrl)
      } else {
        throw new Error('Kein QR-Code/URI vom Server erhalten')
      }
    } catch (err: any) {
      console.error('Failed to start MFA enrollment:', err)
      const message: string = (err?.message || '').toLowerCase()
      if (message.includes('not enabled') || message.includes('disabled')) {
        setMfaError('MFA ist serverseitig deaktiviert. Bitte MFA/TOTP in Supabase aktivieren.')
      } else if (message.includes('too many') || message.includes('max')) {
        setMfaError('Zu viele Faktoren registriert. Bitte zunächst alte Faktoren entfernen.')
      } else {
        setMfaError(err.message || 'Fehler beim Aktivieren von MFA')
      }
    } finally {
      setEnrolling(false)
    }
  }

  async function verifyMfa() {
    const code = verificationCode.trim()
    if (!totpFactor?.id) {
      setMfaError('Kein TOTP‑Faktor vorhanden. Bitte starte die Aktivierung erneut.')
      return
    }
    if (code.length !== 6) {
      setMfaError('Bitte den 6‑stelligen Code eingeben')
      return
    }
    setVerifying(true)
    setMfaError(null)
    setMfaSuccess(null)
    try {
      const { error } = await (supabase.auth as any).mfa.verify({
        factorId: totpFactor.id,
        code,
      })
      if (error) throw error

      setMfaSuccess('✅ MFA (TOTP) aktiviert!')
      setTotpEnabled(true)
      setTotpFactor({ ...totpFactor, status: 'verified' })
      setQrImageUrl(null)
      setTotpUri(null)
      setTotpSecret(null)
      setTotpIssuer(null)
      setTotpLabel(null)
      setVerificationCode('')
    } catch (err: any) {
      console.error('Failed to verify MFA:', err)
      const message: string = (err?.message || '').toLowerCase()
      if (message.includes('not enabled') || message.includes('disabled')) {
        setMfaError('MFA ist serverseitig deaktiviert. Bitte MFA/TOTP in Supabase aktivieren.')
      } else if (message.includes('invalid') || message.includes('code')) {
        setMfaError('Ungültiger Code. Bitte erneut versuchen.')
      } else {
        setMfaError(err?.message || 'Fehler bei der Verifizierung')
      }
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnrollment() {
    if (!totpFactor?.id) {
      setQrImageUrl(null)
      setVerificationCode('')
      return
    }
    try {
      await (supabase.auth as any).mfa.unenroll({ factorId: totpFactor.id })
    } catch (_) {
      // ignore cleanup errors
    } finally {
      setQrImageUrl(null)
      setTotpUri(null)
      setTotpSecret(null)
      setTotpIssuer(null)
      setTotpLabel(null)
      setVerificationCode('')
      setTotpFactor(null)
      setTotpEnabled(false)
      setMfaSuccess(null)
      setMfaError(null)
    }
  }

  async function disableMfa() {
    if (!totpFactor?.id) return
    setDisabling(true)
    setMfaError(null)
    setMfaSuccess(null)
    try {
      const { error } = await (supabase.auth as any).mfa.unenroll({ factorId: totpFactor.id })
      if (error) throw error
      setMfaSuccess('✅ MFA wurde deaktiviert')
      setTotpEnabled(false)
      setTotpFactor(null)
    } catch (err: any) {
      console.error('Failed to disable MFA:', err)
      setMfaError(err.message || 'Fehler beim Deaktivieren von MFA')
    } finally {
      setDisabling(false)
    }
  }

  async function handleSave() {
    if (!policy || !tenantId) return

    setSaving(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('policies')
        .upsert({
          id: policy.id,
          tenant_id: tenantId,
          warn_days: policy.warn_days,
          channels: policy.channels
        })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(channel: keyof Policy['channels']) {
    if (!policy) return
    setPolicy({
      ...policy,
      channels: {
        ...policy.channels,
        [channel]: !policy.channels[channel]
      }
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">Einstellungen</h1>
            <p className="text-sm md:text-base text-[#64748B] mt-1">
              Alert-Policies • Warnschwellen (60/30/14/7/3/1 Tage) • Benachrichtigungs-Kanäle • Tenant-Config
            </p>
          </div>
          <Link 
            to="/integrations"
            className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium hover:bg-[#2563EB] active:scale-95 transition-all shadow-md"
          >
            🔗 Integrationen verwalten
          </Link>
        </div>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-4xl">
        {loading ? (
          <div className="py-12">
            <LoadingState size="md" text="Lade Einstellungen..." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Einstellungen erfolgreich gespeichert!</span>
              </div>
            )}

            {/* Notification Channels */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-xl font-bold text-[#0F172A] mb-4">
                Benachrichtigungskanäle
              </h2>
              <div className="space-y-4">
                {policy && Object.entries(policy.channels).map(([channel, enabled]) => (
                  <div key={channel} className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {channel === 'email' && '📧'}
                        {channel === 'webhook' && '🔗'}
                        {channel === 'slack' && '💬'}
                        {channel === 'teams' && '👥'}
                      </span>
                      <div>
                        <p className="font-semibold text-[#0F172A] capitalize">{channel}</p>
                        <p className="text-sm text-[#64748B]">
                          {channel === 'email' && 'E-Mail Benachrichtigungen'}
                          {channel === 'webhook' && 'Webhook Integration'}
                          {channel === 'slack' && 'Slack Notifications'}
                          {channel === 'teams' && 'Microsoft Teams'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleChannel(channel as keyof Policy['channels'])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? 'bg-[#3B82F6]' : 'bg-[#CBD5E1]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Days Editor */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-xl font-bold text-[#0F172A] mb-4">
                Warnschwellen bearbeiten
              </h2>
              <p className="text-sm text-[#64748B] mb-4">
                Bei wie vielen Tagen vor Ablauf sollen Warnungen gesendet werden?
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {policy?.warn_days.map((days, idx) => (
                    <div key={idx} className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-[#64748B] font-medium">
                          Schwelle {idx + 1}
                        </label>
                        <button
                          onClick={() => {
                            if (!policy) return
                            const newWarnDays = [...policy.warn_days]
                            newWarnDays.splice(idx, 1)
                            setPolicy({ ...policy, warn_days: newWarnDays })
                          }}
                          className="text-[#EF4444] hover:text-[#DC2626] text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={days}
                        onChange={(e) => {
                          if (!policy) return
                          const newValue = parseInt(e.target.value) || 0
                          const newWarnDays = [...policy.warn_days]
                          newWarnDays[idx] = newValue
                          setPolicy({ ...policy, warn_days: newWarnDays })
                        }}
                        className="w-full text-center text-2xl font-bold text-[#3B82F6] bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
                      />
                      <p className="text-xs text-[#64748B] mt-2 text-center">Tage</p>
                    </div>
                  ))}
                </div>

                {/* Add New Threshold */}
                <button
                  onClick={() => {
                    if (!policy) return
                    const newWarnDays = [...policy.warn_days, 90].sort((a, b) => b - a)
                    setPolicy({ ...policy, warn_days: newWarnDays })
                  }}
                  className="w-full py-3 border-2 border-dashed border-[#E2E8F0] rounded-lg text-[#64748B] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors font-medium"
                >
                  + Schwelle hinzufügen
                </button>

                {/* Quick Presets */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-3">Schnellauswahl:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Standard', values: [60, 30, 14, 7, 3, 1] },
                      { label: 'Minimal', values: [30, 7, 1] },
                      { label: 'Ausführlich', values: [90, 60, 30, 21, 14, 7, 3, 1] },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          if (!policy) return
                          setPolicy({ ...policy, warn_days: preset.values })
                        }}
                        className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* MFA (TOTP) Settings */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#0F172A]">Sicherheit: Zwei‑Faktor‑Authentifizierung (TOTP)</h2>
                {mfaLoading && <span className="text-sm text-[#64748B]">Lade…</span>}
              </div>

              {mfaSuccess && (
                <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg mb-4">
                  {mfaSuccess}
                </div>
              )}
              {mfaError && (
                <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg mb-4">
                  ❌ {mfaError}
                  {mfaError.includes('serverseitig deaktiviert') && (
                    <div className="mt-2 text-[#991B1B] text-xs">
                      Tipp: In `supabase/config.toml` den Block `[auth.mfa]` aktivieren und unter `[auth.mfa.totp]` `enroll_enabled=true`, `verify_enabled=true` setzen. Danach Supabase neu starten.
                    </div>
                  )}
                </div>
              )}

              {totpEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="font-semibold text-[#0F172A]">Status</p>
                      <p className="text-sm text-[#64748B]">TOTP ist aktiviert für dein Konto.</p>
                    </div>
                    <span className="px-3 py-1 rounded bg-[#D1FAE5] text-[#065F46] text-sm font-medium">Aktiv</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={disableMfa}
                      disabled={disabling}
                      className="px-4 py-2 bg-[#EF4444] text-white rounded-lg font-semibold hover:bg-[#DC2626] disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {disabling ? '⏳ Deaktiviere…' : 'MFA deaktivieren'}
                    </button>
                  </div>
                </div>
              ) : qrImageUrl ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrImageUrl} alt="TOTP QR Code" className="w-56 h-56 object-contain" />
                    </div>
                    <p className="text-sm text-[#64748B] mt-3 text-center">
                      Scanne den QR‑Code mit deiner Authenticator‑App (z. B. Google Authenticator, 1Password, Authy).
                    </p>
                    <div className="w-full mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                      <p className="text-sm font-semibold text-[#0F172A] mb-2">Manuelle Einrichtung</p>
                      {totpSecret ? (
                        <div className="space-y-2">
                          {totpIssuer || totpLabel ? (
                            <p className="text-xs text-[#64748B]">
                              {(totpIssuer && totpLabel) ? `${totpIssuer} – ${totpLabel}` : (totpIssuer || totpLabel)}
                            </p>
                          ) : null}
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={totpSecret}
                              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-sm bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => { if (totpSecret) navigator.clipboard?.writeText(totpSecret).catch(() => {}) }}
                              className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                            >
                              Kopieren
                            </button>
                          </div>
                          <p className="text-xs text-[#64748B]">In deiner Authenticator‑App „Schlüssel eingeben“ wählen. Typ: TOTP, 6 Ziffern, 30s.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-[#64748B]">Falls kein Schlüssel sichtbar ist, kannst du die otpauth‑URI kopieren:</p>
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={totpUri ?? ''}
                              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => { if (totpUri) navigator.clipboard?.writeText(totpUri).catch(() => {}) }}
                              className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                            >
                              Kopieren
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-[#0F172A]">6‑stelligen Code eingeben</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                      placeholder="123456"
                    />
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={verifyMfa}
                        disabled={verifying || verificationCode.length !== 6}
                        className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {verifying ? '⏳ Verifiziere…' : 'MFA aktivieren'}
                      </button>
                      <button
                        onClick={cancelEnrollment}
                        className="px-4 py-3 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#64748B]">
                    Schütze deinen Account mit einer zusätzlichen Sicherheitsstufe. Nach der Aktivierung benötigst du bei der Anmeldung einen Code aus deiner Authenticator‑App.
                  </p>
                  <button
                    onClick={startMfaEnrollment}
                    disabled={enrolling}
                    className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {enrolling ? '⏳ Starte…' : 'MFA (TOTP) aktivieren'}
                  </button>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-md"
              >
                {saving ? '⏳ Speichern...' : '💾 Einstellungen speichern'}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

