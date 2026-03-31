import { ReactNode, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import { useSessionTimeout } from '../../hooks/useSessionTimeout'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessionWarning, setSessionWarning] = useState<string | null>(null)

  // Auto-logout after 30 min inactivity
  const handleWarning = useCallback((remainingMs: number) => {
    const mins = Math.ceil(remainingMs / 60000)
    setSessionWarning(`Sitzung läuft in ${mins} Minute(n) ab. Bewege die Maus um aktiv zu bleiben.`)
    // Auto-dismiss after 10 seconds
    setTimeout(() => setSessionWarning(null), 10000)
  }, [])

  useSessionTimeout({
    enabled: true,
    onWarning: handleWarning,
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Sidebar - fixiert, scrollt NICHT mit */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Content Area - NUR dieser Bereich scrollt */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-slate-200/60 dark:border-gray-700 shadow-sm px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-1.5 shadow-md">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-6 h-6 object-contain"
              />
            </div>
            <h1 className="text-base font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              Zertifikat-Wächter
            </h1>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Session timeout warning banner */}
        {sessionWarning && (
          <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-amber-800">{sessionWarning}</span>
            <button onClick={() => setSessionWarning(null)} className="text-amber-600 hover:text-amber-800 text-sm font-medium ml-4">
              OK
            </button>
          </div>
        )}

        {/* Scrollable Content - NUR dieser Teil scrollt! */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {children}
        </main>
      </div>
    </div>
  )
}

