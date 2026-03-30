import { memo } from 'react'
// Statistics grid showing account and order counts

import { ACMEOrder } from './types'

interface ACMEStatsGridProps {
  accountCount: number
  orders: ACMEOrder[]
}

function ACMEStatsGrid({ accountCount, orders }: ACMEStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Accounts</div>
        <div className="text-4xl font-bold text-[#3B82F6]">{accountCount}</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Aktive Orders</div>
        <div className="text-4xl font-bold text-[#10B981]">
          {orders.filter(o => o.status === 'valid' || o.status === 'processing').length}
        </div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Ausstehend</div>
        <div className="text-4xl font-bold text-[#F59E0B]">
          {orders.filter(o => o.status === 'pending').length}
        </div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Fehler</div>
        <div className="text-4xl font-bold text-[#EF4444]">
          {orders.filter(o => o.status === 'invalid').length}
        </div>
      </div>
    </div>
  )
}

export default memo(ACMEStatsGrid)
