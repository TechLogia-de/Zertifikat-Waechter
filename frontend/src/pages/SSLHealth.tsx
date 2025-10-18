import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingState from '../components/ui/LoadingState'
import { useAuditLog, AuditEventTypes } from '../hooks/useAuditLog'

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
  const { logAction } = useAuditLog()
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState<SSLCheck[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<SSLCheck | null>(null)
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchCurrentTenant()
    }
  }, [user])

  useEffect(() => {
    if (currentTenantId) {
      fetchSSLChecks()
      fetchSummary()
    }
  }, [currentTenantId])

  async function fetchCurrentTenant() {
    const { data } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user?.id)
      .limit(1)
      .single()

    if (data) {
      setCurrentTenantId(data.tenant_id)
    }
  }

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

      for (const asset of assetsNeedingCheck) {
        try {
          const { error } = await supabase.functions.invoke('ssl-health-check', {
            body: { 
              asset_id: asset.asset_id, 
              host: asset.host, 
              port: asset.port 
            }
          })

          if (error) {
            errorCount++
          } else {
            successCount++
          }

          // Kurze Pause zwischen Checks
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch {
          errorCount++
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
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SSL/TLS Health Dashboard</h1>
            <p className="text-gray-600 mt-2">Detaillierte Analyse der SSL/TLS-Konfigurationen</p>
          </div>
          <button
            onClick={runBulkHealthChecks}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Prüfe...' : '🔍 Alle Assets prüfen'}
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-2">Gesamt Checks</div>
              <div className="text-3xl font-bold text-gray-900">{summary.total_checks}</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-2">Durchschn. Score</div>
              <div className="text-3xl font-bold text-blue-600">
                {summary.avg_score?.toFixed(1) || '0.0'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-2">Kritische Issues</div>
              <div className="text-3xl font-bold text-red-600">{summary.critical_issues}</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-2">Schwache Ciphers</div>
              <div className="text-3xl font-bold text-orange-600">{summary.weak_ciphers}</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-2">Veraltete Protokolle</div>
              <div className="text-3xl font-bold text-yellow-600">{summary.deprecated_protocols}</div>
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
    </div>
  )
}

