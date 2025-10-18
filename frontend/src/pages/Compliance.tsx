import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingState from '../components/ui/LoadingState'
import Badge from '../components/ui/Badge'
import { useAuditLog, AuditEventTypes } from '../hooks/useAuditLog'

interface ComplianceStandard {
  id: string
  name: string
  description: string
  requirements: any
}

interface ComplianceCheck {
  id: string
  certificate_id: string
  standard_id: string
  is_compliant: boolean
  violations: any[]
  checked_at: string
  certificates?: {
    subject_cn: string
    not_after: string
  }
  compliance_standards?: {
    name: string
  }
}

interface ComplianceSummary {
  standard: string
  total: number
  compliant: number
  non_compliant: number
  compliance_rate: number
}

export default function Compliance() {
  const { user } = useAuth()
  const { logAction } = useAuditLog()
  const [loading, setLoading] = useState(true)
  const [standards, setStandards] = useState<ComplianceStandard[]>([])
  const [checks, setChecks] = useState<ComplianceCheck[]>([])
  const [summary, setSummary] = useState<ComplianceSummary[]>([])
  const [selectedStandard, setSelectedStandard] = useState<string>('all')
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [riskScore, setRiskScore] = useState<any>(null)
  const [remediationActions, setRemediationActions] = useState<any[]>([])
  const [running, setRunning] = useState(false)
  const [certsNeedingFix, setCertsNeedingFix] = useState<any[]>([])
  const [showAutoFixModal, setShowAutoFixModal] = useState(false)
  const [selectedViolationType, setSelectedViolationType] = useState<string | null>(null)
  const [fixing, setFixing] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCurrentTenant()
    }
  }, [user])

  useEffect(() => {
    if (currentTenantId) {
      fetchStandards()
      fetchComplianceChecks()
      fetchRiskScore()
      fetchRemediationActions()
    }
  }, [currentTenantId])

  async function fetchRiskScore() {
    try {
      const { data, error } = await supabase
        .rpc('get_compliance_risk_score', { p_tenant_id: currentTenantId })

      if (error) throw error
      if (data && data.length > 0) {
        setRiskScore(data[0])
      }
    } catch (error) {
      console.error('Fehler beim Laden des Risk Scores:', error)
    }
  }

  async function fetchRemediationActions() {
    try {
      const { data, error } = await supabase
        .rpc('get_remediation_actions', { p_tenant_id: currentTenantId })

      if (error) throw error
      setRemediationActions(data || [])
    } catch (error) {
      console.error('Fehler beim Laden der Remediation Actions:', error)
    }
  }

  async function openAutoFixModal(violationType: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_certificates_needing_remediation', {
          p_tenant_id: currentTenantId,
          p_violation_type: violationType
        })

      if (error) throw error
      
      setCertsNeedingFix(data || [])
      setSelectedViolationType(violationType)
      setShowAutoFixModal(true)
    } catch (error: any) {
      console.error('Fehler:', error)
      alert(`❌ Fehler: ${error.message}`)
    }
  }

  async function autoFixCertificates() {
    if (!confirm(`Automatische Remediation für ${certsNeedingFix.length} Zertifikate starten?\n\nEs werden neue ACME-Orders mit korrekter Schlüsselgröße erstellt.`)) {
      return
    }

    try {
      setFixing(true)
      
      // Log: Auto-Fix started
      await logAction(currentTenantId!, AuditEventTypes.COMPLIANCE_AUTO_FIX_STARTED, {
        certificate_count: certsNeedingFix.length,
        violation_type: selectedViolationType
      })
      
      let successCount = 0
      let errorCount = 0

      for (const cert of certsNeedingFix) {
        if (!cert.can_auto_fix) continue

        try {
          const { error } = await supabase
            .rpc('create_auto_remediation_order', {
              p_certificate_id: cert.certificate_id,
              p_tenant_id: currentTenantId,
              p_key_size: cert.required_key_size
            })

          if (error) {
            errorCount++
            console.error(`Fehler bei ${cert.subject_cn}:`, error)
          } else {
            successCount++
          }
        } catch {
          errorCount++
        }
      }

      // Log: Auto-Fix completed
      await logAction(currentTenantId!, AuditEventTypes.COMPLIANCE_AUTO_FIX_COMPLETED, {
        success_count: successCount,
        error_count: errorCount,
        total: certsNeedingFix.length
      })

      alert(
        `✅ Auto-Remediation abgeschlossen!\n\n` +
        `ACME Orders erstellt: ${successCount}\n` +
        `Fehler: ${errorCount}\n\n` +
        `Gehe zu "ACME Auto-Renewal" um den Status zu prüfen.`
      )

      setShowAutoFixModal(false)
    } catch (error: any) {
      console.error('Auto-Fix Fehler:', error)
      alert(`❌ Fehler: ${error.message}`)
    } finally {
      setFixing(false)
    }
  }

  async function runAllComplianceChecks() {
    if (!confirm('Compliance Checks für alle Zertifikate durchführen?\n\nDies kann einige Sekunden dauern.')) {
      return
    }

    try {
      setRunning(true)

      // Log: Check started
      await logAction(currentTenantId!, AuditEventTypes.COMPLIANCE_CHECK_STARTED, {
        standard: selectedStandard
      })

      const standardId = selectedStandard === 'all' ? null : selectedStandard

      const { data, error } = await supabase
        .rpc('run_all_compliance_checks', {
          p_tenant_id: currentTenantId,
          p_standard_id: standardId
        })

      if (error) throw error

      if (data && data.length > 0) {
        const result = data[0]
        alert(
          `✅ Compliance Checks abgeschlossen!\n\n` +
          `Zertifikate: ${result.total_certs}\n` +
          `Checks erstellt: ${result.checks_created}\n` +
          `Konform: ${result.compliant}\n` +
          `Nicht-konform: ${result.non_compliant}`
        )
      }

      // Refresh data
      fetchComplianceChecks()
      fetchRiskScore()
      fetchRemediationActions()
    } catch (error: any) {
      console.error('Fehler beim Ausführen der Checks:', error)
      alert(`❌ Fehler: ${error.message}`)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (checks.length > 0) {
      calculateSummary()
    }
  }, [checks, selectedStandard])

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

  async function fetchStandards() {
    try {
      const { data, error } = await supabase
        .from('compliance_standards')
        .select('*')
        .order('name')

      if (error) throw error
      setStandards(data || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
  }

  async function fetchComplianceChecks() {
    try {
      const { data, error } = await supabase
        .from('compliance_checks')
        .select(`
          *,
          certificates (
            subject_cn,
            not_after
          ),
          compliance_standards (
            name
          )
        `)
        .eq('tenant_id', currentTenantId)
        .order('checked_at', { ascending: false })

      if (error) throw error
      setChecks(data || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  function calculateSummary() {
    const filteredChecks = selectedStandard === 'all'
      ? checks
      : checks.filter(c => c.standard_id === selectedStandard)

    const standardGroups = filteredChecks.reduce((acc, check) => {
      const standardName = check.compliance_standards?.name || 'Unknown'
      if (!acc[standardName]) {
        acc[standardName] = { compliant: 0, non_compliant: 0 }
      }
      if (check.is_compliant) {
        acc[standardName].compliant++
      } else {
        acc[standardName].non_compliant++
      }
      return acc
    }, {} as Record<string, { compliant: number; non_compliant: number }>)

    const summaryData: ComplianceSummary[] = Object.entries(standardGroups).map(([standard, data]) => {
      const total = data.compliant + data.non_compliant
      return {
        standard,
        total,
        compliant: data.compliant,
        non_compliant: data.non_compliant,
        compliance_rate: (data.compliant / total) * 100,
      }
    })

    setSummary(summaryData)
  }

  function getComplianceColor(rate: number): string {
    if (rate >= 90) return 'text-green-600 bg-green-100'
    if (rate >= 70) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-gray-600 mt-2">Überwachung der Einhaltung von Sicherheitsstandards</p>
          </div>
          <button
            onClick={runAllComplianceChecks}
            disabled={running}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? '⏳ Prüfe...' : '🔍 Alle Zertifikate prüfen'}
          </button>
        </div>

        {/* Risk Score Card */}
        {riskScore && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🎯 Compliance Risk Score</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
              <div className="md:col-span-2 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-6xl font-bold mb-2 ${
                    riskScore.risk_level === 'low' ? 'text-green-600' :
                    riskScore.risk_level === 'medium' ? 'text-yellow-600' :
                    riskScore.risk_level === 'high' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {riskScore.overall_score}
                  </div>
                  <Badge
                    variant={
                      riskScore.risk_level === 'low' ? 'success' :
                      riskScore.risk_level === 'medium' ? 'warning' :
                      'error'
                    }
                    size="lg"
                  >
                    Risk: {riskScore.risk_level.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="md:col-span-4 grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Critical Violations</div>
                  <div className="text-2xl font-bold text-red-600">{riskScore.critical_violations}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">High Violations</div>
                  <div className="text-2xl font-bold text-orange-600">{riskScore.high_violations}</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Medium Violations</div>
                  <div className="text-2xl font-bold text-yellow-600">{riskScore.medium_violations}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Standards Failing</div>
                  <div className="text-2xl font-bold text-gray-900">{riskScore.standards_failing}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remediation Actions */}
        {remediationActions.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-orange-900 mb-4">🔧 Remediation Guide</h2>
            <div className="space-y-4">
              {remediationActions.map((action, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        action.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {action.severity.toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {action.violation_type} ({action.count}x)
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          💡 <strong>Lösung:</strong> {action.remediation}
                        </div>
                      </div>
                    </div>
                    {(action.violation_type === 'min_key_size' || action.violation_type === 'max_cert_validity_days') && (
                      <button
                        onClick={() => openAutoFixModal(action.violation_type)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
                      >
                        🤖 Auto-Fix
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-Fix Modal */}
        {showAutoFixModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-semibold">🤖 Automatische Remediation</h3>
                <button
                  onClick={() => setShowAutoFixModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Was passiert:</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Neue ACME-Orders werden erstellt mit korrekter Schlüsselgröße</li>
                    <li>Let's Encrypt erstellt automatisch neue Zertifikate</li>
                    <li>Du musst die Zertifikate danach auf deinen Servern installieren</li>
                    <li>Status kannst du unter "ACME Auto-Renewal" verfolgen</li>
                  </ul>
                </div>

                <h4 className="font-semibold mb-3">Betroffene Zertifikate ({certsNeedingFix.length}):</h4>
                
                <div className="space-y-3 mb-6">
                  {certsNeedingFix.map((cert, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{cert.subject_cn}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Aktuell: {cert.current_key_size} Bit → Neu: {cert.required_key_size} Bit
                          </div>
                        </div>
                        {cert.can_auto_fix ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            ✓ Auto-Fix möglich
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                            Manuell erforderlich
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Wichtig:</strong> Du benötigst einen konfigurierten ACME-Account (Let's Encrypt). 
                    Falls noch nicht vorhanden, gehe zu "ACME Auto-Renewal" und erstelle einen Account.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAutoFixModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={autoFixCertificates}
                    disabled={fixing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {fixing ? '⏳ Erstelle Orders...' : `🤖 Auto-Fix starten (${certsNeedingFix.filter(c => c.can_auto_fix).length})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Standard filtern:</label>
          <select
            value={selectedStandard}
            onChange={(e) => setSelectedStandard(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Alle Standards</option>
            {standards.map((standard) => (
              <option key={standard.id} value={standard.id}>
                {standard.name}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        {summary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {summary.map((item) => (
              <div key={item.standard} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{item.standard}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getComplianceColor(item.compliance_rate)}`}>
                    {item.compliance_rate.toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gesamt:</span>
                    <span className="font-medium">{item.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Konform:</span>
                    <span className="font-medium text-green-600">{item.compliant}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nicht-konform:</span>
                    <span className="font-medium text-red-600">{item.non_compliant}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.compliance_rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Standards Info */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Verfügbare Standards</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {standards.map((standard) => (
              <div key={standard.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{standard.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{standard.description}</p>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs font-medium text-gray-700 mb-2">Anforderungen:</div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {standard.requirements.min_key_size && (
                      <li>• Minimale Schlüsselgröße: {standard.requirements.min_key_size} Bit</li>
                    )}
                    {standard.requirements.allowed_protocols && (
                      <li>• Erlaubte Protokolle: {standard.requirements.allowed_protocols.join(', ')}</li>
                    )}
                    {standard.requirements.max_cert_validity_days && (
                      <li>• Max. Gültigkeit: {standard.requirements.max_cert_validity_days} Tage</li>
                    )}
                    {standard.requirements.require_forward_secrecy && (
                      <li>• Forward Secrecy erforderlich</li>
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Checks Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Compliance Prüfungen</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zertifikat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standard</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verstöße</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Geprüft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(selectedStandard === 'all' ? checks : checks.filter(c => c.standard_id === selectedStandard)).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Noch keine Compliance Prüfungen durchgeführt
                    </td>
                  </tr>
                ) : (
                  (selectedStandard === 'all' ? checks : checks.filter(c => c.standard_id === selectedStandard)).map((check) => (
                    <tr key={check.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {check.certificates?.subject_cn || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Läuft ab: {check.certificates?.not_after ? new Date(check.certificates.not_after).toLocaleDateString('de-DE') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {check.compliance_standards?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        {check.is_compliant ? (
                          <span className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                            ✓ Konform
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full font-medium">
                            ✗ Nicht-konform
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {check.violations.length > 0 ? (
                          <div className="space-y-1">
                            {check.violations.slice(0, 2).map((violation: any, idx: number) => (
                              <div key={idx} className="text-xs text-red-600">
                                • {violation.rule}: {violation.expected} erwartet, {violation.actual} gefunden
                              </div>
                            ))}
                            {check.violations.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{check.violations.length - 2} weitere
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Keine</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(check.checked_at).toLocaleDateString('de-DE')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

