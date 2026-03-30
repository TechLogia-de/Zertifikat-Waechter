// Page header with gradient background for the ACME page

export default function ACMEPageHeader() {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
          <span className="text-xl sm:text-2xl">{'\u{1F504}'}</span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">ACME Auto-Renewal</h1>
      </div>
      <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
        Let's Encrypt {'\u2022'} ZeroSSL {'\u2022'} DNS-01/HTTP-01 {'\u2022'} Auto-Renewal {'\u2022'} Cloudflare
      </p>
    </div>
  )
}
