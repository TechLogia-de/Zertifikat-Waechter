import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { signOut } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', exact: true },
    { name: 'Zertifikate & Assets', href: '/certificates', icon: '🔒' },
    { name: 'SSL Health Check', href: '/ssl-health', icon: '🔐' },
    { name: 'Compliance', href: '/compliance', icon: '✅' },
    { name: 'Alerts & Regeln', href: '/alerts', icon: '🔔' },
    { name: 'API Keys', href: '/api-keys', icon: '🔑' },
    { name: 'Connectors', href: '/connectors', icon: '🤖' },
    { name: 'Agent Logs', href: '/agent-logs', icon: '📡' },
    { name: 'Integrationen', href: '/integrations', icon: '🔗' },
    { name: 'Webhook Logs', href: '/webhook-logs', icon: '📬' },
    { name: 'ACME Auto-Renewal', href: '/acme', icon: '🔄' },
    { name: 'Reports', href: '/reports', icon: '📄' },
    { name: 'Audit Log', href: '/audit-log', icon: '📋' },
    { name: 'Dokumentation', href: '/docs', icon: '📚' },
    { name: 'Einstellungen', href: '/settings', icon: '⚙️' },
  ]

  // Dev-only navigation (versteckt am Ende)
  const devNavigation = [
    { name: '🔒 Security Monitor', href: '/dev/security', icon: '🛡️', badge: 'DEV' },
  ]

  const handleLinkClick = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 h-screen flex flex-col
        border-r border-slate-700/50 shadow-2xl
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50 flex-shrink-0 bg-slate-900/50">
        <NavLink to="/dashboard" className="block group">
          <div className="flex items-center space-x-3 transition-all duration-200 group-hover:scale-105">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-2.5 flex-shrink-0 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-200">
              <img
                src="/logo.png"
                alt="Zertifikat-Wächter Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors duration-200">
                Zertifikat-Wächter
              </h1>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors duration-200">SSL/TLS Monitoring</p>
            </div>
          </div>
        </NavLink>
      </div>

      {/* Navigation - scrollbar wenn zu viele Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.exact}
            onClick={handleLinkClick}
            className={({ isActive }) =>
              `group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white hover:scale-[1.02] active:scale-100'
              }`
            }
          >
            <span className="text-xl group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span className="font-medium text-sm">{item.name}</span>
          </NavLink>
        ))}

        {/* Separator für Dev-Navigation */}
        <div className="border-t border-slate-700/50 my-3"></div>

        {/* Dev-Only Navigation */}
        {devNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={handleLinkClick}
            className={({ isActive }) =>
              `group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/30 scale-[1.02]'
                  : 'text-slate-500 hover:bg-red-900/20 hover:text-red-400 hover:scale-[1.02] active:scale-100 border border-slate-700/30'
              }`
            }
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
              <span className="font-medium text-sm">{item.name}</span>
            </div>
            {item.badge && (
              <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs font-bold">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer - immer sichtbar am unteren Rand */}
      <div className="p-3 border-t border-slate-700/50 space-y-2 flex-shrink-0 bg-slate-900/50">
        {/* Version & Logout - Kompakt */}
        <div className="flex items-center justify-between gap-2">
          {/* Version */}
          <div className="px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50 flex-1">
            <p className="text-xs text-slate-400">v1.0.0</p>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await signOut()
              window.location.href = '/'
            }}
            className="group flex items-center justify-center px-3 py-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-transparent hover:border-red-500/20"
            title="Abmelden"
          >
            <svg className="w-5 h-5 group-hover:rotate-12 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
      </aside>
    </>
  )
}

