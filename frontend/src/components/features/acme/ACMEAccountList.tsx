import { memo } from 'react'
// Displays the list of ACME accounts with provider info and status badges

import { ACMEAccount, getProviderInfo, getStatusBadgeProps } from './types'

interface ACMEAccountListProps {
  accounts: ACMEAccount[]
  tenantId: string
  onCreateAccount: () => void
  onDeleteAccount: (accountId: string) => void
}

// Renders a status badge span
function StatusBadge({ status }: { status: string }) {
  const badge = getStatusBadgeProps(status)
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: badge.bg, color: badge.text }}
    >
      {badge.label}
    </span>
  )
}

function ACMEAccountList({
  accounts,
  tenantId,
  onCreateAccount,
  onDeleteAccount
}: ACMEAccountListProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-[#D1FAE5] to-[#DCFCE7] rounded-lg">
            <span className="text-3xl">🔑</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">ACME Accounts</h2>
            <p className="text-sm text-[#64748B]">Verwalte deine Certificate Authority Accounts</p>
          </div>
        </div>
        <button
          onClick={onCreateAccount}
          disabled={!tenantId}
          className="px-4 py-2 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          ➕ Account erstellen
        </button>
      </div>

      {!tenantId && (
        <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg mb-4">
          ⚠️ Kein Tenant gefunden! Bitte melde dich neu an.
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-[#64748B]">
          <div className="text-6xl mb-4">🔑</div>
          <p className="font-semibold mb-2 text-lg">Noch keine ACME Accounts</p>
          <p className="text-sm">Erstelle einen Account um loszulegen!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts.map(account => {
            const provider = getProviderInfo(account.provider)
            return (
              <div
                key={account.id}
                className="border-2 border-[#E2E8F0] rounded-lg p-4 hover:shadow-lg hover:border-[#3B82F6] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{provider.icon}</span>
                    <div>
                      <div className="font-bold text-[#0F172A]">{provider.name}</div>
                      <div className="text-sm text-[#64748B]">{account.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={account.status} />
                    <button
                      onClick={() => onDeleteAccount(account.id)}
                      className="text-xs text-[#EF4444] hover:bg-[#FEE2E2] px-2 py-1 rounded transition-colors"
                      title="Account löschen"
                    >
                      🗑️ Löschen
                    </button>
                  </div>
                </div>
                {account.account_url && (
                  <div className="text-xs text-[#64748B] font-mono bg-[#F8FAFC] p-2 rounded mt-2 truncate">
                    {account.account_url}
                  </div>
                )}
                <div className="text-xs text-[#94A3B8] mt-2">
                  Erstellt: {new Date(account.created_at).toLocaleString('de-DE')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(ACMEAccountList)
