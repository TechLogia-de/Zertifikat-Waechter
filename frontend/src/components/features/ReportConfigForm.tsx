import { memo } from 'react'
import type { ReportConfig, ReportStats } from '../../pages/Reports'

interface ReportConfigFormProps {
  config: ReportConfig
  setConfig: (config: ReportConfig) => void
  stats: ReportStats
  tenantName: string
  generating: boolean
  onGenerate: () => void
}

function ReportConfigForm({
  config,
  setConfig,
  stats,
  tenantName,
  generating,
  onGenerate,
}: ReportConfigFormProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-lg">
          <span className="text-3xl">⚙️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">Report-Konfiguration</h2>
          <p className="text-sm text-[#64748B]">Passe den Report an deine Bedürfnisse an</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Titel & Beschreibung */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Report-Titel
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Organisation
            </label>
            <input
              type="text"
              value={tenantName}
              disabled
              className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-lg text-[#64748B]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Beschreibung
          </label>
          <textarea
            value={config.description}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
          />
        </div>

        {/* Inhalt auswählen */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-3">
            Zertifikate einschließen
          </label>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="flex items-center gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors">
              <input
                type="checkbox"
                checked={config.includeValid}
                onChange={(e) => setConfig({ ...config, includeValid: e.target.checked })}
                className="w-5 h-5 text-[#10B981] rounded"
              />
              <div>
                <div className="font-semibold text-[#0F172A]">✅ Gültige</div>
                <div className="text-xs text-[#64748B]">{stats.valid} Zertifikate</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors">
              <input
                type="checkbox"
                checked={config.includeExpiring}
                onChange={(e) => setConfig({ ...config, includeExpiring: e.target.checked })}
                className="w-5 h-5 text-[#F59E0B] rounded"
              />
              <div>
                <div className="font-semibold text-[#0F172A]">⏰ Bald ablaufend</div>
                <div className="text-xs text-[#64748B]">{stats.expiring} Zertifikate</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors">
              <input
                type="checkbox"
                checked={config.includeExpired}
                onChange={(e) => setConfig({ ...config, includeExpired: e.target.checked })}
                className="w-5 h-5 text-[#EF4444] rounded"
              />
              <div>
                <div className="font-semibold text-[#0F172A]">🚨 Abgelaufen</div>
                <div className="text-xs text-[#64748B]">{stats.expired} Zertifikate</div>
              </div>
            </label>
          </div>
        </div>

        {/* Zusätzliche Optionen */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-3">
            Zusätzliche Inhalte
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors">
              <input
                type="checkbox"
                checked={config.includeCharts}
                onChange={(e) => setConfig({ ...config, includeCharts: e.target.checked })}
                className="w-5 h-5 text-[#3B82F6] rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-[#0F172A]">📊 Diagramme & Statistiken</div>
                <div className="text-xs text-[#64748B]">Ablauf-Timeline, Issuer-Verteilung, Status-Übersicht</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors">
              <input
                type="checkbox"
                checked={config.includeAuditLog}
                onChange={(e) => setConfig({ ...config, includeAuditLog: e.target.checked })}
                className="w-5 h-5 text-[#6366F1] rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-[#0F172A]">📋 Audit Log (letzte 50 Events)</div>
                <div className="text-xs text-[#64748B]">{stats.events} Events verfügbar</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 border-[#10B981] rounded-lg cursor-pointer hover:border-[#059669] bg-[#D1FAE5] transition-colors">
              <input
                type="checkbox"
                checked={config.includeHashChain}
                onChange={(e) => setConfig({ ...config, includeHashChain: e.target.checked })}
                className="w-5 h-5 text-[#10B981] rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-[#065F46] flex items-center gap-2">
                  🔒 Kryptographische Hash-Chain Verifizierung
                  <span className="px-2 py-0.5 bg-[#10B981] text-white text-xs rounded-full">
                    Empfohlen
                  </span>
                </div>
                <div className="text-xs text-[#047857]">
                  SHA-256 Hash-Kette zum Nachweis der Unveränderlichkeit (Audit-Sicherheit)
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Schwellenwert */}
        {config.includeExpiring && (
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              "Bald ablaufend" Schwellenwert
            </label>
            <select
              value={config.daysThreshold}
              onChange={(e) => setConfig({ ...config, daysThreshold: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
            >
              <option value="7">7 Tage</option>
              <option value="14">14 Tage</option>
              <option value="30">30 Tage</option>
              <option value="60">60 Tage</option>
              <option value="90">90 Tage</option>
            </select>
          </div>
        )}

        {/* Format wählen */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-3">
            Export-Format
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <div
              onClick={() => setConfig({ ...config, format: 'pdf' })}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                config.format === 'pdf'
                  ? 'border-[#3B82F6] bg-[#DBEAFE]'
                  : 'border-[#E2E8F0] hover:border-[#3B82F6]'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={config.format === 'pdf'}
                  onChange={() => setConfig({ ...config, format: 'pdf' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-[#0F172A] mb-1">
                    📄 PDF (Empfohlen)
                  </h4>
                  <p className="text-sm text-[#64748B] mb-2">
                    Professioneller Report für Audits und Management
                  </p>
                  <div className="bg-white rounded p-2 text-xs space-y-1">
                    <p className="text-[#10B981]">✅ Inkludiert:</p>
                    <ul className="ml-4 text-[#64748B]">
                      <li>• Logo & Corporate Design</li>
                      <li>• Charts & Diagramme</li>
                      <li>• Zertifikats-Tabellen</li>
                      <li>• Hash-Chain Verifizierung</li>
                      <li>• Digitale Signatur</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => setConfig({ ...config, format: 'csv' })}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                config.format === 'csv'
                  ? 'border-[#3B82F6] bg-[#DBEAFE]'
                  : 'border-[#E2E8F0] hover:border-[#3B82F6]'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={config.format === 'csv'}
                  onChange={() => setConfig({ ...config, format: 'csv' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-[#0F172A] mb-1">
                    📊 CSV
                  </h4>
                  <p className="text-sm text-[#64748B] mb-2">
                    Für Excel, Datenbanken und Skripte
                  </p>
                  <div className="bg-white rounded p-2 text-xs space-y-1">
                    <p className="text-[#10B981]">✅ Vorteile:</p>
                    <ul className="ml-4 text-[#64748B]">
                      <li>• Excel-kompatibel</li>
                      <li>• Leicht zu verarbeiten</li>
                      <li>• Kleine Dateigröße</li>
                      <li>• Schnelle Generierung</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerate}
          disabled={generating || stats.totalCerts === 0}
          className="w-full px-8 py-4 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-xl font-bold text-lg hover:from-[#059669] hover:to-[#047857] disabled:opacity-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generiere {config.format.toUpperCase()}...
            </span>
          ) : (
            `📥 ${config.format === 'pdf' ? 'PDF-Report' : 'CSV-Export'} generieren`
          )}
        </button>

        {stats.totalCerts === 0 && (
          <div className="bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] px-4 py-3 rounded-lg text-sm">
            ⚠️ Noch keine Zertifikate vorhanden! Scanne erst Domains um einen Report zu erstellen.
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ReportConfigForm)
