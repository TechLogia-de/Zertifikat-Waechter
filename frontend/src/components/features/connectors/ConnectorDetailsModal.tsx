import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { Connector } from './types'
import { getStatusBadge, formatLastSeen, maskToken, getSetupCommand } from './utils'

interface ConnectorDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  connector: Connector
  activityLog: string[]
  discoveryResults: any[]
  connectorAssets: any[]
  connectorCertificates: any[]
  loadingDetails: boolean
  showFullToken: string | null
  onToggleFullToken: () => void
  copiedIndex: number | null
  onCopyToClipboard: (text: string, index: number) => void
  onRegenerateToken: (connectorId: string) => void
}

export default function ConnectorDetailsModal({
  isOpen,
  onClose,
  connector,
  activityLog,
  discoveryResults,
  connectorAssets,
  connectorCertificates,
  loadingDetails,
  showFullToken,
  onToggleFullToken,
  copiedIndex,
  onCopyToClipboard,
  onRegenerateToken,
}: ConnectorDetailsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📊 Agent Details: ${connector.name}`}
    >
      <div className="space-y-4">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h4 className="font-semibold text-[#0F172A] mb-1">
                Setup-Informationen
              </h4>
              <p className="text-sm text-[#64748B]">
                Dies sind die Einstellungen für diesen Agent.
                <strong className="text-red-600"> Der Token wurde aus Sicherheitsgründen bereits gelöscht.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        {activityLog.length > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-[#0F172A]">🔴 Live Activity</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
              {activityLog.map((log, idx) => (
                <div key={idx} className="text-[#64748B] animate-fade-in">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Übersicht */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="text-2xl mb-1">🤖</div>
            <div className="text-sm text-[#64748B]">Status</div>
            <div className="mt-1">{getStatusBadge(connector.status)}</div>
            <div className="text-xs text-[#64748B] mt-1">
              {formatLastSeen(connector.last_seen)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="text-2xl mb-1">🌐</div>
            <div className="text-sm text-[#64748B]">Hosts entdeckt</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">
              {discoveryResults.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <div className="text-2xl mb-1">🔐</div>
            <div className="text-sm text-[#64748B]">Zertifikate</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">
              {connectorCertificates.length}
            </div>
          </div>
        </div>

        {/* Discovery Results (Network Scan) */}
        {loadingDetails ? (
          <div className="text-center py-4 text-[#64748B]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
            Lade Details...
          </div>
        ) : discoveryResults.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-[#0F172A]">🌐 Netzwerk-Scan Ergebnisse</h4>
              <span className="text-xs text-[#64748B]">
                Letzte Aktualisierung: {new Date(discoveryResults[0]?.discovered_at).toLocaleString('de-DE')}
              </span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {discoveryResults.map((result) => (
                <div key={result.id} className="bg-white rounded-lg p-4 border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-[#0F172A]">{result.host}</span>
                      {result.ip_address !== result.host && (
                        <span className="text-sm text-[#64748B] ml-2">({result.ip_address})</span>
                      )}
                    </div>
                    <span className="text-xs text-[#64748B]">
                      {result.response_time}ms
                    </span>
                  </div>

                  {/* Offene Ports */}
                  <div className="mb-2">
                    <span className="text-xs font-medium text-[#64748B]">Offene Ports:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.open_ports?.map((port: number, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono"
                        >
                          {port}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Services */}
                  {result.services && result.services.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-[#64748B]">Services:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.services.map((service: string, idx: number) => (
                          <Badge key={idx} variant="info">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Assets Liste */}
        {loadingDetails ? (
          <div className="text-center py-4 text-[#64748B]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
            Lade Details...
          </div>
        ) : connectorAssets.length > 0 ? (
          <div>
            <h4 className="font-semibold text-[#0F172A] mb-2">📡 Gescannte Assets</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {connectorAssets.map((asset) => (
                <div key={asset.id} className="bg-[#F8FAFC] rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#0F172A]">
                      {asset.host}:{asset.port}
                    </span>
                    <Badge variant={asset.status === 'active' ? 'success' : 'neutral'}>
                      {asset.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">
                    Protocol: {asset.proto} • Erstellt: {new Date(asset.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Certificates Vorschau */}
        {connectorCertificates.length > 0 && (
          <div>
            <h4 className="font-semibold text-[#0F172A] mb-2">🔐 Zertifikate (letzte 10)</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {connectorCertificates.map((cert) => {
                const daysLeft = Math.floor((new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={cert.id} className="bg-[#F8FAFC] rounded-lg p-3 text-sm border border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[#0F172A]">{cert.subject_cn}</span>
                      <Badge variant={daysLeft < 30 ? 'warning' : 'success'}>
                        {daysLeft} Tage
                      </Badge>
                    </div>
                    <div className="text-xs text-[#64748B]">
                      Issuer: {cert.issuer} • Gültig bis: {new Date(cert.not_after).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Token anzeigen/verstecken */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[#0F172A]">
              🔑 Connector Token
            </label>
            <button
              onClick={onToggleFullToken}
              className="px-3 py-1 text-xs font-medium text-[#3B82F6] hover:bg-blue-100 rounded transition-colors"
            >
              {showFullToken === connector.id ? '🙈 Verstecken' : '👁️ Anzeigen'}
            </button>
          </div>
          <div className="bg-white rounded px-3 py-2 font-mono text-sm break-all border border-blue-200">
            {showFullToken === connector.id
              ? connector.auth_token
              : maskToken(connector.auth_token)}
          </div>
          {showFullToken === connector.id && (
            <p className="text-xs text-orange-600 mt-2 font-medium">
              ⚠️ Token ist sichtbar! Teile ihn nicht mit anderen.
            </p>
          )}
        </div>

        {/* Command Template */}
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-2">
            Docker-Befehl
          </label>
          <div className="relative">
            <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono max-h-96">
              {getSetupCommand(connector, showFullToken === connector.id)}
            </pre>
            <button
              onClick={() => onCopyToClipboard(getSetupCommand(connector, true), 99)}
              className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
              title="Kopiert mit echtem Token!"
            >
              {copiedIndex === 99 ? '✓ Kopiert!' : '📋 Kopieren'}
            </button>
        </div>
          <p className="text-xs text-[#64748B] mt-2">
            💡 Der Kopieren-Button kopiert den Befehl mit dem <strong>echten Token</strong> (auch wenn maskiert angezeigt).
        </p>
      </div>

        {/* Token regenerieren */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-2xl">🔄</span>
            <div className="flex-1">
              <h4 className="font-semibold text-[#0F172A] mb-1">
                Token neu generieren
              </h4>
              <p className="text-sm text-[#64748B] mb-3">
                Wenn der Token kompromittiert wurde oder du den Agent neu installieren musst,
                kannst du einen neuen Token generieren. Der alte wird ungültig.
              </p>
              <button
                onClick={() => {
                  onClose()
                  onRegenerateToken(connector.id)
                }}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors text-sm"
              >
                🔄 Neuen Token generieren
      </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
        >
          Schließen
        </button>
      </div>
    </Modal>
  )
}
