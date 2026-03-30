import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import {
  SettingsHeader,
  NotificationChannels,
  WarnDaysEditor,
  MfaSection,
  SaveButton,
  useMfa,
} from '../components/features/settings'

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

  // MFA hook encapsulates all TOTP enrollment/verification/disable logic
  const mfa = useMfa(user)

  useEffect(() => {
    loadSettings()
    mfa.loadMfaStatus()
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

            <SaveButton saving={saving} onSave={handleSave} />
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
