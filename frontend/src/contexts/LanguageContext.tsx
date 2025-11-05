import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'de' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language')
    if (saved === 'de' || saved === 'en') {
      return saved
    }
    // Detect browser language
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('de') ? 'de' : 'en'
  })

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    const translations = language === 'de' ? translationsDE : translationsEN
    return translations[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// German Translations
const translationsDE: Record<string, string> = {
  // Navigation
  'nav.documentation': 'Dokumentation',
  'nav.login': 'Anmelden',
  'nav.getStarted': 'Jetzt starten',
  'nav.learnMore': 'Mehr erfahren',

  // Hero Section
  'hero.badge': 'Enterprise-Grade SSL/TLS Monitoring',
  'hero.title.line1': 'Nie wieder abgelaufene',
  'hero.title.line2': 'SSL-Zertifikate',
  'hero.subtitle': 'Vollautomatische Überwachung, intelligente Warnungen und ACME-Integration für eine sichere und unterbrechungsfreie Online-Präsenz',
  'hero.cta.start': 'Jetzt starten',
  'hero.cta.learn': 'Mehr erfahren',

  // Stats
  'stats.monitoring': 'Monitoring',
  'stats.uptime': 'Uptime',
  'stats.alertTime': 'Alert Zeit',
  'stats.security': 'Security',

  // Features Section
  'features.title': 'Alles was du brauchst',
  'features.subtitle': 'Enterprise Features für professionelles Zertifikats-Management',
  'features.autoDiscovery.title': 'Automatische Discovery',
  'features.autoDiscovery.description': 'Scannt automatisch Intranet und Public Domains nach SSL/TLS-Zertifikaten',
  'features.alerts.title': 'Multi-Channel Alerts',
  'features.alerts.description': 'Benachrichtigungen via E-Mail, Slack, Teams und Webhooks bei ablaufenden Zertifikaten',
  'features.acme.title': 'ACME-Integration',
  'features.acme.description': 'Automatische Erneuerung mit Let\'s Encrypt und anderen ACME-Providern',
  'features.security.title': 'Security Intelligence',
  'features.security.description': 'Anomalie-Erkennung und erweiterte Sicherheitsanalysen für deine Zertifikate',
  'features.compliance.title': 'Compliance Reports',
  'features.compliance.description': 'Revisionssichere PDF/CSV-Exporte für Audits und Compliance-Anforderungen',
  'features.realtime.title': 'Echtzeit-Monitoring',
  'features.realtime.description': 'Live-Dashboard mit Metriken und Visualisierungen aller deiner Zertifikate',

  // Use Cases Section
  'useCases.title': 'Perfekt für jeden Einsatz',
  'useCases.subtitle': 'Ob Startup, Mittelstand oder Enterprise - wir haben die Lösung',
  'useCases.msp.title': 'Für IT-Dienstleister',
  'useCases.msp.description': 'Multi-Tenant Support für die Verwaltung mehrerer Kunden',
  'useCases.enterprise.title': 'Für Unternehmen',
  'useCases.enterprise.description': 'Zentrale Überwachung aller internen und externen Zertifikate',
  'useCases.cloud.title': 'Für Cloud-Native',
  'useCases.cloud.description': 'Integration mit Kubernetes, Docker und Cloud-Providern',
  'useCases.compliance.title': 'Für Compliance',
  'useCases.compliance.description': 'Audit-Trails und automatische Reports für ISO, DSGVO, etc.',

  // Security Section
  'security.title': 'Security First',
  'security.subtitle': 'Enterprise-Grade Sicherheit und Compliance',
  'security.mfa.title': 'Multi-Factor Auth',
  'security.mfa.description': 'TOTP-basierte 2FA und Google OAuth Integration',
  'security.gdpr.title': 'DSGVO-konform',
  'security.gdpr.description': 'Vollständige Compliance mit deutschen und EU-Datenschutzgesetzen',
  'security.audit.title': 'Audit-Trail',
  'security.audit.description': 'Revisionssichere Event-Logs mit Hash-Ketten',

  // Agent Section
  'agent.badge': 'Leichtgewichtig & Sicher',
  'agent.title': 'Der Zertifikat-Wächter Agent',
  'agent.subtitle': 'Ein schlanker Go-Agent für automatische Discovery in deinem Intranet',
  'agent.discovery.title': 'Automatische Discovery',
  'agent.discovery.description': 'Der Agent scannt dein Netzwerk und findet automatisch alle Domains mit SSL/TLS-Zertifikaten. Keine manuelle Konfiguration notwendig!',
  'agent.discovery.feature1': 'Netzwerk-Scan für interne Domains',
  'agent.discovery.feature2': 'Automatische Zertifikatserkennung',
  'agent.discovery.feature3': 'Minimal Resource Footprint',
  'agent.secure.title': 'Sicher & Isoliert',
  'agent.secure.description': 'Der Agent läuft isoliert in deinem Netzwerk und kommuniziert nur verschlüsselt mit dem Backend.',
  'agent.secure.feature1': 'TLS-verschlüsselte Kommunikation',
  'agent.secure.feature2': 'API-Key Authentifizierung',
  'agent.secure.feature3': 'Keine sensiblen Daten lokal gespeichert',
  'agent.install.title': 'Installation & Start',
  'agent.edge.title': 'Edge Deployment',
  'agent.edge.description': 'Deploye den Agent direkt auf deinen Edge-Servern oder in Docker-Containern für maximale Flexibilität.',

  // Alert Section
  'alert.title': 'Intelligente Warnungen',
  'alert.description': 'Konfigurierbare Alerts bei 60, 30, 14, 7, 3 und 1 Tag vor Ablauf',
  'alert.example.title': 'example.com läuft in 7 Tagen ab',
  'alert.example.description': 'Zertifikat erneuern oder ACME-Auto-Renewal aktivieren',
  'alert.example.time': 'Vor 2min',

  // CTA Section
  'cta.title': 'Bereit für sorgenfreies SSL-Management?',
  'cta.subtitle': 'Starte jetzt und behalte alle deine Zertifikate im Blick',
  'cta.button': 'Kostenlos starten',

  // Footer
  'footer.tagline': 'Enterprise-Grade TLS/SSL Zertifikats-Überwachung',
  'footer.made': 'Made with security in mind',

  // Testimonials
  'testimonials.title': 'Vertraut von IT-Teams weltweit',
  'testimonials.subtitle': 'Erfahrungen von Unternehmen, die auf Zertifikat-Wächter vertrauen',
  'testimonials.1.text': 'Seit wir Zertifikat-Wächter einsetzen, hatten wir keinen einzigen Ausfall mehr durch abgelaufene Zertifikate. Die ACME-Integration spart uns Stunden an manueller Arbeit.',
  'testimonials.1.author': 'Michael Schmidt',
  'testimonials.1.role': 'DevOps Lead bei TechCorp',
  'testimonials.2.text': 'Die automatische Discovery ist ein Gamechanger. Der Agent hat über 200 interne Zertifikate gefunden, von denen wir gar nicht mehr wussten.',
  'testimonials.2.author': 'Sarah Müller',
  'testimonials.2.role': 'IT Security Manager bei FinanceGmbH',
  'testimonials.3.text': 'Als MSP verwalten wir über 50 Mandanten. Zertifikat-Wächter gibt uns die Kontrolle und unsere Kunden schlafen ruhiger.',
  'testimonials.3.author': 'Thomas Weber',
  'testimonials.3.role': 'CEO bei IT-Solutions AG',
}

// English Translations
const translationsEN: Record<string, string> = {
  // Navigation
  'nav.documentation': 'Documentation',
  'nav.login': 'Sign In',
  'nav.getStarted': 'Get Started',
  'nav.learnMore': 'Learn More',

  // Hero Section
  'hero.badge': 'Enterprise-Grade SSL/TLS Monitoring',
  'hero.title.line1': 'Never worry about expired',
  'hero.title.line2': 'SSL certificates again',
  'hero.subtitle': 'Fully automated monitoring, intelligent alerts, and ACME integration for secure and uninterrupted online presence',
  'hero.cta.start': 'Get Started',
  'hero.cta.learn': 'Learn More',

  // Stats
  'stats.monitoring': 'Monitoring',
  'stats.uptime': 'Uptime',
  'stats.alertTime': 'Alert Time',
  'stats.security': 'Security',

  // Features Section
  'features.title': 'Everything you need',
  'features.subtitle': 'Enterprise features for professional certificate management',
  'features.autoDiscovery.title': 'Automatic Discovery',
  'features.autoDiscovery.description': 'Automatically scans intranet and public domains for SSL/TLS certificates',
  'features.alerts.title': 'Multi-Channel Alerts',
  'features.alerts.description': 'Notifications via email, Slack, Teams, and webhooks for expiring certificates',
  'features.acme.title': 'ACME Integration',
  'features.acme.description': 'Automatic renewal with Let\'s Encrypt and other ACME providers',
  'features.security.title': 'Security Intelligence',
  'features.security.description': 'Anomaly detection and advanced security analytics for your certificates',
  'features.compliance.title': 'Compliance Reports',
  'features.compliance.description': 'Audit-proof PDF/CSV exports for audits and compliance requirements',
  'features.realtime.title': 'Real-time Monitoring',
  'features.realtime.description': 'Live dashboard with metrics and visualizations of all your certificates',

  // Use Cases Section
  'useCases.title': 'Perfect for every use case',
  'useCases.subtitle': 'Whether startup, mid-size, or enterprise - we have the solution',
  'useCases.msp.title': 'For IT Service Providers',
  'useCases.msp.description': 'Multi-tenant support for managing multiple clients',
  'useCases.enterprise.title': 'For Enterprises',
  'useCases.enterprise.description': 'Centralized monitoring of all internal and external certificates',
  'useCases.cloud.title': 'For Cloud-Native',
  'useCases.cloud.description': 'Integration with Kubernetes, Docker, and cloud providers',
  'useCases.compliance.title': 'For Compliance',
  'useCases.compliance.description': 'Audit trails and automated reports for ISO, GDPR, etc.',

  // Security Section
  'security.title': 'Security First',
  'security.subtitle': 'Enterprise-grade security and compliance',
  'security.mfa.title': 'Multi-Factor Auth',
  'security.mfa.description': 'TOTP-based 2FA and Google OAuth integration',
  'security.gdpr.title': 'GDPR Compliant',
  'security.gdpr.description': 'Full compliance with German and EU data protection laws',
  'security.audit.title': 'Audit Trail',
  'security.audit.description': 'Tamper-proof event logs with hash chains',

  // Agent Section
  'agent.badge': 'Lightweight & Secure',
  'agent.title': 'The Certificate Guardian Agent',
  'agent.subtitle': 'A lightweight Go agent for automatic discovery in your intranet',
  'agent.discovery.title': 'Automatic Discovery',
  'agent.discovery.description': 'The agent scans your network and automatically finds all domains with SSL/TLS certificates. No manual configuration required!',
  'agent.discovery.feature1': 'Network scan for internal domains',
  'agent.discovery.feature2': 'Automatic certificate detection',
  'agent.discovery.feature3': 'Minimal resource footprint',
  'agent.secure.title': 'Secure & Isolated',
  'agent.secure.description': 'The agent runs isolated in your network and only communicates encrypted with the backend.',
  'agent.secure.feature1': 'TLS-encrypted communication',
  'agent.secure.feature2': 'API key authentication',
  'agent.secure.feature3': 'No sensitive data stored locally',
  'agent.install.title': 'Installation & Start',
  'agent.edge.title': 'Edge Deployment',
  'agent.edge.description': 'Deploy the agent directly on your edge servers or in Docker containers for maximum flexibility.',

  // Alert Section
  'alert.title': 'Intelligent Alerts',
  'alert.description': 'Configurable alerts at 60, 30, 14, 7, 3, and 1 day before expiration',
  'alert.example.title': 'example.com expires in 7 days',
  'alert.example.description': 'Renew certificate or activate ACME auto-renewal',
  'alert.example.time': '2min ago',

  // CTA Section
  'cta.title': 'Ready for worry-free SSL management?',
  'cta.subtitle': 'Get started now and keep track of all your certificates',
  'cta.button': 'Start for Free',

  // Footer
  'footer.tagline': 'Enterprise-Grade TLS/SSL Certificate Monitoring',
  'footer.made': 'Made with security in mind',

  // Testimonials
  'testimonials.title': 'Trusted by IT teams worldwide',
  'testimonials.subtitle': 'Experiences from companies that trust Certificate Guardian',
  'testimonials.1.text': 'Since we started using Certificate Guardian, we haven\'t had a single outage due to expired certificates. The ACME integration saves us hours of manual work.',
  'testimonials.1.author': 'Michael Schmidt',
  'testimonials.1.role': 'DevOps Lead at TechCorp',
  'testimonials.2.text': 'The automatic discovery is a game changer. The agent found over 200 internal certificates we didn\'t even know about anymore.',
  'testimonials.2.author': 'Sarah Müller',
  'testimonials.2.role': 'IT Security Manager at FinanceGmbH',
  'testimonials.3.text': 'As an MSP, we manage over 50 tenants. Certificate Guardian gives us control and our customers sleep better.',
  'testimonials.3.author': 'Thomas Weber',
  'testimonials.3.role': 'CEO at IT-Solutions AG',
}
