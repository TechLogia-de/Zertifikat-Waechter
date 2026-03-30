import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { useAutoDismiss } from '../hooks/useAutoDismiss'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import { generateHTMLReport } from '../utils/reportHtmlGenerator'
import ReportConfigForm from '../components/features/ReportConfigForm'
import ReportPreview from '../components/features/ReportPreview'
import { ReportMessages, ReportInfoBox, ReportStatsCards } from '../components/features/ReportInfoSection'
import PageInfoBox from '../components/ui/PageInfoBox'

export interface ReportConfig {
  title: string
  description: string
  includeExpired: boolean
  includeExpiring: boolean
  includeValid: boolean
  includeCharts: boolean
  includeAuditLog: boolean
  includeHashChain: boolean
  daysThreshold: number
  format: 'pdf' | 'csv'
}

export interface ReportStats {
  totalCerts: number
  expired: number
  expiring: number
  valid: number
  events: number
}

export default function Reports() {
  const { user } = useAuth()
  const { tenantId } = useTenantId()
  const [tenantName, setTenantName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Report Config
  const [config, setConfig] = useState<ReportConfig>({
    title: 'Certificate Compliance Report',
    description: 'Automatischer Audit-Report aller SSL/TLS-Zertifikate',
    includeExpired: true,
    includeExpiring: true,
    includeValid: true,
    includeCharts: true,
    includeAuditLog: true,
    includeHashChain: true,
    daysThreshold: 30,
    format: 'pdf'
  })

  // Stats
  const [stats, setStats] = useState<ReportStats>({
    totalCerts: 0,
    expired: 0,
    expiring: 0,
    valid: 0,
    events: 0
  })

  const { message: success, show: showSuccess, clear: clearSuccess } = useAutoDismiss()
  const { message: error, show: showError } = useAutoDismiss()

  useEffect(() => {
    if (tenantId) {
      loadData()
    }
  }, [tenantId])

  async function loadData() {
    if (!tenantId) return

    try {
      // Fetch tenant name via memberships join
      if (user) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('tenants(name)')
          .eq('user_id', user.id)
          .maybeSingle()

        if (membership) {
          const membershipData = membership as any
          if (membershipData.tenants) {
            setTenantName(membershipData.tenants.name || '')
          }
        }
      }

      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      // Load all stats in parallel
      const [totalResult, expiredResult, expiringResult, eventsResult] = await Promise.all([
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .lt('not_after', new Date().toISOString()),
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .lte('not_after', thirtyDaysFromNow.toISOString())
          .gte('not_after', new Date().toISOString()),
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
      ])

      setStats({
        totalCerts: totalResult.count || 0,
        expired: expiredResult.count || 0,
        expiring: expiringResult.count || 0,
        valid: (totalResult.count || 0) - (expiredResult.count || 0) - (expiringResult.count || 0),
        events: eventsResult.count || 0
      })
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function generateReport() {
    if (!tenantId) {
      showError('Kein Tenant gefunden!')
      return
    }

    // Validate that there are certificates matching the selected filters
    const matchingCerts =
      (config.includeExpired ? stats.expired : 0) +
      (config.includeExpiring ? stats.expiring : 0) +
      (config.includeValid ? stats.valid : 0)

    if (matchingCerts === 0) {
      showError('Keine Zertifikate gefunden, die den gewählten Filterkriterien entsprechen. Bitte passen Sie die Filteroptionen an.', 8000)
      return
    }

    setGenerating(true)

    try {
      if (config.format === 'csv') {
        await generateCSV()
      } else {
        await generatePDF()
      }
    } catch (err: any) {
      showError(`Fehler: ${err.message}`, 8000)
    } finally {
      setGenerating(false)
    }
  }

  async function generateCSV() {
    // Hole Zertifikate
    const { data: certificates } = await supabase
      .from('certificates')
      .select('subject_cn, issuer, not_before, not_after, key_alg, key_size, fingerprint, assets(host, port)')
      .eq('tenant_id', tenantId!)
      .order('not_after', { ascending: true })

    if (!certificates || certificates.length === 0) {
      throw new Error('Keine Zertifikate gefunden!')
    }

    // CSV-Header
    const headers = [
      'Domain',
      'Issuer',
      'Gültig ab',
      'Gültig bis',
      'Tage verbleibend',
      'Key Algorithm',
      'Key Size',
      'Fingerprint',
      'Host',
      'Port'
    ]

    // CSV-Zeilen
    const rows = certificates.map((cert: any) => {
      const daysLeft = Math.floor((new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return [
        cert.subject_cn,
        cert.issuer,
        new Date(cert.not_before).toLocaleDateString('de-DE'),
        new Date(cert.not_after).toLocaleDateString('de-DE'),
        daysLeft,
        cert.key_alg || 'N/A',
        cert.key_size || 'N/A',
        cert.fingerprint,
        cert.assets?.host || 'N/A',
        cert.assets?.port || 'N/A'
      ]
    })

    // CSV erstellen
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `certificate-report-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    showSuccess('✅ CSV-Report erfolgreich heruntergeladen!', 5000)
  }

  async function generatePDF() {
    showSuccess('📄 Generiere PDF-Report... (lädt Daten)')

    // Hole alle benötigten Daten
    const { data: certificates, error: certError } = await supabase
      .from('certificates')
      .select('*, assets(host, port)')
      .eq('tenant_id', tenantId!)
      .order('not_after', { ascending: true })

    if (certError) {
      throw new Error(`Fehler beim Laden der Zertifikate: ${certError.message}`)
    }

    const { data: events } = config.includeAuditLog ? await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId!)
      .order('ts', { ascending: false })
      .limit(50)
      : { data: null }

    // Versuche Edge Function (Produktiv-Lösung)
    try {
      showSuccess('📄 Generiere professionellen PDF-Report... (Edge Function)')

      const { data, error: functionError } = await supabase.functions.invoke('generate-report', {
        body: {
          tenant_id: tenantId,
          tenant_name: tenantName,
          config: config,
          certificates: certificates || [],
          events: events || [],
          stats: stats,
          generated_by: user?.email || 'System',
          generated_at: new Date().toISOString()
        }
      })

      if (functionError) {
        console.warn('Edge Function nicht verfügbar, nutze Client-Generierung:', functionError)
        throw new Error(functionError.message || 'Edge Function nicht verfügbar')
      }

      if (data && data.html_report) {
        // Öffne HTML in neuem Tab
        const reportWindow = window.open('', '_blank')
        if (reportWindow) {
          reportWindow.document.write(data.html_report)
          reportWindow.document.close()

          showSuccess(`✅ PDF-Report geöffnet!\n\n📄 Klicke im neuen Tab auf "🖨️ Als PDF speichern"\n📊 ${stats.totalCerts} Zertifikate${config.includeHashChain ? '\n🔒 Mit Hash-Chain Verifizierung' : ''}`, 10000)
          return
        }
      }
    } catch (err) {
      console.warn('Edge Function fehlgeschlagen, nutze Fallback:', err)
    }

    // FALLBACK: Client-seitige HTML-Generierung (funktioniert IMMER!)
    showSuccess('📄 Generiere Report (Client-seitig)...')

    const html = generateHTMLReport({
      tenant_name: tenantName,
      certificates: certificates || [],
      events: events || [],
      stats: stats,
      config: config,
      generated_by: user?.email || 'System',
      generated_at: new Date().toISOString()
    })

    // Öffne in neuem Tab
    const reportWindow = window.open('', '_blank')
    if (reportWindow) {
      reportWindow.document.write(html)
      reportWindow.document.close()

      showSuccess(`✅ PDF-Report geöffnet! (Client-Generierung)\n\n📄 Klicke im neuen Tab auf "🖨️ Als PDF speichern"\n📊 ${stats.totalCerts} Zertifikate${config.includeHashChain ? '\n🔒 Mit Hash-Chain Verifizierung' : ''}\n\n💡 Für schnellere Reports: Deploye Edge Functions`)
    } else {
      // Popup geblockt → Download als HTML
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Certificate-Compliance-Report-${new Date().toISOString().split('T')[0]}.html`
      link.click()
      URL.revokeObjectURL(url)

      showSuccess(`✅ Report heruntergeladen!\n\n📄 Öffne die HTML-Datei und drucke als PDF\n📊 ${stats.totalCerts} Zertifikate`, 12000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
            <span className="text-xl sm:text-2xl">📄</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Compliance Reports</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
          PDF/CSV Export • Audit-Reports • Hash-Chain • ISO 27001 • DSGVO
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto space-y-6">

          <PageInfoBox title="Compliance-Reports erstellen und exportieren" variant="info" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-[#1E3A5F]">
                Erstellen Sie professionelle Audit-Reports Ihrer TLS/SSL-Zertifikate als PDF oder CSV. Reports enthalten optionale Hash-Chain-Verifizierung fuer manipulationssichere Nachweisfuehrung und sind geeignet fuer ISO 27001, DSGVO und interne Audits.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Export-Formate</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>PDF-Report: Professionelles Layout mit Diagrammen und Statistiken</li>
                    <li>CSV-Export: Maschinenlesbar fuer Weiterverarbeitung in Excel/Datenbanken</li>
                    <li>Hash-Chain: Kryptografische Verkettung aller Eintraege zur Integritaetspruefung</li>
                    <li>Audit-Log: Optionale Einbindung aller Aenderungsereignisse</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Filteroptionen</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Abgelaufene, bald ablaufende oder gueltige Zertifikate einschliessen</li>
                    <li>Schwellenwert fuer "bald ablaufend" individuell konfigurierbar</li>
                    <li>Diagramme und Statistiken ein-/ausblenden</li>
                    <li>Reports werden client- oder serverseitig generiert (Edge Functions)</li>
                  </ul>
                </div>
              </div>
            </div>
          </PageInfoBox>

          <ReportMessages success={success} error={error} />

          <ReportInfoBox />

          {loading ? (
            <LoadingState size="lg" text="Lade Report-Daten..." />
          ) : (
            <>
              <ReportStatsCards stats={stats} />

              <ReportConfigForm
                config={config}
                setConfig={setConfig}
                stats={stats}
                tenantName={tenantName}
                generating={generating}
                onGenerate={generateReport}
              />

              <ReportPreview
                config={config}
                stats={stats}
                tenantName={tenantName}
                userEmail={user?.email}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
