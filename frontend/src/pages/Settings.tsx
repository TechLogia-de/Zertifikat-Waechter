import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'

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

  useEffect(() => {
    loadSettings()
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

