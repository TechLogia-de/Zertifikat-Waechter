import Badge from '../../ui/Badge'
import { Connector } from './types'
import { getStatusBadge, formatLastSeen } from './utils'

interface ConnectorCardProps {
  connector: Connector
  deleting: string | null
  onShowSetup: (connector: Connector) => void
  onTriggerScan: (connectorId: string) => void
  onEditConnector: (connector: Connector) => void
  onDeleteConnector: (connectorId: string) => void
}

export default function ConnectorCard({
  connector,
  deleting,
  onShowSetup,
  onTriggerScan,
  onEditConnector,
  onDeleteConnector,
}: ConnectorCardProps) {
  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-4 md:p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3 md:gap-4 flex-1">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xl md:text-2xl">🤖</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-base md:text-lg font-bold text-[#0F172A] truncate">
                {connector.name}
              </h3>
              {getStatusBadge(connector.status)}
            </div>
            <div className="text-sm text-[#64748B] space-y-2">
              {/* Status Info mit Activity Indicator */}
              <div className="flex items-center gap-2">
                {connector.status === 'active' ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-700 font-medium">Verbunden</span>
                    <span className="text-[#94A3B8]">•</span>
                    <span>{formatLastSeen(connector.last_seen)}</span>
                    {connector.config?.scanning && (
                      <>
                        <span className="text-[#94A3B8]">•</span>
                        <span className="text-blue-600 font-medium animate-pulse">🔍 Scannt...</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600 font-medium">Offline</span>
                    <span className="text-[#94A3B8]">•</span>
                    <span>{formatLastSeen(connector.last_seen)}</span>
                  </>
                )}
              </div>

              {/* Scan Progress - nur anzeigen wenn aktiv am Scannen */}
              {connector.config?.scanning && connector.config?.scan_progress && connector.config.scan_progress.total > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[#0F172A] font-semibold flex items-center gap-1">
                      <span className="animate-spin">🔄</span>
                      Scanning läuft...
                    </span>
                    <span className="text-blue-600 font-bold">
                      {Math.round((connector.config.scan_progress.current / connector.config.scan_progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-2 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${(connector.config.scan_progress.current / connector.config.scan_progress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {connector.config.scan_progress.current} / {connector.config.scan_progress.total} Hosts
                  </div>
                </div>
              )}

              {/* Scan Configuration - Kompakt für Mobile */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {connector.config?.scan_targets && connector.config.scan_targets[0] !== 'localhost' ? (
                  <span className="text-[#0F172A]">
                    <span className="text-[#94A3B8]">Targets:</span>{' '}
                    <span className="font-medium">{connector.config.scan_targets.length} Host(s)</span>
                  </span>
                ) : (
                  <span className="text-[#0F172A]">
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold">
                      🧠 Auto-Discovery
                    </span>
                  </span>
                )}
                {connector.config?.scan_ports && (
                  <span className="text-[#0F172A]">
                    <span className="text-[#94A3B8]">•</span>{' '}
                    <span className="font-medium">{connector.config.scan_ports.length} Port(s)</span>
                  </span>
                )}
              </div>

              {/* Scan Statistiken */}
              {connector.config?.last_scan && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#0F172A] font-medium">Letzter Scan:</span>
                    <span className="text-[#64748B]">
                      {formatLastSeen(connector.config.last_scan.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-green-700">
                      ✓ {connector.config.last_scan.success} erfolgreich
                    </span>
                    {connector.config.last_scan.failed > 0 && (
                      <span className="text-red-700">
                        ✗ {connector.config.last_scan.failed} fehlgeschlagen
                      </span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-[#94A3B8] pt-1 border-t border-[#E2E8F0]">
                Erstellt: {new Date(connector.created_at).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} (Lokale Zeit)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onShowSetup(connector)}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-all shadow-md hover:shadow-lg"
            title="Details und Scan-Results anzeigen"
          >
            📊 Details
          </button>
          <button
            onClick={() => onTriggerScan(connector.id)}
            disabled={connector.status !== 'active'}
            className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-green-200"
            title={connector.status === 'active' ? 'Scan jetzt ausführen' : 'Agent muss online sein'}
          >
            🔄
          </button>
          <button
            onClick={() => onEditConnector(connector)}
            className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
            title="Einstellungen bearbeiten"
          >
            ⚙️
          </button>
          <button
            onClick={() => onDeleteConnector(connector.id)}
            disabled={deleting === connector.id}
            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 border border-red-200"
            title="Agent löschen"
          >
            {deleting === connector.id ? '⏳' : '🗑️'}
          </button>
        </div>
      </div>
    </div>
  )
}
