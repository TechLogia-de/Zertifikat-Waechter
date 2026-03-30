import { memo } from 'react'
// Tab navigation for integration types (SMTP, Slack, Webhook)

export type IntegrationTab = 'smtp' | 'slack' | 'webhook'

interface IntegrationTabsProps {
  activeTab: IntegrationTab
  onTabChange: (tab: IntegrationTab) => void
}

function IntegrationTabs({ activeTab, onTabChange }: IntegrationTabsProps) {
  const tabs: { key: IntegrationTab; label: string }[] = [
    { key: 'smtp', label: '📧 SMTP / E-Mail' },
    { key: 'slack', label: '💬 Slack' },
    { key: 'webhook', label: '🔗 Webhook' },
  ]

  return (
    <div className="flex space-x-2 mb-6 bg-white rounded-lg p-2 border border-[#E2E8F0]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === tab.key
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default memo(IntegrationTabs)
