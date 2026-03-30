import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import logger from '../utils/logger'
import {
  SettingsHeader,
  NotificationChannels,
  WarnDaysEditor,
  MfaSection,
  SaveButton,
  useMfa,
} from '../components/features/settings'

interface Policy {
  id?: string
  tenant_id: string
  warn_days: number[]
  channels: {
    email: boolean
    webhook: boolean
    slack: boolean
    teams: boolean
  }
}

// Default policy for first-time creation
const DEFAULT_CHANNELS = {
  email: true,
  webhook: false,
  slack: false,
  teams: false,
}

const DEFAULT_WARN_DAYS = [30, 14, 7]

export default function Settings() {
  const { user } = useAuth()
  const { tenantId } = useTenantId()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [isNewPolicy, setIsNewPolicy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // MFA hook encapsulates all TOTP enrollment/verification/disable logic
  const mfa = useMfa(user)

  useEffect(() => {
    mfa.loadMfaStatus()
  }, [user])

  useEffect(() => {
    if (tenantId) {
      loadSettings()
    }
  }, [tenantId])

  async function loadSettings() {
    if (!tenantId) return

    try {
      const { data: policyData } = await supabase
        .from('policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (policyData) {
        setPolicy(policyData as Policy)
        setIsNewPolicy(false)
      } else {
        // Initialize default policy when none exists yet
        setPolicy({
          tenant_id: tenantId,
          warn_days: DEFAULT_WARN_DAYS,
          channels: { ...DEFAULT_CHANNELS },
        })
        setIsNewPolicy(true)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!policy || !tenantId) return

    setSaving(true)
    setSuccess(false)

    try {
      // Build payload; include id only when updating an existing policy
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        warn_days: policy.warn_days,
        channels: policy.channels,
      }
      if (policy.id) {
        payload.id = policy.id
      }

      const { data, error } = await supabase
        .from('policies')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      // After first creation, store the returned row so subsequent saves use update path
      if (data) {
        setPolicy(data as Policy)
        setIsNewPolicy(false)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Export tenant configuration as JSON file
  async function handleExport() {
    if (!tenantId) return

    try {
      // Fetch policy
      const { data: policyData } = await supabase
        .from('policies')
        .select('warn_days, channels')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      // Fetch integrations (exclude secrets)
      const { data: integrations } = await (supabase as any)
        .from('integrations')
        .select('type, name, config, enabled')
        .eq('tenant_id', tenantId)

      // Strip sensitive fields from integration configs
      const safeIntegrations = (integrations || []).map((integ: any) => {
        const config = { ...integ.config }
        // Remove secrets and passwords
        delete config.password
        delete config.secret
        return {
          type: integ.type,
          name: integ.name,
          enabled: integ.enabled,
          config,
        }
      })

      const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        policy: policyData || null,
        integrations: safeIntegrations,
      }

      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zertifikat-waechter-config-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      logger.info('Configuration exported', { tenantId })
    } catch (err) {
      logger.error('Failed to export configuration', { error: String(err) })
    }
  }

  // Import tenant configuration from JSON file
  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return

    setImporting(true)
    setImportError(null)
    setImportSuccess(false)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate structure
      if (typeof data !== 'object' || data === null || typeof data.version !== 'number') {
        throw new Error('Ungueltige Konfigurationsdatei: fehlende Version')
      }

      // Import policy if present
      if (data.policy && typeof data.policy === 'object') {
        const policyPayload: Record<string, unknown> = {
          tenant_id: tenantId,
        }
        if (Array.isArray(data.policy.warn_days)) {
          policyPayload.warn_days = data.policy.warn_days
        }
        if (data.policy.channels && typeof data.policy.channels === 'object') {
          policyPayload.channels = data.policy.channels
        }

        const { error: policyErr } = await supabase
          .from('policies')
          .upsert(policyPayload as any)

        if (policyErr) throw policyErr
      }

      // Import integrations if present
      if (Array.isArray(data.integrations)) {
        for (const integ of data.integrations) {
          if (!integ.type || !integ.name) continue

          const { error: integErr } = await (supabase as any)
            .from('integrations')
            .upsert(
              {
                tenant_id: tenantId,
                type: integ.type,
                name: integ.name,
                config: integ.config || {},
                enabled: integ.enabled ?? true,
              },
              { onConflict: 'tenant_id,type,name' }
            )

          if (integErr) throw integErr
        }
      }

      setImportSuccess(true)
      setTimeout(() => setImportSuccess(false), 3000)
      logger.info('Configuration imported', { tenantId })

      // Reload settings to reflect imported data
      await loadSettings()
    } catch (err: any) {
      const msg = err?.message || 'Unbekannter Fehler beim Import'
      setImportError(msg)
      logger.error('Failed to import configuration', { error: msg })
    } finally {
      setImporting(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <SettingsHeader />

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
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

            {/* Hint for first-time policy creation */}
            {isNewPolicy && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center">
                <span className="mr-2 text-lg">💡</span>
                <span className="font-medium">Erstelle deine erste Benachrichtigungsrichtlinie</span>
              </div>
            )}

            <NotificationChannels policy={policy} onToggleChannel={toggleChannel} />

            <WarnDaysEditor policy={policy} onPolicyChange={setPolicy} />

            <MfaSection
              mfaLoading={mfa.mfaLoading}
              mfaSuccess={mfa.mfaSuccess}
              mfaError={mfa.mfaError}
              totpEnabled={mfa.totpEnabled}
              totpFactor={mfa.totpFactor}
              qrImageUrl={mfa.qrImageUrl}
              totpSecret={mfa.totpSecret}
              totpIssuer={mfa.totpIssuer}
              totpLabel={mfa.totpLabel}
              totpUri={mfa.totpUri}
              verificationCode={mfa.verificationCode}
              enrolling={mfa.enrolling}
              verifying={mfa.verifying}
              disabling={mfa.disabling}
              onVerificationCodeChange={mfa.setVerificationCode}
              onInitiateEnrollment={mfa.initiateMfaEnrollment}
              onVerify={mfa.verifyMfa}
              onCancel={mfa.cancelEnrollment}
              onDisable={mfa.disableMfa}
            />

            {/* Export / Import Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Konfiguration exportieren / importieren</h2>
              <p className="text-sm text-gray-500 mb-4">
                Exportiere deine Richtlinien und Integrations-Einstellungen als JSON-Datei oder importiere eine bestehende Konfiguration. Passwoerter und Secrets werden beim Export nicht eingeschlossen.
              </p>

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  <span className="font-medium">Import-Fehler:</span> {importError}
                </div>
              )}

              {importSuccess && (
                <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Konfiguration erfolgreich importiert!</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportieren
                </button>

                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={importing}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {importing ? 'Importiere...' : 'Importieren'}
                </button>

                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>

            <SaveButton saving={saving} onSave={handleSave} />
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
