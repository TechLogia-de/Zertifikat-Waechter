import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import LoadingState from '../components/ui/LoadingState'
import { useAuditLog, AuditEventTypes } from '../hooks/useAuditLog'
import PageInfoBox from '../components/ui/PageInfoBox'

interface SSLCheck {
  id: string
  asset_id: string
  certificate_id: string
  tls_version: string
  supported_protocols: string[]
  cipher_suites: string[]
  overall_score: number
  protocol_score: number
  cipher_strength_score: number
  vulnerabilities: string[]
  has_weak_ciphers: boolean
  has_deprecated_protocols: boolean
  supports_forward_secrecy: boolean
  checked_at: string
  assets?: {
    host: string
    port: number
  }
}

interface HealthSummary {
  total_checks: number
  avg_score: number
  critical_issues: number
  weak_ciphers: number
  deprecated_protocols: number
}

export default function SSLHealth() {
  const { user } = useAuth()
  const { tenantId: currentTenantId } = useTenantId()
  const { logAction } = useAuditLog()
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState<SSLCheck[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<SSLCheck | null>(null)

  useEffect(() => {
    if (currentTenantId) {
      fetchSSLChecks()
      fetchSummary()
    }
  }, [currentTenantId])

  async function fetchSSLChecks() {
    try {
      const { data, error } = await supabase
        .from('ssl_checks')
        .select(`
          *,
          assets (
            host,
            port
          )
        `)
        .eq('tenant_id', currentTenantId)
        .order('checked_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setChecks(data || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSummary() {
    try {
      const { data, error } = await supabase
        .rpc('get_ssl_health_summary', { tenant_uuid: currentTenantId })

      if (error) throw error
      if (data && data.length > 0) {
        setSummary(data[0])
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zusammenfassung:', error)
    }
  }

  async function runHealthCheck(assetId: string, host: string, port: number) {
    try {
      setLoading(true)
      
      // Log: Check started
      await logAction(currentTenantId!, AuditEventTypes.SSL_HEALTH_CHECK_STARTED, {
        asset_id: assetId,
        host,
        port
      })
      
      const { data, error } = await supabase.functions.invoke('ssl-health-check', {
        body: { asset_id: assetId, host, port }
      })

      if (error) throw error

      if (data?.success) {
        alert(`✅ SSL Health Check abgeschlossen!\n\nScore: ${data.data.overall_score}/100\nGrade: ${getScoreGrade(data.data.overall_score)}`)
        fetchSSLChecks()
        fetchSummary()
      } else {
        throw new Error(data?.error || 'Check fehlgeschlagen')
      }
    } catch (error: any) {
      console.error('Health Check Fehler:', error)
      alert(`❌ Fehler beim Health Check:\n\n${error.message || 'Unbekannter Fehler'}`)
    } finally {
      setLoading(false)
    }
  }

  async function runBulkHealthChecks() {
    try {
      // Hole alle Assets die einen Check brauchen
      const { data: assetsNeedingCheck, error } = await supabase
        .rpc('get_assets_needing_ssl_check', { 
          p_tenant_id: currentTenantId,
          p_max_age_days: 7 
        })

      if (error) throw error

      if (!assetsNeedingCheck || assetsNeedingCheck.length === 0) {
        alert('✅ Alle Assets wurden kürzlich geprüft!')
        return
      }

      const confirmed = confirm(
        `${assetsNeedingCheck.length} Assets brauchen einen SSL Health Check.\n\n` +
        `Möchtest du alle jetzt prüfen? (Dauer: ca. ${assetsNeedingCheck.length * 5}s)`
      )

      if (!confirmed) return

      // Log: Bulk check started
      await logAction(currentTenantId!, AuditEventTypes.SSL_HEALTH_BULK_STARTED, {
        asset_count: assetsNeedingCheck.length
      })

      setLoading(true)
      let successCount = 0
      let errorCount = 0

      // Process checks with a concurrency limit of 5
      const CONCURRENCY_LIMIT = 5
      for (let i = 0; i < assetsNeedingCheck.length; i += CONCURRENCY_LIMIT) {
        const batch = assetsNeedingCheck.slice(i, i + CONCURRENCY_LIMIT)
        const results = await Promise.allSettled(
          batch.map(async (asset: any) => {
            const { error } = await supabase.functions.invoke('ssl-health-check', {
              body: {
                asset_id: asset.asset_id,
                host: asset.host,
                port: asset.port
              }
            })
            if (error) throw error
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            errorCount++
          }
        }

        // Short pause between batches to avoid overload
        if (i + CONCURRENCY_LIMIT < assetsNeedingCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      alert(
        `✅ Bulk Health Check abgeschlossen!\n\n` +
        `Erfolgreich: ${successCount}\n` +
        `Fehler: ${errorCount}`
      )

      fetchSSLChecks()
      fetchSummary()
    } catch (error: any) {
      console.error('Bulk Check Fehler:', error)
      alert(`❌ Fehler beim Bulk Check:\n\n${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  function getScoreGrade(score: number): string {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  }

  if (loading) return <LoadingState />

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                <span className="text-xl sm:text-2xl">🔐</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">SSL/TLS Health Dashboard</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
              Detaillierte Analyse • Cipher-Suites • TLS-Versionen • Security-Scores
            </p>
          </div>
          <button
            onClick={runBulkHealthChecks}
            disabled={loading}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <span>{loading ? '⏳ Prüfe...' : '🔍 Alle Assets prüfen'}</span>
          </button>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">

        <PageInfoBox title="SSL/TLS Health - Sicherheitsbewertung" variant="info" collapsible defaultOpen={false}>
          <div className="space-y-3">
            <p className="text-[#1E3A5F]">
              Der SSL/TLS Health Check analysiert die Verschlüsselungskonfiguration Ihrer Assets und bewertet sie
              nach aktuellen Sicherheitsstandards. Führen Sie regelmäßige Prüfungen durch, um Schwachstellen
              frühzeitig zu erkennen.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Score-Bewertung (0-100)</h4>
                <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                  <li><strong>A+ (90-100):</strong> Exzellent - modernste Konfiguration</li>
                  <li><strong>A (80-89):</strong> Sehr gut - sichere Standardkonfiguration</li>
                  <li><strong>B (70-79):</strong> Gut - kleinere Verbesserungen empfohlen</li>
                  <li><strong>C (60-69):</strong> Ausreichend - Handlungsbedarf vorhanden</li>
                  <li><strong>D/F (unter 60):</strong> Mangelhaft - dringender Handlungsbedarf</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Einflussfaktoren auf den Score</h4>
                <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                  <li><strong>Protokoll-Score:</strong> TLS 1.3 bevorzugt, TLS 1.0/1.1 abgestraft</li>
                  <li><strong>Cipher-Score:</strong> Stärke der verwendeten Verschlüsselungsalgorithmen</li>
                  <li><strong>Forward Secrecy:</strong> Schutz vergangener Sitzungen bei Key-Kompromittierung</li>
                  <li><strong>Schwachstellen:</strong> Bekannte Sicherheitslücken (BEAST, POODLE, etc.)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Score verbessern</h4>
                <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                  <li>TLS 1.2 als Minimum konfigurieren, TLS 1.3 aktivieren</li>
                  <li>Schwache Cipher-Suites (RC4, DES, 3DES) deaktivieren</li>
                  <li>Forward Secrecy mit ECDHE-Cipher-Suites sicherstellen</li>
                  <li>Veraltete Protokolle (SSLv3, TLS 1.0, TLS 1.1) deaktivieren</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Empfohlene Prüfzyklen</h4>
                <ul className="text-xs space-y-1 list-disc list-inside text-[#1E3A5F]">
                  <li>Reguläre Prüfung alle 7 Tage empfohlen</li>
                  <li>Nach Konfigurationsänderungen sofort prüfen</li>
                  <li>Bulk-Check: Alle Assets gleichzeitig prüfen (oben rechts)</li>
                  <li>Ergebnisse werden im Audit Log protokolliert</li>
                </ul>
              </div>
            </div>
          </div>
        </PageInfoBox>

        {/* Summary with Score Gauge */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Score Gauge */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
              <div className="text-sm text-gray-600 mb-3 font-semibold">Gesamt-Bewertung</div>
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  {/* Background circle */}
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                  {/* Score arc */}
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke={
                      (summary.avg_score || 0) >= 80 ? '#10B981' :
                      (summary.avg_score || 0) >= 60 ? '#F59E0B' :
                      (summary.avg_score || 0) >= 40 ? '#F97316' : '#EF4444'
                    }
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${((summary.avg_score || 0) / 100) * 314} 314`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-[#0F172A]">
                    {getScoreGrade(summary.avg_score || 0)}
                  </span>
                  <span className="text-sm text-[#64748B] font-medium">
                    {summary.avg_score?.toFixed(0) || '0'}/100
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">{summary.total_checks} Checks durchgeführt</p>
            </div>

            {/* Issue Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 col-span-1 lg:col-span-2">
              <div className="text-sm text-gray-600 mb-4 font-semibold">Sicherheits-Übersicht</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🚨</span>
                    <span className="text-xs font-semibold text-red-700">Kritische Issues</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{summary.critical_issues}</p>
                  <p className="text-[10px] text-red-500 mt-1">Sofort beheben</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⚠️</span>
                    <span className="text-xs font-semibold text-orange-700">Schwache Cipher</span>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{summary.weak_ciphers}</p>
                  <p className="text-[10px] text-orange-500 mt-1">RC4, DES, 3DES</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📉</span>
                    <span className="text-xs font-semibold text-yellow-700">Veraltete Protokolle</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{summary.deprecated_protocols}</p>
                  <p className="text-[10px] text-yellow-600 mt-1">TLS 1.0/1.1, SSLv3</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📊</span>
                    <span className="text-xs font-semibold text-blue-700">Durchschnitt</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{summary.avg_score?.toFixed(0) || '0'}</p>
                  <p className="text-[10px] text-blue-500 mt-1">von 100 Punkten</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score Distribution Bar */}
        {checks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="text-sm text-gray-600 mb-3 font-semibold">Score-Verteilung aller Assets</div>
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
              {(() => {
                const ranges = [
                  { min: 90, max: 101, color: '#10B981', label: 'A+' },
                  { min: 80, max: 90, color: '#34D399', label: 'A' },
                  { min: 70, max: 80, color: '#FBBF24', label: 'B' },
                  { min: 60, max: 70, color: '#F59E0B', label: 'C' },
                  { min: 0, max: 60, color: '#EF4444', label: 'D/F' },
                ]
                const total = checks.length
                return ranges.map((range) => {
                  const count = checks.filter(c => c.overall_score >= range.min && c.overall_score < range.max).length
                  if (count === 0) return null
                  const pct = (count / total) * 100
                  return (
                    <div
                      key={range.label}
                      className="flex items-center justify-center text-white text-[10px] font-bold transition-all duration-500 hover:opacity-90"
                      style={{ backgroundColor: range.color, width: `${pct}%`, minWidth: count > 0 ? '24px' : '0' }}
                      title={`${range.label}: ${count} Assets (${pct.toFixed(0)}%)`}
                    >
                      {pct >= 10 && `${range.label} (${count})`}
                    </div>
                  )
                })
              })()}
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center text-xs text-[#64748B]">
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#10B981]"></div> A+</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#34D399]"></div> A</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#FBBF24]"></div> B</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#F59E0B]"></div> C</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#EF4444]"></div> D/F</div>
            </div>
          </div>
        )}


        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl">💡</span>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">SSL/TLS Health Check</h3>
              <p className="text-sm text-blue-800">
                Analysiert die TLS-Konfiguration deiner Assets und bewertet sie nach Sicherheitsstandards.
                Empfohlen: Prüfung alle 7 Tage.
              </p>
              <div className="mt-2 text-xs text-blue-700">
                <strong>Grade-System:</strong> A+ (90-100) | A (80-89) | B (70-79) | C (60-69) | D (50-59) | F (0-49)
              </div>
            </div>
          </div>
        </div>

        {/* SSL Checks List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">SSL Health Checks</h2>
            <div className="text-sm text-gray-500">
              {checks.length} {checks.length === 1 ? 'Check' : 'Checks'} in den letzten 30 Tagen
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TLS Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Probleme</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forward Secrecy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Geprüft</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Noch keine SSL Health Checks durchgeführt
                    </td>
                  </tr>
                ) : (
                  checks.map((check) => (
                    <tr key={check.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {check.assets?.host || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Port {check.assets?.port || '443'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(check.overall_score)}`}>
                          {check.overall_score}/100
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-gray-900">
                          {getScoreGrade(check.overall_score)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {check.tls_version}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {check.has_weak_ciphers && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
                              Weak Ciphers
                            </span>
                          )}
                          {check.has_deprecated_protocols && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                              Old Protocols
                            </span>
                          )}
                          {!check.has_weak_ciphers && !check.has_deprecated_protocols && (
                            <span className="text-sm text-gray-500">Keine</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {check.supports_forward_secrecy ? (
                          <span className="text-green-600">✓ Ja</span>
                        ) : (
                          <span className="text-red-600">✗ Nein</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(check.checked_at).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedCheck(check)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Modal */}
        {selectedCheck && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-semibold">SSL Health Details</h3>
                <button
                  onClick={() => setSelectedCheck(null)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Scores */}
                <div>
                  <h4 className="font-semibold mb-3">Bewertung</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{selectedCheck.overall_score}</div>
                      <div className="text-sm text-gray-600">Gesamt</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedCheck.protocol_score}</div>
                      <div className="text-sm text-gray-600">Protokoll</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{selectedCheck.cipher_strength_score}</div>
                      <div className="text-sm text-gray-600">Cipher</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{getScoreGrade(selectedCheck.overall_score)}</div>
                      <div className="text-sm text-gray-600">Grade</div>
                    </div>
                  </div>
                </div>

                {/* Supported Protocols */}
                <div>
                  <h4 className="font-semibold mb-3">Unterstützte Protokolle</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCheck.supported_protocols.map((protocol, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {protocol}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Cipher Suites */}
                <div>
                  <h4 className="font-semibold mb-3">Cipher Suites</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {selectedCheck.cipher_suites.map((cipher, idx) => (
                      <div key={idx} className="text-sm text-gray-700 font-mono py-1">
                        {cipher}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vulnerabilities */}
                {selectedCheck.vulnerabilities.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-red-600">Sicherheitsprobleme</h4>
                    <div className="space-y-2">
                      {selectedCheck.vulnerabilities.map((vuln, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                          <span className="text-red-600">⚠</span>
                          <span className="text-sm text-red-700">{vuln}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Features */}
                <div>
                  <h4 className="font-semibold mb-3">Sicherheitsfeatures</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">Forward Secrecy</span>
                      <span className={selectedCheck.supports_forward_secrecy ? 'text-green-600' : 'text-red-600'}>
                        {selectedCheck.supports_forward_secrecy ? '✓ Aktiv' : '✗ Inaktiv'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">Schwache Ciphers</span>
                      <span className={selectedCheck.has_weak_ciphers ? 'text-red-600' : 'text-green-600'}>
                        {selectedCheck.has_weak_ciphers ? '✗ Gefunden' : '✓ Keine'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">Veraltete Protokolle</span>
                      <span className={selectedCheck.has_deprecated_protocols ? 'text-red-600' : 'text-green-600'}>
                        {selectedCheck.has_deprecated_protocols ? '✗ Gefunden' : '✓ Keine'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

