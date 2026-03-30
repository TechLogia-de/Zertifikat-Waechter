// Slack integration configuration form

interface SlackConfig {
  webhook_url: string
  channel: string
}

interface SlackConfigFormProps {
  slackConfig: SlackConfig
  onSlackConfigChange: (config: SlackConfig) => void
  saving: boolean
  onSave: () => void
  onTest: () => void
}

export default function SlackConfigForm({
  slackConfig,
  onSlackConfigChange,
  saving,
  onSave,
  onTest,
}: SlackConfigFormProps) {
  return (
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
            onChange={(e) => onSlackConfigChange({ ...slackConfig, webhook_url: e.target.value })}
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
            onChange={(e) => onSlackConfigChange({ ...slackConfig, channel: e.target.value })}
            placeholder="#alerts"
            className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Speichere...' : '💾 Slack speichern'}
          </button>
          <button
            onClick={onTest}
            disabled={saving}
            className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Teste...' : '💬 Test-Nachricht'}
          </button>
        </div>
      </div>
    </div>
  )
}
