import { memo, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { Connector } from './types'
import { getStatusBadge, formatLastSeen, maskToken, getSetupCommand } from './utils'

// Device type icon mapping
const deviceIcons: Record<string, string> = {
  'router': '🌐',
  'firewall': '🛡️',
  'switch': '🔀',
  'server': '🖥️',
  'nas': '💾',
  'printer': '🖨️',
  'hypervisor': '☁️',
  'management-controller': '🎛️',
  'access-point': '📡',
  'camera': '📷',
  'voip-device': '📞',
  'network-device': '📟',
  'unknown': '❓',
}

// Device type labels (German)
const deviceLabels: Record<string, string> = {
  'router': 'Router',
  'firewall': 'Firewall',
  'switch': 'Switch',
  'server': 'Server',
  'nas': 'NAS-Speicher',
  'printer': 'Drucker',
  'hypervisor': 'Hypervisor',
  'management-controller': 'Management',
  'access-point': 'Access-Point',
  'camera': 'Kamera',
  'voip-device': 'VoIP-Gerät',
  'network-device': 'Netzwerkgerät',
  'unknown': 'Unbekannt',
}

// Device type badge colors
const deviceColors: Record<string, string> = {
  'router': 'bg-orange-100 text-orange-800 border-orange-200',
  'firewall': 'bg-red-100 text-red-800 border-red-200',
  'switch': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'server': 'bg-blue-100 text-blue-800 border-blue-200',
  'nas': 'bg-violet-100 text-violet-800 border-violet-200',
  'printer': 'bg-amber-100 text-amber-800 border-amber-200',
  'hypervisor': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'management-controller': 'bg-slate-100 text-slate-800 border-slate-200',
  'access-point': 'bg-teal-100 text-teal-800 border-teal-200',
  'camera': 'bg-pink-100 text-pink-800 border-pink-200',
  'voip-device': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'network-device': 'bg-gray-100 text-gray-800 border-gray-200',
  'unknown': 'bg-gray-50 text-gray-600 border-gray-200',
}

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

function ConnectorDetailsModal({
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
  // Compute device type stats
  const deviceStats = useMemo(() => {
    const counts: Record<string, number> = {}
    let gateways = 0
    for (const r of discoveryResults) {
      const dt = r.device_type || 'unknown'
      counts[dt] = (counts[dt] || 0) + 1
      if (r.is_gateway) gateways++
    }
    return { counts, gateways }
  }, [discoveryResults])

  // Scan progress from connector config
  const scanProgress = connector.config?.scan_progress
  const isScanning = connector.config?.scanning

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📊 Agent Details: ${connector.name}`}
    >
      <div className="space-y-4">
        {/* Scan Progress Bar - nur wenn aktiv */}
        {isScanning && scanProgress && scanProgress.total > 0 && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-xl p-4 border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="font-bold text-[#0F172A] text-sm">Scan läuft...</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {scanProgress.percentage || Math.round((scanProgress.current / scanProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white rounded-full h-3 shadow-inner mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 h-3 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span>{scanProgress.status}</span>
              <span>{scanProgress.current} / {scanProgress.total}</span>
            </div>
          </div>
        )}

        {/* Live Activity Feed */}
        {activityLog.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="font-bold text-white text-sm">Live Activity</span>
              <span className="text-xs text-slate-400 ml-auto">{activityLog.length} Einträge</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs">
              {activityLog.map((log, idx) => (
                <div key={idx} className="text-slate-300 leading-relaxed animate-fade-in flex gap-2">
                  <span className="text-slate-500 flex-shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Übersicht - erweitert mit Gerätetypen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
            <div className="text-xl mb-1">🤖</div>
            <div className="text-xs text-[#64748B]">Status</div>
            <div className="mt-1">{getStatusBadge(connector.status)}</div>
            <div className="text-[10px] text-[#64748B] mt-1">
              {formatLastSeen(connector.last_seen)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 border border-purple-200">
            <div className="text-xl mb-1">🌐</div>
            <div className="text-xs text-[#64748B]">Hosts</div>
            <div className="text-xl font-bold text-[#0F172A] mt-1">
              {discoveryResults.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
            <div className="text-xl mb-1">🔐</div>
            <div className="text-xs text-[#64748B]">Zertifikate</div>
            <div className="text-xl font-bold text-[#0F172A] mt-1">
              {connectorCertificates.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 border border-orange-200">
            <div className="text-xl mb-1">🌐</div>
            <div className="text-xs text-[#64748B]">Gateways</div>
            <div className="text-xl font-bold text-[#0F172A] mt-1">
              {deviceStats.gateways}
            </div>
          </div>
        </div>

        {/* Device Type Distribution */}
        {Object.keys(deviceStats.counts).length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
            <h4 className="font-bold text-[#0F172A] mb-3 text-sm flex items-center gap-2">
              🏷️ Erkannte Gerätetypen
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(deviceStats.counts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    key={type}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${deviceColors[type] || deviceColors.unknown}`}
                  >
                    <span>{deviceIcons[type] || '❓'}</span>
                    <span>{deviceLabels[type] || type}</span>
                    <span className="font-bold ml-0.5">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Scan Phases Timeline */}
        {(discoveryResults.length > 0 || isScanning) && (
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
            <h4 className="font-bold text-[#0F172A] mb-3 text-sm">📋 Scan-Phasen</h4>
            <div className="flex items-center justify-between gap-1">
              {[
                { phase: 'init', label: 'Start', icon: '🚀' },
                { phase: 'discovery', label: 'Host-Scan', icon: '🔍' },
                { phase: 'classification', label: 'Erkennung', icon: '🏷️' },
                { phase: 'tls-scan', label: 'TLS-Analyse', icon: '🔐' },
                { phase: 'completed', label: 'Fertig', icon: '✅' },
              ].map((step, idx) => {
                const currentPhase = isScanning
                  ? (scanProgress?.status?.includes('Netzwerk') ? 'discovery' : scanProgress?.status?.includes('Analysiere') ? 'tls-scan' : 'init')
                  : discoveryResults.length > 0 ? 'completed' : 'init'
                const phases = ['init', 'discovery', 'classification', 'tls-scan', 'completed']
                const currentIdx = phases.indexOf(currentPhase)
                const stepIdx = phases.indexOf(step.phase)
                const isActive = stepIdx === currentIdx
                const isDone = stepIdx < currentIdx
                const isFuture = stepIdx > currentIdx

                return (
                  <div key={step.phase} className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 transition-all duration-500 ${
                      isActive ? 'bg-blue-500 text-white ring-4 ring-blue-200 animate-pulse' :
                      isDone ? 'bg-green-500 text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? '✓' : step.icon}
                    </div>
                    <span className={`text-[9px] font-medium text-center leading-tight ${
                      isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-400'
                    }`}>{step.label}</span>
                    {idx < 4 && (
                      <div className={`absolute h-0.5 w-full ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} style={{display:'none'}}></div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Progress connector line */}
            <div className="mt-2 mx-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-700"
                style={{
                  width: isScanning
                    ? `${scanProgress ? Math.min((scanProgress.current / scanProgress.total) * 100, 95) : 20}%`
                    : discoveryResults.length > 0 ? '100%' : '0%'
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Network Mini-Map */}
        {discoveryResults.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700">
            <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
              🗺️ Netzwerk-Karte
            </h4>
            <div className="relative w-full" style={{ height: '260px' }}>
              <svg viewBox="0 0 600 260" className="w-full h-full">
                {/* Connection lines from center to each device */}
                {discoveryResults.slice(0, 20).map((result: any, idx: number) => {
                  const angle = (idx / Math.min(discoveryResults.length, 20)) * Math.PI * 2 - Math.PI / 2
                  const radiusX = 220
                  const radiusY = 100
                  const x = 300 + Math.cos(angle) * radiusX
                  const y = 130 + Math.sin(angle) * radiusY
                  return (
                    <line key={`line-${idx}`} x1="300" y1="130" x2={x} y2={y}
                      stroke={result.is_gateway ? '#FBBF24' : '#475569'} strokeWidth={result.is_gateway ? 2 : 1}
                      strokeDasharray={result.is_gateway ? '' : '4 4'} opacity={0.5} />
                  )
                })}
                {/* Device nodes */}
                {discoveryResults.slice(0, 20).map((result: any, idx: number) => {
                  const angle = (idx / Math.min(discoveryResults.length, 20)) * Math.PI * 2 - Math.PI / 2
                  const radiusX = 220
                  const radiusY = 100
                  const x = 300 + Math.cos(angle) * radiusX
                  const y = 130 + Math.sin(angle) * radiusY
                  const devType = result.device_type || 'unknown'
                  const nodeColors: Record<string, string> = {
                    router: '#F97316', firewall: '#EF4444', server: '#3B82F6', nas: '#8B5CF6',
                    printer: '#F59E0B', hypervisor: '#6366F1', switch: '#06B6D4',
                    'access-point': '#14B8A6', 'network-device': '#64748B', unknown: '#94A3B8',
                    'management-controller': '#475569', camera: '#EC4899', 'voip-device': '#10B981',
                  }
                  const color = nodeColors[devType] || '#94A3B8'
                  const nodeIcons: Record<string, string> = {
                    router: '🌐', firewall: '🛡️', server: '🖥️', nas: '💾', printer: '🖨️',
                    hypervisor: '☁️', switch: '🔀', 'access-point': '📡', camera: '📷',
                    'voip-device': '📞', 'network-device': '📟', 'management-controller': '🎛️', unknown: '❓',
                  }
                  return (
                    <g key={`node-${idx}`}>
                      <circle cx={x} cy={y} r={result.is_gateway ? 20 : 16}
                        fill={color} opacity={0.9} stroke={result.is_gateway ? '#FBBF24' : 'none'} strokeWidth={result.is_gateway ? 3 : 0} />
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central"
                        fontSize="12" className="select-none">{nodeIcons[devType] || '❓'}</text>
                      <text x={x} y={y + 28} textAnchor="middle" fill="#94A3B8" fontSize="8"
                        className="select-none">{result.hostname?.split('.')[0] || result.ip_address}</text>
                    </g>
                  )
                })}
                {/* Center node (Scanner) */}
                <circle cx="300" cy="130" r="24" fill="#3B82F6" stroke="#60A5FA" strokeWidth="3" />
                <text x="300" y="131" textAnchor="middle" dominantBaseline="central" fontSize="16" className="select-none">🤖</text>
                <text x="300" y="160" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold" className="select-none">AGENT</text>
              </svg>
              {discoveryResults.length > 20 && (
                <div className="absolute bottom-1 right-2 text-[10px] text-slate-500">
                  +{discoveryResults.length - 20} weitere Geräte
                </div>
              )}
            </div>
          </div>
        )}

        {/* Discovery Results (Network Scan) - Enhanced */}
        {loadingDetails ? (
          <div className="text-center py-6 text-[#64748B]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6] mx-auto mb-2"></div>
            Lade Details...
          </div>
        ) : discoveryResults.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                🌐 Netzwerk-Scan Ergebnisse
              </h4>
              <span className="text-[10px] text-[#64748B]">
                {new Date(discoveryResults[0]?.discovered_at).toLocaleString('de-DE')}
              </span>
            </div>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {discoveryResults.map((result) => {
                const devType = result.device_type || 'unknown'
                const icon = deviceIcons[devType] || '❓'
                const colorClass = deviceColors[devType] || deviceColors.unknown
                return (
                  <div key={result.id} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0F172A]">
                              {result.hostname || result.host}
                            </span>
                            {result.hostname && result.ip_address !== result.hostname && (
                              <span className="text-xs text-[#94A3B8] font-mono">{result.ip_address}</span>
                            )}
                            {!result.hostname && result.ip_address !== result.host && (
                              <span className="text-xs text-[#94A3B8] font-mono">({result.ip_address})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${colorClass}`}>
                              {icon} {deviceLabels[devType] || devType}
                            </span>
                            {result.os_type && result.os_type !== 'unknown' && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded font-medium border border-slate-200">
                                OS: {result.os_type}
                              </span>
                            )}
                            {result.is_gateway && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] rounded font-bold border border-yellow-200">
                                ⭐ Gateway
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#94A3B8] whitespace-nowrap ml-2">
                        {result.response_time}ms
                      </span>
                    </div>

                    {/* Banner Info */}
                    {result.banner_info && (
                      <div className="mb-2 px-2 py-1 bg-slate-50 rounded text-[10px] text-slate-600 font-mono truncate border border-slate-100">
                        Banner: {result.banner_info}
                      </div>
                    )}

                    {/* Offene Ports */}
                    <div className="mb-2">
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Ports ({result.open_ports?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.open_ports?.map((port: number, idx: number) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded font-mono border border-blue-100"
                          >
                            {port}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Services */}
                    {result.services && result.services.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Services:</span>
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
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Assets Liste */}
        {!loadingDetails && connectorAssets.length > 0 && (
          <div>
            <h4 className="font-bold text-[#0F172A] mb-2 text-sm">📡 Gescannte Assets</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {connectorAssets.map((asset) => (
                <div key={asset.id} className="bg-[#F8FAFC] rounded-lg p-3 text-sm border border-[#E2E8F0]">
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
        )}

        {/* Certificates Vorschau */}
        {connectorCertificates.length > 0 && (
          <div>
            <h4 className="font-bold text-[#0F172A] mb-2 text-sm">🔐 Zertifikate</h4>
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

export default memo(ConnectorDetailsModal)
