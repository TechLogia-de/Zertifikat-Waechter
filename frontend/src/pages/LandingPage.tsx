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
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

const LandingPage = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      title: t('features.autoDiscovery.title'),
      description: t('features.autoDiscovery.description'),
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Bell,
      title: t('features.alerts.title'),
      description: t('features.alerts.description'),
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: RefreshCw,
      title: t('features.acme.title'),
      description: t('features.acme.description'),
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Shield,
      title: t('features.security.title'),
      description: t('features.security.description'),
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: BarChart3,
      title: t('features.compliance.title'),
      description: t('features.compliance.description'),
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Zap,
      title: t('features.realtime.title'),
      description: t('features.realtime.description'),
      gradient: 'from-yellow-500 to-orange-500',
    },
  ]

  const stats = [
    { value: '24/7', label: t('stats.monitoring'), icon: Clock },
    { value: '99.9%', label: t('stats.uptime'), icon: TrendingUp },
    { value: '< 1min', label: t('stats.alertTime'), icon: Zap },
    { value: 'Enterprise', label: t('stats.security'), icon: Lock },
  ]

  const useCases = [
    {
      icon: Users,
      title: t('useCases.msp.title'),
      description: t('useCases.msp.description'),
    },
    {
      icon: Database,
      title: t('useCases.enterprise.title'),
      description: t('useCases.enterprise.description'),
    },
    {
      icon: Cloud,
      title: t('useCases.cloud.title'),
      description: t('useCases.cloud.description'),
    },
    {
      icon: FileCheck,
      title: t('useCases.compliance.title'),
      description: t('useCases.compliance.description'),
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
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
              />
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Zertifikat-Wächter
              </span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <LanguageSwitcher />

              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/docs')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                {t('nav.documentation')}
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
              >
                {t('nav.login')}
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="md:hidden p-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-200"
          >
            <div className="px-4 py-4 space-y-3">
              <div className="flex justify-center mb-2">
                <LanguageSwitcher />
              </div>
              <button
                onClick={() => {
                  navigate('/docs')
                  setMobileMenuOpen(false)
                }}
                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg font-medium transition-colors"
              >
                {t('nav.documentation')}
              </button>
              <button
                onClick={() => {
                  navigate('/login')
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg text-center"
              >
                {t('nav.login')}
              </button>
            </div>
          </motion.div>
        )}
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
              className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full mb-4 sm:mb-6"
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-medium">{t('hero.badge')}</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent px-4 sm:px-0"
            >
              {t('hero.title.line1')}
              <br />
              {t('hero.title.line2')}
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 sm:mb-10 max-w-3xl mx-auto px-4 sm:px-0"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-base sm:text-lg shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center justify-center space-x-2"
              >
                <span>{t('hero.cta.start')}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/docs')}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-white text-gray-700 rounded-xl font-semibold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all border-2 border-gray-200"
              >
                {t('hero.cta.learn')}
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-12 sm:mt-16 md:mt-20 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-white/80 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
              >
                <stat.icon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mb-2 sm:mb-3 mx-auto" />
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-xs sm:text-sm text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 sm:mb-12 md:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-gray-900">
              {t('features.title')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 px-4 sm:px-0">
              {t('features.subtitle')}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
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
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl sm:rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-lg hover:shadow-2xl transition-all border border-gray-200">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 sm:mb-12 md:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-gray-900">
              {t('useCases.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('useCases.subtitle')}
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

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-100 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              {t('testimonials.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('testimonials.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((num, index) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all border border-gray-200"
              >
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.svg
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.15 + 0.3 + i * 0.1 }}
                      className="w-5 h-5 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </motion.svg>
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed italic">
                  "{t(`testimonials.${num}.text`)}"
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-bold text-gray-900">{t(`testimonials.${num}.author`)}</p>
                  <p className="text-sm text-gray-600">{t(`testimonials.${num}.role`)}</p>
                </div>
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
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('security.title')}</h2>
            <p className="text-xl text-blue-200">
              {t('security.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Lock,
                title: t('security.mfa.title'),
                description: t('security.mfa.description'),
              },
              {
                icon: Shield,
                title: t('security.gdpr.title'),
                description: t('security.gdpr.description'),
              },
              {
                icon: CheckCircle,
                title: t('security.audit.title'),
                description: t('security.audit.description'),
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
              <span className="text-sm font-medium text-blue-200">{t('agent.badge')}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('agent.title')}</h2>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              {t('agent.subtitle')}
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
                  {t('agent.discovery.title')}
                </h3>
                <p className="text-blue-200 mb-4">
                  {t('agent.discovery.description')}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.discovery.feature1')}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.discovery.feature2')}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.discovery.feature3')}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-2xl font-bold mb-4 flex items-center">
                  <Lock className="w-6 h-6 mr-3 text-blue-300" />
                  {t('agent.secure.title')}
                </h3>
                <p className="text-blue-200 mb-4">
                  {t('agent.secure.description')}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.secure.feature1')}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.secure.feature2')}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t('agent.secure.feature3')}</span>
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
                    <h4 className="font-bold text-blue-100 mb-1">{t('agent.edge.title')}</h4>
                    <p className="text-sm text-blue-200">
                      {t('agent.edge.description')}
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
                  {t('alert.title')}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t('alert.description')}
                </p>
                <div className="bg-white rounded-xl p-4 shadow-md border border-orange-200">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {t('alert.example.title')}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t('alert.example.description')}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-orange-600">{t('alert.example.time')}</div>
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
            {t('cta.title')}
          </h2>
          <p className="text-xl mb-10 text-blue-100">
            {t('cta.subtitle')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="px-10 py-5 bg-white text-blue-600 rounded-xl font-bold text-lg shadow-2xl hover:shadow-white/50 transition-all inline-flex items-center space-x-3"
          >
            <span>{t('cta.button')}</span>
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
          <p className="mb-2">{t('footer.tagline')}</p>
          <p className="text-sm">{t('footer.made')}</p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
