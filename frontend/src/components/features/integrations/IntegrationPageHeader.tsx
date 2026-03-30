// Page header for the Integrations page

export default function IntegrationPageHeader() {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
          <span className="text-xl sm:text-2xl">🔗</span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Integrationen</h1>
      </div>
      <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
        SMTP/Email • Slack • MS Teams • Custom Webhooks • HMAC-Signed
      </p>
    </div>
  )
}
