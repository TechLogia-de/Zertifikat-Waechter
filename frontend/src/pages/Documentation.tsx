import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  Home,
  Book,
  Rocket,
  Settings,
  Zap,
  Globe,
  Bell,
  Lock,
  CheckCircle,
  Code,
  Server,
  Database,
  Cloud,
  Terminal,
  FileText,
  HelpCircle,
  ArrowRight,
  Download,
} from 'lucide-react'
import { useState } from 'react'

const Documentation = () => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('getting-started')

  const sections = [
    { id: 'getting-started', title: 'Erste Schritte', icon: Rocket },
    { id: 'features', title: 'Features', icon: Zap },
    { id: 'agent', title: 'Agent', icon: Terminal },
    { id: 'installation', title: 'Installation', icon: Download },
    { id: 'configuration', title: 'Konfiguration', icon: Settings },
    { id: 'api', title: 'API', icon: Code },
    { id: 'architecture', title: 'Architektur', icon: Server },
    { id: 'faq', title: 'FAQ', icon: HelpCircle },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <img
                src="/logo.png"
                alt="Zertifikat-Wächter Logo"
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Zertifikat-Wächter
              </span>
            </motion.div>

            <div className="flex items-center space-x-6">
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
              >
                Anmelden
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24 bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Book className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-gray-900">Inhalt</h2>
                </div>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                        activeSection === section.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <section.icon className="w-4 h-4" />
                      <span>{section.title}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                {activeSection === 'getting-started' && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-4xl font-bold mb-4 text-gray-900">Erste Schritte</h1>
                      <p className="text-lg text-gray-600">
                        Willkommen bei Zertifikat-Wächter! Diese Anleitung hilft dir beim Einstieg.
                      </p>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50 rounded-r-lg">
                      <h3 className="font-bold text-blue-900 mb-2">Was ist Zertifikat-Wächter?</h3>
                      <p className="text-blue-800">
                        Ein Enterprise-Grade System zur Überwachung von SSL/TLS-Zertifikaten mit automatischer
                        Discovery, ACME-Integration und Compliance-Reporting.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-gray-900">Quick Start</h2>

                      <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm overflow-x-auto">
                        <div className="mb-2 text-gray-400"># Installation</div>
                        <div>git clone https://github.com/your-org/zertifikat-wachter.git</div>
                        <div>cd zertifikat-wachter</div>
                        <div className="mt-4 mb-2 text-gray-400"># Konfiguration</div>
                        <div>cp .env.example .env</div>
                        <div className="mt-4 mb-2 text-gray-400"># Starten</div>
                        <div>docker-compose up -d</div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 mt-6">
                        {[
                          { icon: Globe, title: 'Frontend', text: 'http://localhost:5173' },
                          { icon: Server, title: 'MCP Server', text: 'http://localhost:8787' },
                          { icon: Database, title: 'Supabase', text: 'Local oder Cloud' },
                        ].map((item) => (
                          <div
                            key={item.title}
                            className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg"
                          >
                            <item.icon className="w-8 h-8 text-blue-600 mb-2" />
                            <h3 className="font-bold text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-600">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'features' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Features</h1>

                    <div className="grid md:grid-cols-2 gap-6">
                      {[
                        {
                          icon: Globe,
                          title: 'Automatische Discovery',
                          description: 'Scannt automatisch Intranet und Public Domains nach Zertifikaten',
                          features: ['Netzwerk-Scan', 'Domain-Listen', 'Agent-basiert'],
                        },
                        {
                          icon: Bell,
                          title: 'Multi-Channel Alerts',
                          description: 'Benachrichtigungen über verschiedene Kanäle',
                          features: ['E-Mail', 'Slack', 'Microsoft Teams', 'Webhooks'],
                        },
                        {
                          icon: Zap,
                          title: 'ACME-Integration',
                          description: 'Automatische Zertifikatserneuerung',
                          features: ["Let's Encrypt", 'Custom ACME', 'Auto-Renewal'],
                        },
                        {
                          icon: Lock,
                          title: 'Security & Compliance',
                          description: 'Enterprise-Grade Sicherheit',
                          features: ['DSGVO-konform', 'Audit-Trails', 'MFA Support'],
                        },
                        {
                          icon: Server,
                          title: 'MCP-Server',
                          description: 'AI-freundliche API für LLMs',
                          features: ['REST API', 'SSE Streams', 'Tool-basiert'],
                        },
                        {
                          icon: FileText,
                          title: 'Reports & Export',
                          description: 'Umfangreiche Reporting-Funktionen',
                          features: ['PDF Export', 'CSV Export', 'Compliance Reports'],
                        },
                      ].map((feature) => (
                        <motion.div
                          key={feature.title}
                          whileHover={{ scale: 1.02 }}
                          className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="bg-blue-100 p-3 rounded-lg">
                              <feature.icon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                              <p className="text-gray-600 text-sm mb-3">{feature.description}</p>
                              <ul className="space-y-1">
                                {feature.features.map((item) => (
                                  <li key={item} className="flex items-center text-sm text-gray-700">
                                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === 'agent' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Der Zertifikat-Wächter Agent</h1>

                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6 rounded-xl">
                      <h2 className="text-2xl font-bold mb-2">Leichtgewichtig & Sicher</h2>
                      <p>
                        Ein schlanker Go-Agent (~10MB) für automatische Discovery von SSL/TLS-Zertifikaten in deinem
                        Netzwerk
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Kernfunktionen</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                          {[
                            {
                              title: 'Netzwerk-Discovery',
                              description: 'Scannt konfigurierte IP-Bereiche und findet automatisch Domains',
                              features: ['CIDR-Notation Support', 'Multi-Threading', 'Rate Limiting'],
                            },
                            {
                              title: 'Zertifikatsprüfung',
                              description: 'Analysiert gefundene Zertifikate im Detail',
                              features: ['Chain Validation', 'Expiry Check', 'Issuer Information'],
                            },
                            {
                              title: 'Sichere Kommunikation',
                              description: 'Verschlüsselte Verbindung zum Backend',
                              features: ['TLS 1.3', 'API-Key Auth', 'Certificate Pinning'],
                            },
                            {
                              title: 'Resource-effizient',
                              description: 'Minimaler Footprint für Edge-Deployment',
                              features: ['~10MB Binary', '< 50MB RAM', 'Single Binary'],
                            },
                          ].map((feature) => (
                            <div
                              key={feature.title}
                              className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-lg border border-gray-200"
                            >
                              <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                              <p className="text-gray-600 text-sm mb-3">{feature.description}</p>
                              <ul className="space-y-1">
                                {feature.features.map((item) => (
                                  <li key={item} className="flex items-center text-sm text-gray-700">
                                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Installation</h2>
                        <div className="space-y-4">
                          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-blue-900 mb-2">Binary Download</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div># Linux x64</div>
                              <div>wget https://releases.cert-watcher.com/agent-linux-amd64</div>
                              <div>chmod +x agent-linux-amd64</div>
                              <div>mv agent-linux-amd64 /usr/local/bin/cert-agent</div>
                              <div className="mt-3"># MacOS</div>
                              <div>wget https://releases.cert-watcher.com/agent-darwin-amd64</div>
                              <div>chmod +x agent-darwin-amd64</div>
                            </div>
                          </div>

                          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-purple-900 mb-2">Docker</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div>docker pull cert-watcher/agent:latest</div>
                              <div className="mt-2">docker run -e API_KEY=your-key \</div>
                              <div className="ml-4">-e NETWORK=192.168.0.0/24 \</div>
                              <div className="ml-4">cert-watcher/agent:latest</div>
                            </div>
                          </div>

                          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-green-900 mb-2">Aus Source kompilieren</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div>git clone https://github.com/cert-watcher/agent.git</div>
                              <div>cd agent</div>
                              <div>go build -o cert-agent ./cmd/agent</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Konfiguration</h2>
                        <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm overflow-x-auto">
                          <div className="space-y-2">
                            <div className="text-gray-400"># Umgebungsvariablen</div>
                            <div>export API_URL=https://api.cert-watcher.com</div>
                            <div>export API_KEY=your-api-key-here</div>
                            <div>export NETWORK=192.168.0.0/24</div>
                            <div>export SCAN_INTERVAL=3600 # Sekunden</div>
                            <div>export LOG_LEVEL=info</div>
                            <div className="mt-4 text-gray-400"># Oder via Config-Datei</div>
                            <div>cert-agent --config /etc/cert-agent/config.yaml</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Verwendung</h2>
                        <div className="space-y-4">
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-2">Einmaliger Scan</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm">
                              <div>cert-agent scan --network 192.168.1.0/24</div>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-2">Kontinuierlicher Scan</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm">
                              <div>cert-agent daemon --interval 3600</div>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-2">Spezifische Domains</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm">
                              <div>cert-agent check --domains example.com,test.local</div>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-2">Systemd Service</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm">
                              <div className="text-gray-400"># /etc/systemd/system/cert-agent.service</div>
                              <div>[Unit]</div>
                              <div>Description=Certificate Watcher Agent</div>
                              <div>After=network.target</div>
                              <div className="mt-2">[Service]</div>
                              <div>ExecStart=/usr/local/bin/cert-agent daemon</div>
                              <div>Environment="API_KEY=your-key"</div>
                              <div>Restart=always</div>
                              <div className="mt-2">[Install]</div>
                              <div>WantedBy=multi-user.target</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
                        <div className="flex items-start space-x-3">
                          <HelpCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
                          <div>
                            <h3 className="font-bold text-yellow-900 mb-2">Best Practices</h3>
                            <ul className="space-y-2 text-yellow-800">
                              <li>• Verwende separate API-Keys für jeden Agent</li>
                              <li>• Limitiere die Netzwerk-Bereiche auf das Notwendige</li>
                              <li>• Überwache die Agent-Logs regelmäßig</li>
                              <li>• Update den Agent regelmäßig auf die neueste Version</li>
                              <li>• Deploye redundante Agents für kritische Netzwerke</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'installation' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Installation</h1>

                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Voraussetzungen</h2>
                        <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                          {[
                            { name: 'Node.js', version: '>= 20' },
                            { name: 'Python', version: '>= 3.12' },
                            { name: 'Go', version: '>= 1.22' },
                            { name: 'Docker', version: '+ Docker Compose' },
                          ].map((req) => (
                            <div key={req.name} className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{req.name}</span>
                              <span className="text-gray-600">{req.version}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Docker Installation</h2>
                        <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm overflow-x-auto space-y-2">
                          <div className="text-gray-400"># Alle Services starten</div>
                          <div>docker-compose up -d</div>
                          <div className="mt-4 text-gray-400"># Einzelne Services</div>
                          <div>docker-compose up -d frontend</div>
                          <div>docker-compose up -d mcp-server</div>
                          <div>docker-compose up -d worker</div>
                          <div className="mt-4 text-gray-400"># Logs ansehen</div>
                          <div>docker-compose logs -f</div>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Manuelle Installation</h2>

                        <div className="space-y-4">
                          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-blue-900 mb-2">Frontend</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div>cd frontend</div>
                              <div>npm install</div>
                              <div>npm run dev</div>
                            </div>
                          </div>

                          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-green-900 mb-2">Worker (Python)</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div>cd worker</div>
                              <div>python -m venv venv</div>
                              <div>source venv/bin/activate</div>
                              <div>pip install -r requirements.txt</div>
                              <div>python start_worker.py</div>
                            </div>
                          </div>

                          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                            <h3 className="font-bold text-purple-900 mb-2">MCP Server (Node.js)</h3>
                            <div className="bg-gray-900 rounded-lg p-4 text-white font-mono text-sm mt-2">
                              <div>cd mcp-server</div>
                              <div>npm install</div>
                              <div>npm run dev</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'configuration' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Konfiguration</h1>

                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          Umgebungsvariablen (.env)
                        </h2>
                        <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm overflow-x-auto">
                          <div className="space-y-2">
                            <div className="text-gray-400"># Supabase Configuration</div>
                            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
                            <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
                            <div className="mt-4 text-gray-400"># Optional: Google OAuth</div>
                            <div>GOOGLE_CLIENT_ID=your-client-id</div>
                            <div>GOOGLE_CLIENT_SECRET=your-client-secret</div>
                            <div className="mt-4 text-gray-400"># SMTP Configuration</div>
                            <div>SMTP_HOST=smtp.gmail.com</div>
                            <div>SMTP_PORT=587</div>
                            <div>SMTP_USER=your-email@gmail.com</div>
                            <div>SMTP_PASSWORD=your-app-password</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
                        <div className="flex items-start space-x-3">
                          <HelpCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
                          <div>
                            <h3 className="font-bold text-yellow-900 mb-2">Sicherheitshinweis</h3>
                            <p className="text-yellow-800">
                              Verwende niemals echte Credentials in Beispiel-Dateien. Nutze `.env` für lokale
                              Entwicklung und Secrets Manager in Production.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'api' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">API Dokumentation</h1>

                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6 rounded-xl">
                        <h2 className="text-2xl font-bold mb-2">REST API</h2>
                        <p>Vollständige REST API mit OpenAPI-Dokumentation</p>
                      </div>

                      <div className="space-y-4">
                        {[
                          {
                            method: 'POST',
                            endpoint: '/api/domains',
                            description: 'Neue Domain registrieren',
                            color: 'bg-green-100 text-green-800',
                          },
                          {
                            method: 'GET',
                            endpoint: '/api/domains',
                            description: 'Alle Domains abrufen',
                            color: 'bg-blue-100 text-blue-800',
                          },
                          {
                            method: 'GET',
                            endpoint: '/api/certificates/:id',
                            description: 'Zertifikat-Details abrufen',
                            color: 'bg-blue-100 text-blue-800',
                          },
                          {
                            method: 'POST',
                            endpoint: '/api/scan',
                            description: 'Manuellen Scan starten',
                            color: 'bg-green-100 text-green-800',
                          },
                        ].map((api) => (
                          <div key={api.endpoint} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center space-x-4 mb-2">
                              <span
                                className={`px-3 py-1 rounded font-bold text-sm ${api.color}`}
                              >
                                {api.method}
                              </span>
                              <code className="text-gray-800 font-mono">{api.endpoint}</code>
                            </div>
                            <p className="text-gray-600 text-sm">{api.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-gray-900 rounded-xl p-6 text-white font-mono text-sm overflow-x-auto">
                        <div className="text-gray-400 mb-2"># Beispiel: Domain registrieren</div>
                        <div>curl -X POST http://localhost:3000/api/domains \</div>
                        <div className="ml-4">-H "Authorization: Bearer your-token" \</div>
                        <div className="ml-4">-H "Content-Type: application/json" \</div>
                        <div className="ml-4">-d &apos;{`{"domain": "example.com"}`}&apos;</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'architecture' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Architektur</h1>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl">
                      <div className="grid md:grid-cols-3 gap-6 mb-8">
                        {[
                          {
                            icon: Globe,
                            title: 'Frontend',
                            tech: 'React + TypeScript + Vite',
                            description: 'Moderne SPA mit Tailwind CSS',
                          },
                          {
                            icon: Server,
                            title: 'Backend',
                            tech: 'Supabase + Python Worker',
                            description: 'PostgreSQL + Edge Functions',
                          },
                          {
                            icon: Cloud,
                            title: 'MCP Server',
                            tech: 'Node.js + Express + Redis',
                            description: 'AI-freundliche API',
                          },
                        ].map((component) => (
                          <div key={component.title} className="bg-white p-6 rounded-lg shadow-sm">
                            <component.icon className="w-10 h-10 text-blue-600 mb-3" />
                            <h3 className="font-bold text-gray-900 mb-2">{component.title}</h3>
                            <p className="text-sm text-blue-600 font-medium mb-2">{component.tech}</p>
                            <p className="text-sm text-gray-600">{component.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-6 rounded-lg font-mono text-sm">
                        <pre className="text-gray-800 overflow-x-auto">
                          {`┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Supabase  │─────▶│  PostgreSQL │
│ React + Vite│      │ Auth + RLS  │      │   Database  │
└─────────────┘      └─────────────┘      └─────────────┘
       │                     │                     │
       │              ┌──────┴──────┐             │
       │              │             │             │
       ▼              ▼             ▼             ▼
┌─────────────┐  ┌─────────────┐ ┌─────────────┐
│ MCP Server  │  │   Worker    │ │    Agent    │
│  Node.js    │  │   Python    │ │     Go      │
└─────────────┘  └─────────────┘ └─────────────┘
       │                 │              │
       └────────┬────────┴──────────────┘
                │
                ▼
         ┌─────────────┐
         │    Redis    │
         │   Context   │
         └─────────────┘`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'faq' && (
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">Häufig gestellte Fragen</h1>

                    <div className="space-y-4">
                      {[
                        {
                          q: 'Wie funktioniert die automatische Discovery?',
                          a: 'Der Go-Agent scannt konfigurierte Netzwerkbereiche und registriert gefundene Domains automatisch im System.',
                        },
                        {
                          q: 'Kann ich eigene ACME-Provider verwenden?',
                          a: "Ja! Neben Let's Encrypt kannst du jeden ACME-kompatiblen Provider konfigurieren.",
                        },
                        {
                          q: 'Wie sicher sind meine Daten?',
                          a: 'Alle Daten werden verschlüsselt gespeichert. Row-Level Security in PostgreSQL isoliert Mandanten. MFA und Audit-Logs sorgen für zusätzliche Sicherheit.',
                        },
                        {
                          q: 'Kann ich das System selbst hosten?',
                          a: 'Absolut! Mit Docker Compose kannst du alle Komponenten lokal oder auf eigenen Servern betreiben.',
                        },
                        {
                          q: 'Welche Benachrichtigungskanäle werden unterstützt?',
                          a: 'E-Mail, Slack, Microsoft Teams, Webhooks und mehr. Channels sind pro Policy konfigurierbar.',
                        },
                        {
                          q: 'Was ist der MCP-Server?',
                          a: 'Der Model Context Protocol Server ermöglicht es AI-Assistenten wie Claude, direkt mit dem System zu interagieren.',
                        },
                      ].map((faq, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                          <h3 className="font-bold text-gray-900 mb-3 flex items-start">
                            <span className="text-blue-600 mr-2">Q:</span>
                            {faq.q}
                          </h3>
                          <p className="text-gray-600 ml-6">{faq.a}</p>
                        </motion.div>
                      ))}
                    </div>

                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-8 rounded-xl mt-8">
                      <h3 className="text-2xl font-bold mb-4">Weitere Fragen?</h3>
                      <p className="mb-6">
                        Schau in unsere ausführliche Dokumentation oder kontaktiere uns direkt.
                      </p>
                      <button
                        onClick={() => navigate('/login')}
                        className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors inline-flex items-center space-x-2"
                      >
                        <span>Jetzt starten</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </main>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="text-lg font-bold text-white">Zertifikat-Wächter</span>
          </div>
          <p className="mb-2">Enterprise-Grade TLS/SSL Zertifikats-Überwachung</p>
          <p className="text-sm">Made with security in mind</p>
        </div>
      </footer>
    </div>
  )
}

export default Documentation
