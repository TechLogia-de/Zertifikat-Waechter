import type { ReportStats } from '../../pages/Reports'

interface ReportMessagesProps {
  success: string | null
  error: string | null
}

export function ReportMessages({ success, error }: ReportMessagesProps) {
  return (
    <>
      {success && (
        <div className="bg-[#D1FAE5] border-2 border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-start">
            <span className="text-2xl mr-3">✅</span>
            <div>
              <p className="font-bold text-lg mb-1">Erfolg!</p>
              <p className="text-sm whitespace-pre-line">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FEE2E2] border-2 border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-start">
            <span className="text-2xl mr-3">❌</span>
            <div>
              <p className="font-bold text-lg mb-1">Fehler!</p>
              <p className="text-sm whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ReportInfoBox() {
  return (
    <div className="bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-xl p-6 border-2 border-[#3B82F6] shadow-lg">
      <div className="flex items-start space-x-4">
        <div className="text-5xl animate-bounce">📄</div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#1E40AF] mb-2">
            Was sind Compliance Reports?
          </h2>
          <p className="text-[#1E3A8A] leading-relaxed mb-3">
            Professionelle Audit-Berichte für ISO 27001, DSGVO, und andere Compliance-Standards.
            Dokumentiere den Status aller SSL/TLS-Zertifikate mit unveränderlicher Hash-Chain Verifizierung.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
              <div className="font-semibold text-[#1E40AF] mb-1">📄 PDF Report</div>
              <div className="text-[#475569]">
                Schön formatiert mit Logo, Charts, Tabellen und Hash-Chain Verifizierung
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
              <div className="font-semibold text-[#1E40AF] mb-1">📊 CSV Export</div>
              <div className="text-[#475569]">
                Maschinenlesbar für Excel, Datenbanken und weitere Verarbeitung
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ReportStatsCardsProps {
  stats: ReportStats
}

export function ReportStatsCards({ stats }: ReportStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Zertifikate gesamt</div>
        <div className="text-4xl font-bold text-[#3B82F6]">{stats.totalCerts}</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Gültig</div>
        <div className="text-4xl font-bold text-[#10B981]">{stats.valid}</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Bald ablaufend</div>
        <div className="text-4xl font-bold text-[#F59E0B]">{stats.expiring}</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
        <div className="text-sm text-[#64748B] mb-1 font-semibold">Abgelaufen</div>
        <div className="text-4xl font-bold text-[#EF4444]">{stats.expired}</div>
      </div>
    </div>
  )
}
