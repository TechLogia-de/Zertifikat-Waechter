import type { ReportConfig, ReportStats } from '../../pages/Reports'

interface ReportPreviewProps {
  config: ReportConfig
  stats: ReportStats
  tenantName: string
  userEmail: string | undefined
}

export default function ReportPreview({
  config,
  stats,
  tenantName,
  userEmail,
}: ReportPreviewProps) {
  if (config.format !== 'pdf') {
    return null
  }

  return (
    <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-lg">
          <span className="text-3xl">👁️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">PDF-Report Vorschau</h2>
          <p className="text-sm text-[#64748B]">Was wird im PDF enthalten sein?</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border-l-4 border-[#3B82F6] pl-4">
          <div className="font-semibold text-[#0F172A] mb-1">📄 Seite 1: Titelseite</div>
          <ul className="text-sm text-[#64748B] space-y-1">
            <li>• Report-Titel & Beschreibung</li>
            <li>• Organisation: {tenantName}</li>
            <li>• Erstellungsdatum & Uhrzeit</li>
            <li>• Erstellt von: {userEmail}</li>
          </ul>
        </div>

        <div className="border-l-4 border-[#10B981] pl-4">
          <div className="font-semibold text-[#0F172A] mb-1">📊 Seite 2: Executive Summary</div>
          <ul className="text-sm text-[#64748B] space-y-1">
            <li>• Gesamt-Statistiken ({stats.totalCerts} Zertifikate)</li>
            <li>• Status-Verteilung (Gültig, Ablaufend, Abgelaufen)</li>
            {config.includeCharts && <li>• Visuelles Dashboard mit Pie Charts</li>}
            <li>• Kritische Befunde & Empfehlungen</li>
          </ul>
        </div>

        <div className="border-l-4 border-[#F59E0B] pl-4">
          <div className="font-semibold text-[#0F172A] mb-1">📋 Seite 3+: Zertifikats-Details</div>
          <ul className="text-sm text-[#64748B] space-y-1">
            <li>• Vollständige Tabelle aller Zertifikate</li>
            <li>• Domain, Issuer, Gültigkeitsdauer</li>
            <li>• Tage verbleibend, Key-Algorithmus</li>
            <li>• Fingerprint (SHA-256)</li>
          </ul>
        </div>

        {config.includeAuditLog && (
          <div className="border-l-4 border-[#6366F1] pl-4">
            <div className="font-semibold text-[#0F172A] mb-1">📜 Audit Log</div>
            <ul className="text-sm text-[#64748B] space-y-1">
              <li>• Letzte 50 Events</li>
              <li>• Timestamp, Event-Typ, Details</li>
              {config.includeHashChain && <li>• Hash-Chain Verifizierung</li>}
            </ul>
          </div>
        )}

        {config.includeHashChain && (
          <div className="border-l-4 border-[#10B981] pl-4">
            <div className="font-semibold text-[#0F172A] mb-1">🔒 Hash-Chain Verifizierung</div>
            <ul className="text-sm text-[#64748B] space-y-1">
              <li>• SHA-256 Hash-Kette aller Events</li>
              <li>• Nachweis der Unveränderlichkeit</li>
              <li>• Audit-Trail Validierung</li>
              <li>• Compliance-konform (ISO 27001, DSGVO)</li>
            </ul>
          </div>
        )}

        <div className="border-l-4 border-[#64748B] pl-4">
          <div className="font-semibold text-[#0F172A] mb-1">🔏 Signatur & Metadaten</div>
          <ul className="text-sm text-[#64748B] space-y-1">
            <li>• Report-Hash (SHA-256)</li>
            <li>• Generierungs-Zeitstempel</li>
            <li>• System-Version</li>
            <li>• Unveränderlichkeits-Nachweis</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
