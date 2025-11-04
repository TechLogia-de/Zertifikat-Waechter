import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  Bell,
  Zap,
  Globe,
  Lock,
  CheckCircle,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Database,
  Cloud,
  Settings,
  FileCheck,
  Terminal,
} from 'lucide-react'

const LandingPage = () => {
  const navigate = useNavigate()

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  }

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const features = [
    {
      icon: Globe,
      title: 'Automatische Discovery',
      description: 'Scannt automatisch Intranet und Public Domains nach SSL/TLS-Zertifikaten',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Bell,
      title: 'Multi-Channel Alerts',
      description: 'Benachrichtigungen via E-Mail, Slack, Teams und Webhooks bei ablaufenden Zertifikaten',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: RefreshCw,
      title: 'ACME-Integration',
      description: "Automatische Erneuerung mit Let's Encrypt und anderen ACME-Providern",
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Shield,
      title: 'Security Intelligence',
      description: 'Anomalie-Erkennung und erweiterte Sicherheitsanalysen für deine Zertifikate',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: BarChart3,
      title: 'Compliance Reports',
      description: 'Revisionssichere PDF/CSV-Exporte für Audits und Compliance-Anforderungen',
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Zap,
      title: 'Echtzeit-Monitoring',
      description: 'Live-Dashboard mit Metriken und Visualisierungen aller deiner Zertifikate',
      gradient: 'from-yellow-500 to-orange-500',
    },
  ]

  const stats = [
    { value: '24/7', label: 'Monitoring', icon: Clock },
    { value: '99.9%', label: 'Uptime', icon: TrendingUp },
    { value: '< 1min', label: 'Alert Zeit', icon: Zap },
    { value: 'Enterprise', label: 'Security', icon: Lock },
  ]

  const useCases = [
    {
      icon: Users,
      title: 'Für IT-Dienstleister',
      description: 'Multi-Tenant Support für die Verwaltung mehrerer Kunden',
    },
    {
      icon: Database,
      title: 'Für Unternehmen',
      description: 'Zentrale Überwachung aller internen und externen Zertifikate',
    },
    {
      icon: Cloud,
      title: 'Für Cloud-Native',
      description: 'Integration mit Kubernetes, Docker und Cloud-Providern',
    },
    {
      icon: FileCheck,
      title: 'Für Compliance',
      description: 'Audit-Trails und automatische Reports für ISO, DSGVO, etc.',
    },
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
              className="flex items-center space-x-2"
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
                onClick={() => navigate('/docs')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Dokumentation
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Enterprise-Grade SSL/TLS Monitoring</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent"
            >
              Nie wieder abgelaufene
              <br />
              SSL-Zertifikate
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto"
            >
              Vollautomatische Überwachung, intelligente Warnungen und ACME-Integration
              für eine sichere und unterbrechungsfreie Online-Präsenz
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center justify-center space-x-2"
              >
                <span>Jetzt starten</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all border-2 border-gray-200"
              >
                Demo ansehen
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
              >
                <stat.icon className="w-8 h-8 text-blue-600 mb-3 mx-auto" />
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Alles was du brauchst
            </h2>
            <p className="text-xl text-gray-600">
              Enterprise Features für professionelles Zertifikats-Management
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ y: -8 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all border border-gray-200">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Perfekt für jeden Einsatz
            </h2>
            <p className="text-xl text-gray-600">
              Ob Startup, Mittelstand oder Enterprise - wir haben die Lösung
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-200"
              >
                <useCase.icon className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold mb-2 text-gray-900">{useCase.title}</h3>
                <p className="text-gray-600 text-sm">{useCase.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Compliance Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Security First</h2>
            <p className="text-xl text-blue-200">
              Enterprise-Grade Sicherheit und Compliance
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Lock,
                title: 'Multi-Factor Auth',
                description: 'TOTP-basierte 2FA und Google OAuth Integration',
              },
              {
                icon: Shield,
                title: 'DSGVO-konform',
                description: 'Vollständige Compliance mit deutschen und EU-Datenschutzgesetzen',
              },
              {
                icon: CheckCircle,
                title: 'Audit-Trail',
                description: 'Revisionssichere Event-Logs mit Hash-Ketten',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all"
              >
                <item.icon className="w-12 h-12 text-blue-300 mb-4" />
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-blue-200">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center space-x-2 bg-blue-500/20 px-4 py-2 rounded-full mb-6">
              <Settings className="w-5 h-5 text-blue-300" />
              <span className="text-sm font-medium text-blue-200">Leichtgewichtig & Sicher</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Der Zertifikat-Wächter Agent</h2>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              Ein schlanker Go-Agent für automatische Discovery in deinem Intranet
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-2xl font-bold mb-4 flex items-center">
                  <Terminal className="w-6 h-6 mr-3 text-blue-300" />
                  Automatische Discovery
                </h3>
                <p className="text-blue-200 mb-4">
                  Der Agent scannt dein Netzwerk und findet automatisch alle Domains mit SSL/TLS-Zertifikaten.
                  Keine manuelle Konfiguration notwendig!
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Netzwerk-Scan für interne Domains</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Automatische Zertifikatserkennung</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Minimal Resource Footprint</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-2xl font-bold mb-4 flex items-center">
                  <Lock className="w-6 h-6 mr-3 text-blue-300" />
                  Sicher & Isoliert
                </h3>
                <p className="text-blue-200 mb-4">
                  Der Agent läuft isoliert in deinem Netzwerk und kommuniziert nur verschlüsselt mit dem Backend.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>TLS-verschlüsselte Kommunikation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>API-Key Authentifizierung</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Keine sensiblen Daten lokal gespeichert</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Terminal className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Installation & Start</span>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-gray-400"># Download Agent</div>
                  <div className="text-white">wget https://releases.cert-watcher.com/agent</div>
                  <div className="text-white mt-3">chmod +x agent</div>
                  <div className="text-gray-400 mt-4"># Konfiguration</div>
                  <div className="text-white">export API_KEY=your-api-key</div>
                  <div className="text-white">export API_URL=https://api.cert-watcher.com</div>
                  <div className="text-gray-400 mt-4"># Starten</div>
                  <div className="text-white">./agent scan --network 192.168.0.0/24</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Go', value: '1.22+', icon: '🚀' },
                  { label: 'Docker', value: 'Support', icon: '🐳' },
                  { label: 'Größe', value: '~10MB', icon: '📦' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center border border-white/20"
                  >
                    <div className="text-2xl mb-2">{stat.icon}</div>
                    <div className="text-sm text-blue-200">{stat.label}</div>
                    <div className="text-lg font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 text-blue-300 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-blue-100 mb-1">Edge Deployment</h4>
                    <p className="text-sm text-blue-200">
                      Deploye den Agent direkt auf deinen Edge-Servern oder in Docker-Containern für maximale
                      Flexibilität.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Alert Example Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl p-12 border-2 border-orange-200 shadow-2xl"
          >
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">
                  Intelligente Warnungen
                </h3>
                <p className="text-gray-600 mb-4">
                  Konfigurierbare Alerts bei 60, 30, 14, 7, 3 und 1 Tag vor Ablauf
                </p>
                <div className="bg-white rounded-xl p-4 shadow-md border border-orange-200">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        example.com läuft in 7 Tagen ab
                      </div>
                      <div className="text-sm text-gray-600">
                        Zertifikat erneuern oder ACME-Auto-Renewal aktivieren
                      </div>
                    </div>
                    <div className="text-sm font-medium text-orange-600">Vor 2min</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-600">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center text-white"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Bereit für sorgenfreies SSL-Management?
          </h2>
          <p className="text-xl mb-10 text-blue-100">
            Starte jetzt und behalte alle deine Zertifikate im Blick
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="px-10 py-5 bg-white text-blue-600 rounded-xl font-bold text-lg shadow-2xl hover:shadow-white/50 transition-all inline-flex items-center space-x-3"
          >
            <span>Kostenlos starten</span>
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </section>

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

export default LandingPage
