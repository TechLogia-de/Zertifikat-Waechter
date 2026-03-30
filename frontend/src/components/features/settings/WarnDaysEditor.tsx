import { memo } from 'react'
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

interface WarnDaysEditorProps {
  policy: Policy | null
  onPolicyChange: (policy: Policy) => void
}

/**
 * Editor for warning day thresholds with quick presets.
 */
function WarnDaysEditor({ policy, onPolicyChange }: WarnDaysEditorProps) {
  return (
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
                    onPolicyChange({ ...policy, warn_days: newWarnDays })
                  }}
                  className="text-[#EF4444] hover:text-[#DC2626] text-xs"
                  aria-label="Löschen"
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
                  onPolicyChange({ ...policy, warn_days: newWarnDays })
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
            onPolicyChange({ ...policy, warn_days: newWarnDays })
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
                  onPolicyChange({ ...policy, warn_days: preset.values })
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
  )
}

export default memo(WarnDaysEditor)
