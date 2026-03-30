import { memo } from 'react'
import { Link } from 'react-router-dom'

/**
 * Page header for the Settings page with gradient background and navigation link.
 */
function SettingsHeader() {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
              <span className="text-xl sm:text-2xl">⚙️</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Einstellungen</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
            Alert-Policies • Warnschwellen • Notification-Channels • MFA
          </p>
        </div>
        <Link
          to="/integrations"
          className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 whitespace-nowrap"
        >
          <span>🔗 Integrationen verwalten</span>
        </Link>
      </div>
    </div>
  )
}

export default memo(SettingsHeader)
