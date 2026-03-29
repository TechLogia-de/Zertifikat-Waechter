export default function QuickStartGuide() {
  return (
    <div className="mt-8 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          Quick Start: Agent in 3 Schritten
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          Vollautomatisiertes Deployment - kein Setup, keine Konfiguration
        </p>
      </div>

      <div className="p-6 md:p-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="relative">
            <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              1
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 h-full">
              <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Agent konfigurieren</h3>
              <p className="text-sm text-[#64748B] mb-3">
                Klicke oben auf <strong>"Neuen Agent erstellen"</strong>
              </p>
              <ul className="text-xs text-[#64748B] space-y-1">
                <li>✓ Wähle Auto-Discovery (empfohlen)</li>
                <li>✓ Oder manuelle Targets (für Produktion)</li>
                <li>✓ Token wird automatisch generiert</li>
              </ul>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              2
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 h-full">
              <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Befehl kopieren</h3>
              <p className="text-sm text-[#64748B] mb-3">
                Der Docker-Befehl wird fertig generiert
              </p>
              <ul className="text-xs text-[#64748B] space-y-1">
                <li>✓ Enthält Token & alle Credentials</li>
                <li>✓ Vorkonfiguriert (keine .env nötig)</li>
                <li>✓ 3 Varianten: Docker, Compose, Windows</li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              3
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 h-full">
              <h3 className="font-bold text-[#0F172A] mb-2 text-lg">Starten & Überwachen</h3>
              <p className="text-sm text-[#64748B] mb-3">
                Befehl ausführen - fertig!
              </p>
              <ul className="text-xs text-[#64748B] space-y-1">
                <li>✓ Auto-Connect & Status 🟢 Online</li>
                <li>✓ Heartbeat alle 30s</li>
                <li>✓ Live-Results im Dashboard</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tech Specs */}
        <div className="mt-6 bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚙️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-[#0F172A] text-sm mb-2">Technische Spezifikationen</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Runtime:</strong> Go 1.22.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Image:</strong> Alpine Linux (~10MB)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Auth:</strong> Token-based (bcrypt hash)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Protocol:</strong> HTTPS/TLS x509</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Scanning:</strong> 50 concurrent workers</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Monitoring:</strong> Heartbeat 30s</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Logging:</strong> Structured JSON</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>API:</strong> Supabase REST + Realtime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
