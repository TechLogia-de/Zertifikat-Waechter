import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { signOut } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '📊', exact: true },
    { name: 'Zertifikate', href: '/certificates', icon: '🔒' },
    { name: 'Alerts', href: '/alerts', icon: '🔔' },
    { name: 'Connectors', href: '/connectors', icon: '🤖' },
    { name: 'Agent Logs', href: '/agent-logs', icon: '📡' },
    { name: 'Integrationen', href: '/integrations', icon: '🔗' },
    { name: 'ACME Auto-Renewal', href: '/acme', icon: '🔄' },
    { name: 'Audit Log', href: '/audit-log', icon: '📋' },
    { name: 'Einstellungen', href: '/settings', icon: '⚙️' },
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
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-[#1E293B] h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Logo */}
      <div className="p-6 border-b border-[#334155] flex-shrink-0">
        <NavLink to="/" className="block">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2 hover:text-blue-300 transition-colors">
            <span>🛡️</span>
            <span>Zertifikat-Wächter</span>
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">SSL/TLS Monitoring</p>
        </NavLink>
      </div>

      {/* Navigation - scrollbar wenn zu viele Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.exact}
            onClick={handleLinkClick}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-[#3B82F6] text-white shadow-lg scale-105'
                  : 'text-[#94A3B8] hover:bg-[#334155] hover:text-white hover:scale-102'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer - immer sichtbar am unteren Rand */}
      <div className="p-4 border-t border-[#334155] space-y-2 flex-shrink-0">
        <div className="px-4 py-2 bg-[#334155] rounded-lg">
          <p className="text-xs text-[#94A3B8]">Version</p>
          <p className="text-sm text-white font-medium">v1.0.0</p>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 text-[#94A3B8] hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium">Abmelden</span>
        </button>
      </div>
      </aside>
    </>
  )
}

