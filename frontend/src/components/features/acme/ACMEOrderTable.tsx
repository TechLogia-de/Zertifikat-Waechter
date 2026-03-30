import { memo } from 'react'
// Table displaying ACME renewal orders with status and actions

import { ACMEOrder, getStatusBadgeProps } from './types'

interface ACMEOrderTableProps {
  orders: ACMEOrder[]
  accountCount: number
  onCreateOrder: () => void
  onDeleteOrder: (orderId: string) => void
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

function ACMEOrderTable({
  orders,
  accountCount,
  onCreateOrder,
  onDeleteOrder
}: ACMEOrderTableProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-[#E0E7FF] to-[#DDD6FE] rounded-lg">
            <span className="text-3xl">📋</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Renewal Orders</h2>
            <p className="text-sm text-[#64748B]">Automatische Zertifikats-Erneuerungen</p>
          </div>
        </div>
        <button
          onClick={onCreateOrder}
          disabled={accountCount === 0}
          className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          ➕ Order erstellen
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-[#64748B]">
          <div className="text-6xl mb-4">📋</div>
          <p className="font-semibold mb-2 text-lg">Keine Renewal Orders</p>
          <p className="text-sm">
            {accountCount === 0
              ? 'Erstelle zuerst einen ACME Account!'
              : 'Erstelle eine Order für automatische Renewals!'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F8FAFC] border-b-2 border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Challenge
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Erstellt
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Fehler
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0F172A]">{order.domain}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-[#F1F5F9] text-[#475569] rounded text-xs font-medium">
                      {order.challenge_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">
                    {new Date(order.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3">
                    {order.last_error ? (
                      <div className="text-xs text-[#EF4444] max-w-xs truncate" title={order.last_error}>
                        {order.last_error}
                      </div>
                    ) : (
                      <span className="text-xs text-[#10B981]">✓ OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDeleteOrder(order.id)}
                      className="text-xs text-[#EF4444] hover:bg-[#FEE2E2] px-2 py-1 rounded transition-colors"
                      title="Order löschen"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default memo(ACMEOrderTable)
