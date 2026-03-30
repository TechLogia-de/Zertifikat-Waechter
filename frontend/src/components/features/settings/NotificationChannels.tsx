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

interface NotificationChannelsProps {
  policy: Policy | null
  onToggleChannel: (channel: keyof Policy['channels']) => void
}

/**
 * Displays notification channel toggles (Email, Webhook, Slack, Teams).
 */
export default function NotificationChannels({ policy, onToggleChannel }: NotificationChannelsProps) {
  return (
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
              onClick={() => onToggleChannel(channel as keyof Policy['channels'])}
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
  )
}
