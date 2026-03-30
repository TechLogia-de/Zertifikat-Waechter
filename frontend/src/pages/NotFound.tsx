import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-lg shadow-red-500/20">
            <span className="text-xl sm:text-2xl">404</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Seite nicht gefunden</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
          Die angeforderte Seite existiert nicht.
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto text-center space-y-6 mt-12">
          <div className="text-8xl font-bold text-slate-200">404</div>
          <p className="text-lg text-slate-600">
            Die Seite, die Sie suchen, konnte leider nicht gefunden werden.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Zum Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
