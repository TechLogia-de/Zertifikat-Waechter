import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import { generateHTMLReport } from '../utils/reportHtmlGenerator'
import ReportConfigForm from '../components/features/ReportConfigForm'
import ReportPreview from '../components/features/ReportPreview'
import { ReportMessages, ReportInfoBox, ReportStatsCards } from '../components/features/ReportInfoSection'

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
  const [tenantId, setTenantId] = useState<string>('')
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

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id, tenants(name)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        const membershipData = membership as any
        setTenantId(membershipData.tenant_id)
        if (membershipData.tenants) {
          setTenantName(membershipData.tenants.name || '')
        }

        // Load Stats
        const { count: totalCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', membershipData.tenant_id)

        const { count: expiredCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', membershipData.tenant_id)
          .lt('not_after', new Date().toISOString())

        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

        const { count: expiringCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', membershipData.tenant_id)
          .lte('not_after', thirtyDaysFromNow.toISOString())
          .gte('not_after', new Date().toISOString())

        const { count: eventsCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', membershipData.tenant_id)

        setStats({
          totalCerts: totalCount || 0,
          expired: expiredCount || 0,
          expiring: expiringCount || 0,
          valid: (totalCount || 0) - (expiredCount || 0) - (expiringCount || 0),
          events: eventsCount || 0
        })
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function generateReport() {
    if (!tenantId) {
      setError('Kein Tenant gefunden!')
      return
    }

    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      if (config.format === 'csv') {
        await generateCSV()
      } else {
        await generatePDF()
      }
    } catch (err: any) {
      setError(`Fehler: ${err.message}`)
      setTimeout(() => setError(null), 8000)
    } finally {
      setGenerating(false)
    }
  }

  async function generateCSV() {
    // Hole Zertifikate
    const { data: certificates } = await supabase
      .from('certificates')
      .select('subject_cn, issuer, not_before, not_after, key_alg, key_size, fingerprint, assets(host, port)')
      .eq('tenant_id', tenantId)
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

    setSuccess('✅ CSV-Report erfolgreich heruntergeladen!')
    setTimeout(() => setSuccess(null), 5000)
  }

  async function generatePDF() {
    setSuccess('📄 Generiere PDF-Report... (lädt Daten)')

    // Hole alle benötigten Daten
    const { data: certificates, error: certError } = await supabase
      .from('certificates')
      .select('*, assets(host, port)')
      .eq('tenant_id', tenantId)
      .order('not_after', { ascending: true })

    if (certError) {
      throw new Error(`Fehler beim Laden der Zertifikate: ${certError.message}`)
    }

    const { data: events } = config.includeAuditLog ? await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ts', { ascending: false })
      .limit(50)
      : { data: null }

    console.log('Report data loaded:', {
      certificates: certificates?.length,
      events: events?.length
    })

    // Versuche Edge Function (Produktiv-Lösung)
    try {
      setSuccess('📄 Generiere professionellen PDF-Report... (Edge Function)')

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
        throw new Error('Edge Function nicht deployed')
      }

      if (data && data.html_report) {
        // Öffne HTML in neuem Tab
        const reportWindow = window.open('', '_blank')
        if (reportWindow) {
          reportWindow.document.write(data.html_report)
          reportWindow.document.close()

          setSuccess(`✅ PDF-Report geöffnet!\n\n📄 Klicke im neuen Tab auf "🖨️ Als PDF speichern"\n📊 ${stats.totalCerts} Zertifikate${config.includeHashChain ? '\n🔒 Mit Hash-Chain Verifizierung' : ''}`)
          setTimeout(() => setSuccess(null), 10000)
          return
        }
      }
    } catch (err) {
      console.warn('Edge Function fehlgeschlagen, nutze Fallback:', err)
    }

    // FALLBACK: Client-seitige HTML-Generierung (funktioniert IMMER!)
    setSuccess('📄 Generiere Report (Client-seitig)...')

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

      setSuccess(`✅ PDF-Report geöffnet! (Client-Generierung)\n\n📄 Klicke im neuen Tab auf "🖨️ Als PDF speichern"\n📊 ${stats.totalCerts} Zertifikate${config.includeHashChain ? '\n🔒 Mit Hash-Chain Verifizierung' : ''}\n\n💡 Für schnellere Reports: Deploye Edge Functions`)
    } else {
      // Popup geblockt → Download als HTML
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Certificate-Compliance-Report-${new Date().toISOString().split('T')[0]}.html`
      link.click()
      URL.revokeObjectURL(url)

      setSuccess(`✅ Report heruntergeladen!\n\n📄 Öffne die HTML-Datei und drucke als PDF\n📊 ${stats.totalCerts} Zertifikate`)
    }

    setTimeout(() => setSuccess(null), 12000)
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
