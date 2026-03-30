import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { supabase } from '../lib/supabase'
import AddDomainModal from '../components/features/AddDomainModal'
import ActivityTimeline from '../components/features/ActivityTimeline'
import PageInfoBox from '../components/ui/PageInfoBox'

interface Stats {
  totalCertificates: number
  expiringSoon: number
  expired: number
  activeAlerts: number
  activeAgents: number
  totalAgents: number
  hostsDiscovered: number
  servicesFound: number
  acmeAccounts: number
  acmeOrders: number
  acmeActive: number
  acmePending: number
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
  const { user, signOut } = useAuth()
  const { tenantId } = useTenantId()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    activeAlerts: 0,
    activeAgents: 0,
    totalAgents: 0,
    hostsDiscovered: 0,
    servicesFound: 0,
    acmeAccounts: 0,
    acmeOrders: 0,
    acmeActive: 0,
    acmePending: 0
  })
  const [tenantName, setTenantName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showAddDomainModal, setShowAddDomainModal] = useState(false)
  const [recentCertificates, setRecentCertificates] = useState<RecentCertificate[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [deviceTypeCounts, setDeviceTypeCounts] = useState<Record<string, number>>({})
  const [gatewayCount, setGatewayCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tenantId) {
      loadDashboardData()
    }
  }, [tenantId])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showUserDropdown])

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  async function loadDashboardData() {
    if (!tenantId || !user) return

    try {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      const now = new Date().toISOString()

      // Fire all independent queries in parallel (including membership)
      const [
        { data: membership },
        { count: totalCount },
        { count: expiringCount },
        { count: expiredCount },
        { count: alertsCount },
        { data: connectors },
        { data: discoveryResults },
        { count: acmeAccountsCount },
        { count: acmeOrdersCount },
        { count: acmeActiveCount },
        { count: acmePendingCount },
        { data: recentCerts },
      ] = await Promise.all([
        supabase
          .from('memberships')
          .select('tenants(name)')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .lte('not_after', thirtyDaysFromNow.toISOString())
          .gte('not_after', now),
        supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .lt('not_after', now),
        supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('acknowledged_at', null),
        supabase
          .from('connectors')
          .select('*')
          .eq('tenant_id', tenantId),
        supabase
          .from('discovery_results')
          .select('*')
          .eq('tenant_id', tenantId),
        supabase
          .from('acme_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('acme_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('acme_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['valid', 'processing']),
        supabase
          .from('acme_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        supabase
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
          .limit(5),
      ])

      // Extract tenant name from membership result
      if (membership) {
        const membershipData = membership as any
        if (membershipData.tenants) {
          setTenantName(membershipData.tenants.name)
        }
      }

      const activeAgents = (connectors as any)?.filter((c: any) => c.status === 'active').length || 0
      const totalAgents = connectors?.length || 0
      const hostsDiscovered = discoveryResults?.length || 0
      const servicesFound = (discoveryResults as any)?.reduce((sum: number, result: any) => {
        return sum + (result.services?.length || 0)
      }, 0) || 0

      // Compute device type stats for dashboard
      const dtCounts: Record<string, number> = {}
      let gwCount = 0
      for (const r of (discoveryResults as any[] || [])) {
        const dt = r.device_type || 'unknown'
        dtCounts[dt] = (dtCounts[dt] || 0) + 1
        if (r.is_gateway) gwCount++
      }
      setDeviceTypeCounts(dtCounts)
      setGatewayCount(gwCount)

      setStats({
        totalCertificates: totalCount || 0,
        expiringSoon: expiringCount || 0,
        expired: expiredCount || 0,
        activeAlerts: alertsCount || 0,
        activeAgents,
        totalAgents,
        hostsDiscovered,
        servicesFound,
        acmeAccounts: acmeAccountsCount || 0,
        acmeOrders: acmeOrdersCount || 0,
        acmeActive: acmeActiveCount || 0,
        acmePending: acmePendingCount || 0
      })

      setRecentCertificates(recentCerts as any[] || [])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Home Link */}
            <Link
              to="/"
              className="flex items-center gap-2 p-2 bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-700/50 hover:bg-slate-700/60 transition-all duration-200 group"
              title="Zur Startseite"
            >
              <svg className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>

            {/* Dashboard Title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                  <span className="text-xl sm:text-2xl">📊</span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                  Dashboard
                </h1>
              </div>
              {tenantName && (
                <div className="flex items-center gap-1.5 text-slate-300 ml-0.5">
                  <span className="text-xs">🏢</span>
                  <span className="text-xs sm:text-sm font-medium">{tenantName}</span>
                </div>
              )}
            </div>
          </div>

          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 bg-slate-800/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50 shadow-lg hover:bg-slate-800/80 transition-all duration-200 cursor-pointer"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white truncate max-w-[200px]">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Admin
                </p>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-2xl border border-slate-700/50 py-2 z-50">
                <Link
                  to="/profile"
                  onClick={() => setShowUserDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Mein Profil</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setShowUserDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Einstellungen</span>
                </Link>
                <div className="my-1 border-t border-slate-700/50"></div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false)
                    handleLogout()
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700/50 transition-colors w-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Abmelden</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-[#DBEAFE] via-[#E0E7FF] to-[#DDD6FE] rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 border-2 border-[#3B82F6]/20 shadow-lg">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-5xl">👋</div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1E40AF]">
                Willkommen zurück, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}!
              </h2>
              <p className="text-sm sm:text-base text-[#1E3A8A] mt-1">
                Zentrale Übersicht aller SSL/TLS-Zertifikate, Agents und ACME Auto-Renewals.
                Alle Daten werden in Echtzeit aktualisiert.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#1E3A8A]">
                <div className="flex items-start gap-1.5"><span className="font-bold text-[#3B82F6]">Zertifikate:</span> Zeigt alle erkannten SSL/TLS-Zertifikate mit Ablaufdatum und Status.</div>
                <div className="flex items-start gap-1.5"><span className="font-bold text-[#3B82F6]">Agents:</span> Scan-Agenten, die dein Netzwerk automatisch nach Zertifikaten durchsuchen.</div>
                <div className="flex items-start gap-1.5"><span className="font-bold text-[#3B82F6]">Alerts:</span> Warnungen bei ablaufenden oder unsicheren Zertifikaten per E-Mail, Slack oder Teams.</div>
              </div>
            </div>
          </div>
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

        <PageInfoBox title="Was bedeuten die Zahlen?" variant="tip">
          <ul className="space-y-1.5 mt-1">
            <li><strong>Agents:</strong> Scan-Software, die in deinem Netzwerk läuft und automatisch Hosts, Services und Zertifikate erkennt. Aktive Agents senden alle 30 Sekunden einen Heartbeat.</li>
            <li><strong>Zertifikate:</strong> Alle erkannten SSL/TLS-Zertifikate. Jedes Zertifikat wird mit Fingerprint, Aussteller, Gültigkeit und Schlüssel-Algorithmus gespeichert.</li>
            <li><strong>Bald ablaufend:</strong> Zertifikate, die innerhalb der nächsten 30 Tage ablaufen. Erneuere diese rechtzeitig, um Ausfälle zu vermeiden.</li>
            <li><strong>Überfällig:</strong> Bereits abgelaufene Zertifikate. Diese verursachen Browser-Warnungen und sollten sofort erneuert werden.</li>
            <li><strong>Aktive Alerts:</strong> Unquittierte Benachrichtigungen über ablaufende oder problematische Zertifikate.</li>
          </ul>
        </PageInfoBox>

        {/* Network Device Overview - Charts */}
        {Object.keys(deviceTypeCounts).length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2">
                <span>🏷️</span>
                <span>Netzwerk-Geräte</span>
              </h3>
              <Link
                to="/connectors"
                className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium flex items-center gap-1"
              >
                Details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6">
                <h4 className="text-sm font-semibold text-[#64748B] mb-3">Geräteverteilung</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={Object.entries(deviceTypeCounts).map(([type, count]) => ({
                        name: { router: 'Router', firewall: 'Firewall', switch: 'Switch', server: 'Server', nas: 'NAS', printer: 'Drucker', hypervisor: 'Hypervisor', 'management-controller': 'Management', 'access-point': 'AP', camera: 'Kamera', 'voip-device': 'VoIP', 'network-device': 'Netzwerk', unknown: 'Unbekannt' }[type] || type,
                        value: count,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {Object.keys(deviceTypeCounts).map((_, index) => {
                        const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#84CC16', '#A855F7']
                        return <Cell key={index} fill={colors[index % colors.length]} />
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} Geräte`, '']}
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {Object.entries(deviceTypeCounts).sort(([,a],[,b]) => b - a).map(([type, count], index) => {
                    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#84CC16', '#A855F7']
                    const labels: Record<string, string> = { router: 'Router', firewall: 'Firewall', switch: 'Switch', server: 'Server', nas: 'NAS', printer: 'Drucker', hypervisor: 'Hypervisor', 'management-controller': 'Mgmt', 'access-point': 'AP', camera: 'Kamera', 'voip-device': 'VoIP', 'network-device': 'Netzwerk', unknown: '?' }
                    return (
                      <div key={type} className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></div>
                        <span>{labels[type] || type} ({count})</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right side: Stats Summary */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6">
                <h4 className="text-sm font-semibold text-[#64748B] mb-3">Übersicht</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(deviceTypeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const icons: Record<string, string> = { router: '🌐', firewall: '🛡️', switch: '🔀', server: '🖥️', nas: '💾', printer: '🖨️', hypervisor: '☁️', 'management-controller': '🎛️', 'access-point': '📡', camera: '📷', 'voip-device': '📞', 'network-device': '📟', unknown: '❓' }
                      const labels: Record<string, string> = { router: 'Router', firewall: 'Firewall', switch: 'Switch', server: 'Server', nas: 'NAS', printer: 'Drucker', hypervisor: 'Hypervisor', 'management-controller': 'Management', 'access-point': 'Access-Point', camera: 'Kamera', 'voip-device': 'VoIP', 'network-device': 'Netzwerk', unknown: 'Unbekannt' }
                      return (
                        <div key={type} className="flex items-center gap-3 p-2.5 bg-[#F8FAFC] rounded-lg">
                          <span className="text-xl">{icons[type] || '❓'}</span>
                          <div>
                            <p className="text-lg font-bold text-[#0F172A] leading-tight">{count}</p>
                            <p className="text-[10px] text-[#64748B] font-medium">{labels[type] || type}</p>
                          </div>
                        </div>
                      )
                    })}
                  {gatewayCount > 0 && (
                    <div className="flex items-center gap-3 p-2.5 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                      <span className="text-xl">⭐</span>
                      <div>
                        <p className="text-lg font-bold text-amber-700 leading-tight">{gatewayCount}</p>
                        <p className="text-[10px] text-amber-600 font-medium">Gateways</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACME Auto-Renewal Section */}
        {stats.acmeAccounts > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2">
                <span>🔄</span>
                <span>ACME Auto-Renewal</span>
              </h3>
              <Link 
                to="/acme"
                className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium flex items-center gap-1"
              >
                Details anzeigen
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* ACME Accounts */}
              <div className="bg-gradient-to-br from-[#D1FAE5] to-[#DCFCE7] rounded-xl border-2 border-[#10B981] p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔑</span>
                  <p className="text-xs font-semibold text-[#065F46]">Accounts</p>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-[#065F46]">
                  {stats.acmeAccounts}
                </p>
                <p className="text-xs text-[#047857] mt-1">Let's Encrypt & Co.</p>
              </div>

              {/* Total Orders */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📋</span>
                  <p className="text-xs font-semibold text-[#64748B]">Renewal Orders</p>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-[#0F172A]">
                  {stats.acmeOrders}
                </p>
                <p className="text-xs text-[#64748B] mt-1">Gesamt</p>
              </div>

              {/* Active Orders */}
              <div className="bg-gradient-to-br from-[#DBEAFE] to-[#E0E7FF] rounded-xl border-2 border-[#3B82F6] p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <p className="text-xs font-semibold text-[#1E40AF]">Aktiv</p>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-[#1E40AF]">
                  {stats.acmeActive}
                </p>
                <p className="text-xs text-[#1E3A8A] mt-1">Gültig & Processing</p>
              </div>

              {/* Pending Orders */}
              <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FED7AA] rounded-xl border-2 border-[#F59E0B] p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⏳</span>
                  <p className="text-xs font-semibold text-[#92400E]">Ausstehend</p>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-[#92400E]">
                  {stats.acmePending}
                </p>
                <p className="text-xs text-[#78350F] mt-1">In Bearbeitung</p>
              </div>
            </div>
          </div>
        )}

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

              <Link 
                to="/acme"
                className="w-full flex items-center justify-between p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#D1FAE5] rounded-lg group-hover:bg-[#10B981] transition-colors">
                    <span className="text-xl text-[#10B981] group-hover:text-white">🔄</span>
                  </div>
                  <span className="font-medium text-[#0F172A]">ACME Auto-Renewal</span>
                </div>
                <svg className="w-5 h-5 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link 
                to="/profile"
                className="w-full flex items-center justify-between p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#E0E7FF] rounded-lg group-hover:bg-[#6366F1] transition-colors">
                    <span className="text-xl text-[#6366F1] group-hover:text-white">👤</span>
                  </div>
                  <span className="font-medium text-[#0F172A]">Mein Profil</span>
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

        {/* Certificate Expiry Timeline */}
        {recentCertificates.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-[#0F172A] mb-4">Zertifikat-Ablauf Übersicht</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={recentCertificates.map((cert) => {
                  const daysLeft = Math.floor((new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return {
                    name: cert.subject_cn.length > 20 ? cert.subject_cn.substring(0, 20) + '...' : cert.subject_cn,
                    tage: Math.max(daysLeft, 0),
                    fill: daysLeft < 0 ? '#EF4444' : daysLeft < 30 ? '#F59E0B' : daysLeft < 90 ? '#3B82F6' : '#10B981',
                  }
                })}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${v}d`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#0F172A' }} />
                <Tooltip
                  formatter={(value: number) => [`${value} Tage verbleibend`, 'Gültigkeit']}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="tage" radius={[0, 6, 6, 0]}>
                  {recentCertificates.map((cert, index) => {
                    const daysLeft = Math.floor((new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const color = daysLeft < 0 ? '#EF4444' : daysLeft < 30 ? '#F59E0B' : daysLeft < 90 ? '#3B82F6' : '#10B981'
                    return <Cell key={index} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 justify-center text-xs text-[#64748B]">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#10B981]"></div> &gt;90 Tage</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#3B82F6]"></div> 30-90 Tage</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#F59E0B]"></div> &lt;30 Tage</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#EF4444]"></div> Abgelaufen</div>
            </div>
          </div>
        )}

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


