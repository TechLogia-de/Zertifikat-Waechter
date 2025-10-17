import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import AddDomainModal from '../components/features/AddDomainModal'
import ActivityTimeline from '../components/features/ActivityTimeline'

interface Stats {
  totalCertificates: number
  expiringSoon: number
  expired: number
  activeAlerts: number
  activeAgents: number
  totalAgents: number
  hostsDiscovered: number
  servicesFound: number
}

interface RecentCertificate {
  id: string
  subject_cn: string
  not_after: string
  issuer: string
  assets: {
    host: string
    port: number
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    activeAlerts: 0,
    activeAgents: 0,
    totalAgents: 0,
    hostsDiscovered: 0,
    servicesFound: 0
  })
  const [tenantName, setTenantName] = useState<string>('')
  const [tenantId, setTenantId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showAddDomainModal, setShowAddDomainModal] = useState(false)
  const [recentCertificates, setRecentCertificates] = useState<RecentCertificate[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [user])

  async function loadDashboardData() {
    if (!user) return

    try {
      // Get user's tenant
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id, tenants(name)')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (membershipError) {
        console.error('Failed to load membership:', membershipError)
        throw membershipError
      }

      if (membership) {
        // Type assertion für joined data
        const membershipData = membership as any
        
        if (membershipData.tenants) {
          setTenantName(membershipData.tenants.name)
        }
        
        setTenantId(membershipData.tenant_id)
        
        const tenantId = membershipData.tenant_id

        // Get certificates count
        const { count: totalCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)

        // Get expiring soon (next 30 days)
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        
        const { count: expiringCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .lte('not_after', thirtyDaysFromNow.toISOString())
          .gte('not_after', new Date().toISOString())

        // Get expired
        const { count: expiredCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .lt('not_after', new Date().toISOString())

        // Get active alerts
        const { count: alertsCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('acknowledged_at', null)

        // Get Agents stats
        const { data: connectors } = await supabase
          .from('connectors')
          .select('*')
          .eq('tenant_id', tenantId)

        const activeAgents = (connectors as any)?.filter((c: any) => c.status === 'active').length || 0
        const totalAgents = connectors?.length || 0

        // Get Discovery Results
        const { data: discoveryResults } = await supabase
          .from('discovery_results')
          .select('*')
          .eq('tenant_id', tenantId)

        const hostsDiscovered = discoveryResults?.length || 0
        const servicesFound = (discoveryResults as any)?.reduce((sum: number, result: any) => {
          return sum + (result.services?.length || 0)
        }, 0) || 0

        setStats({
          totalCertificates: totalCount || 0,
          expiringSoon: expiringCount || 0,
          expired: expiredCount || 0,
          activeAlerts: alertsCount || 0,
          activeAgents,
          totalAgents,
          hostsDiscovered,
          servicesFound
        })

        // Get recent certificates
        const { data: recentCerts } = await supabase
          .from('certificates')
          .select(`
            id,
            subject_cn,
            not_after,
            issuer,
            assets(host, port)
          `)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentCertificates(recentCerts as any[] || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Dashboard</h1>
            {tenantName && (
              <p className="text-[#64748B] mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base">Organisation:</span>
                <span className="px-2 sm:px-3 py-1 bg-[#DBEAFE] text-[#1E40AF] rounded-lg text-xs sm:text-sm font-medium">
                  {tenantName}
                </span>
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-medium text-[#0F172A] truncate">{user?.email}</p>
            <p className="text-xs text-[#64748B]">Administrator</p>
          </div>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-2">
            Willkommen zurück! 👋
          </h2>
          <p className="text-sm sm:text-base text-[#64748B]">
            Zentrale Übersicht aller SSL/TLS-Zertifikate, Agents und Netzwerk-Discovery.
            Alle Daten werden in Echtzeit aktualisiert.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          {/* Active Agents mit Discovery Info */}
          <Link 
            to="/connectors"
            className="block bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-4 sm:p-6 hover:shadow-lg hover:border-purple-400 active:scale-95 transition-all cursor-pointer relative overflow-hidden"
          >
            {stats.activeAgents > 0 && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
            )}
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm">
                <span className="text-2xl sm:text-3xl">🤖</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-purple-700 mb-2">Agents</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#0F172A] mb-2">
              {loading ? '-' : `${stats.activeAgents}/${stats.totalAgents}`}
            </p>
            <div className="space-y-1">
              <p className="text-xs text-purple-700 font-medium flex items-center">
                <span className="mr-1">●</span> {stats.activeAgents} Online
              </p>
              {stats.hostsDiscovered > 0 && (
                <>
                  <p className="text-xs text-purple-600 flex items-center">
                    <span className="mr-1">🌐</span> {stats.hostsDiscovered} Hosts gefunden
                  </p>
                  <p className="text-xs text-purple-600 flex items-center">
                    <span className="mr-1">🔍</span> {stats.servicesFound} Services
                  </p>
                </>
              )}
            </div>
          </Link>

          {/* Total Certificates */}
          <Link 
            to="/certificates"
            className="block bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 hover:shadow-lg hover:border-[#3B82F6] active:scale-95 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-[#DBEAFE] rounded-lg">
                <span className="text-2xl sm:text-3xl">🔐</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#64748B] mb-2">Zertifikate</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#0F172A] mb-2">
              {loading ? '-' : stats.totalCertificates}
            </p>
            <p className="text-xs text-[#10B981] font-medium flex items-center">
              <span className="mr-1">✓</span> Überwacht
            </p>
          </Link>

          {/* Expiring Soon */}
          <Link 
            to="/certificates"
            className="block bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 hover:shadow-lg hover:border-[#F59E0B] active:scale-95 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-[#FEF3C7] rounded-lg">
                <span className="text-2xl sm:text-3xl">⏰</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#64748B] mb-2">Bald ablaufend</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#F59E0B] mb-2">
              {loading ? '-' : stats.expiringSoon}
            </p>
            <p className="text-xs text-[#64748B]">Nächste 30 Tage</p>
          </Link>

          {/* Expired */}
          <Link 
            to="/alerts"
            className="block bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 hover:shadow-lg hover:border-[#EF4444] active:scale-95 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-[#FEE2E2] rounded-lg">
                <span className="text-2xl sm:text-3xl">🚨</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#64748B] mb-2">Überfällig</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#EF4444] mb-2">
              {loading ? '-' : stats.expired}
            </p>
            <p className="text-xs text-[#EF4444] font-medium">Sofort handeln!</p>
          </Link>

          {/* Active Alerts */}
          <Link 
            to="/alerts"
            className="block bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 hover:shadow-lg hover:border-[#6366F1] active:scale-95 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-[#E0E7FF] rounded-lg">
                <span className="text-2xl sm:text-3xl">🔔</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#64748B] mb-2">Aktive Alerts</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#6366F1] mb-2">
              {loading ? '-' : stats.activeAlerts}
            </p>
            <p className="text-xs text-[#64748B]">Benachrichtigungen</p>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Quick Actions Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-[#0F172A] mb-3 sm:mb-4">Schnellaktionen</h3>
            <div className="space-y-3">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setShowAddDomainModal(true)
                }}
                className="w-full flex items-center justify-between p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#DBEAFE] rounded-lg group-hover:bg-[#3B82F6] transition-colors">
                    <svg className="w-5 h-5 text-[#3B82F6] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="font-medium text-[#0F172A]">Domain hinzufügen</span>
                </div>
                <svg className="w-5 h-5 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <Link 
                to="/certificates"
                className="w-full flex items-center justify-between p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#D1FAE5] rounded-lg group-hover:bg-[#10B981] transition-colors">
                    <svg className="w-5 h-5 text-[#10B981] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-[#0F172A]">Zertifikate verwalten</span>
                </div>
                <svg className="w-5 h-5 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link 
                to="/alerts"
                className="w-full flex items-center justify-between p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#FEF3C7] rounded-lg group-hover:bg-[#F59E0B] transition-colors">
                    <svg className="w-5 h-5 text-[#F59E0B] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <span className="font-medium text-[#0F172A]">Alerts ansehen</span>
                </div>
                <svg className="w-5 h-5 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-[#0F172A] mb-3 sm:mb-4">Letzte Aktivitäten</h3>
            {tenantId ? (
              <ActivityTimeline tenantId={tenantId} limit={5} />
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-[#64748B]">Lade Aktivitäten...</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Certificates */}
        {recentCertificates.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-[#0F172A]">Zuletzt hinzugefügt</h3>
              <Link 
                to="/certificates"
                className="text-xs sm:text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium whitespace-nowrap"
              >
                Alle anzeigen →
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {recentCertificates.map((cert) => {
                const asset = cert.assets as any
                const now = new Date()
                const expiryDate = new Date(cert.not_after)
                const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                
                let statusColor = '#10B981'
                if (daysLeft < 0) statusColor = '#EF4444'
                else if (daysLeft < 7) statusColor = '#EF4444'
                else if (daysLeft < 30) statusColor = '#F59E0B'

                return (
                  <div 
                    key={cert.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] transition-colors gap-3"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#DBEAFE] rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg sm:text-xl">🔒</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-[#0F172A] truncate">{cert.subject_cn}</p>
                        <p className="text-xs sm:text-sm text-[#64748B] truncate">
                          {asset?.host || 'Unbekannt'} • {cert.issuer || 'Unbekannt'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-semibold whitespace-nowrap" style={{ color: statusColor }}>
                        {daysLeft > 0 ? `${daysLeft} Tage` : 'Abgelaufen'}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {expiryDate.toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Getting Started */}
        {stats.totalCertificates === 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 sm:p-6 lg:p-8">
            <div className="flex items-start justify-between">
              <div className="w-full">
                <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] mb-2">🚀 Erste Schritte</h3>
                <p className="text-sm sm:text-base text-[#64748B] mb-4 sm:mb-6 max-w-2xl">
                  Starte mit der Überwachung deiner Zertifikate in wenigen einfachen Schritten
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <Link 
                    to="/certificates"
                    className="bg-white/80 backdrop-blur rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#3B82F6] text-white rounded-full text-xs sm:text-sm font-bold">1</span>
                      <h4 className="font-semibold text-sm sm:text-base text-[#0F172A]">Domain hinzufügen</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-[#64748B]">Füge deine ersten Domains für die Überwachung hinzu</p>
                  </Link>
                  <Link 
                    to="/settings"
                    className="bg-white/80 backdrop-blur rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#10B981] text-white rounded-full text-xs sm:text-sm font-bold">2</span>
                      <h4 className="font-semibold text-sm sm:text-base text-[#0F172A]">Alerts konfigurieren</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-[#64748B]">Richte Benachrichtigungen für ablaufende Zertifikate ein</p>
                  </Link>
                  <Link 
                    to="/connectors"
                    className="bg-white/80 backdrop-blur rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#8B5CF6] text-white rounded-full text-xs sm:text-sm font-bold">3</span>
                      <h4 className="font-semibold text-sm sm:text-base text-[#0F172A]">Agent deployen</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-[#64748B]">Installiere den Agent für Intranet-Scans</p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Domain Modal - Always render */}
      <AddDomainModal
        isOpen={showAddDomainModal && !!tenantId}
        onClose={() => setShowAddDomainModal(false)}
        tenantId={tenantId || ''}
        onSuccess={() => {
          loadDashboardData()
          setShowAddDomainModal(false)
        }}
      />
    </div>
  )
}


