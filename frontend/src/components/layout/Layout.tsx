import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Sidebar - fixiert, scrollt NICHT mit */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Content Area - NUR dieser Bereich scrollt */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
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
            <h1 className="text-base font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Zertifikat-Wächter
            </h1>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Scrollable Content - NUR dieser Teil scrollt! */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {children}
        </main>
      </div>
    </div>
  )
}

