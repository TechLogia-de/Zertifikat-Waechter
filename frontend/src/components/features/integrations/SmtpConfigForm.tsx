import { memo } from 'react'
// SMTP configuration form with system SMTP toggle and test email section

interface SMTPConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
  secure: boolean
  use_system_smtp?: boolean
}

interface TestEmailState {
  recipient: string
  subject: string
  body: string
}

interface SmtpConfigFormProps {
  smtpConfig: SMTPConfig
  onSmtpConfigChange: (config: SMTPConfig) => void
  testEmail: TestEmailState
  onTestEmailChange: (state: TestEmailState) => void
  userEmail?: string
  saving: boolean
  onSave: () => void
  onTest: () => void
}

function SmtpConfigForm({
  smtpConfig,
  onSmtpConfigChange,
  testEmail,
  onTestEmailChange,
  userEmail,
  saving,
  onSave,
  onTest,
}: SmtpConfigFormProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-[#DBEAFE] rounded-lg">
          <span className="text-2xl">📧</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">E-Mail Benachrichtigungen</h2>
          <p className="text-sm text-[#64748B]">Wähle zwischen eigenem SMTP oder System-SMTP von Zertifikat-Wächter</p>
        </div>
      </div>

      {/* System-SMTP Toggle */}
      <div className="mb-6 bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] border border-[#3B82F6] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">
              🛡️ System-Benachrichtigungen
            </h3>
            <p className="text-sm text-[#475569] mb-3">
              {smtpConfig.use_system_smtp ? (
                <>
                  <strong className="text-[#10B981]">✅ Aktiviert:</strong> Du nutzt den SMTP-Server von Zertifikat-Wächter.
                  E-Mails werden über unseren zuverlässigen Server versendet - keine eigene Konfiguration nötig!
                </>
              ) : (
                <>
                  <strong className="text-[#64748B]">⚙️ Eigener SMTP:</strong> Du verwendest deinen eigenen E-Mail-Server.
                  Trage unten deine SMTP-Zugangsdaten ein.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => onSmtpConfigChange({ ...smtpConfig, use_system_smtp: !smtpConfig.use_system_smtp })}
              className={`relative inline-flex items-center px-6 py-3 rounded-lg font-semibold transition-all ${
                smtpConfig.use_system_smtp
                  ? 'bg-[#10B981] text-white shadow-lg hover:bg-[#059669]'
                  : 'bg-white text-[#64748B] border-2 border-[#E2E8F0] hover:border-[#3B82F6]'
              }`}
            >
              <span className="mr-2 text-xl">
                {smtpConfig.use_system_smtp ? '🛡️' : '⚙️'}
              </span>
              {smtpConfig.use_system_smtp ? 'System-SMTP aktiv' : 'Eigenen SMTP verwenden'}
              <span className="ml-2">
                {smtpConfig.use_system_smtp ? '✓' : '→'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* SMTP Config fields - disabled when system SMTP is active */}
        <div className={smtpConfig.use_system_smtp ? 'opacity-50 pointer-events-none' : ''}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                SMTP Host
              </label>
              <input
                type="text"
                value={smtpConfig.host}
                onChange={(e) => onSmtpConfigChange({ ...smtpConfig, host: e.target.value })}
                placeholder="smtp.gmail.com"
                disabled={smtpConfig.use_system_smtp}
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] disabled:bg-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Port
              </label>
              <input
                type="number"
                value={smtpConfig.port}
                onChange={(e) => onSmtpConfigChange({ ...smtpConfig, port: parseInt(e.target.value) })}
                disabled={smtpConfig.use_system_smtp}
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] disabled:bg-[#F8FAFC]"
              />
              <p className="text-xs text-[#64748B] mt-1">Standard: 587 (TLS), 465 (SSL)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Benutzername / E-Mail
            </label>
            <input
              type="text"
              value={smtpConfig.user}
              onChange={(e) => onSmtpConfigChange({ ...smtpConfig, user: e.target.value })}
              placeholder="alerts@example.com"
              disabled={smtpConfig.use_system_smtp}
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] disabled:bg-[#F8FAFC]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Passwort / App-Password
            </label>
            <input
              type="password"
              value={smtpConfig.password}
              onChange={(e) => onSmtpConfigChange({ ...smtpConfig, password: e.target.value })}
              placeholder="••••••••"
              disabled={smtpConfig.use_system_smtp}
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] disabled:bg-[#F8FAFC]"
            />
            <p className="text-xs text-[#64748B] mt-1">
              💡 Gmail: Verwende ein App-Passwort (nicht dein normales Passwort)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Absender (From)
            </label>
            <input
              type="email"
              value={smtpConfig.from}
              onChange={(e) => onSmtpConfigChange({ ...smtpConfig, from: e.target.value })}
              placeholder="noreply@example.com"
              disabled={smtpConfig.use_system_smtp}
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] disabled:bg-[#F8FAFC]"
            />
          </div>

          <div className="flex items-center space-x-3 p-4 bg-[#F8FAFC] rounded-lg">
            <input
              type="checkbox"
              id="smtp-secure"
              checked={smtpConfig.secure}
              onChange={(e) => onSmtpConfigChange({ ...smtpConfig, secure: e.target.checked })}
              disabled={smtpConfig.use_system_smtp}
              className="w-5 h-5 text-[#3B82F6] border-[#CBD5E1] rounded focus:ring-[#3B82F6]"
            />
            <label htmlFor="smtp-secure" className="text-sm font-medium text-[#0F172A]">
              SSL/TLS Verschlüsselung verwenden (empfohlen)
            </label>
          </div>
        </div>

        {/* Test Email Section */}
        <div className="border-t border-[#E2E8F0] pt-4 mt-4">
          <h3 className="text-sm font-bold text-[#0F172A] mb-3">📧 Test-E-Mail senden</h3>
          <p className="text-sm text-[#64748B] mb-3">
            Gib deine E-Mail-Adresse ein um eine Test-Benachrichtigung zu erhalten.
          </p>
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              value={testEmail.recipient}
              onChange={(e) => onTestEmailChange({ ...testEmail, recipient: e.target.value })}
              placeholder={userEmail || 'deine-email@example.com'}
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Speichere...' : '💾 SMTP speichern'}
          </button>
          <button
            onClick={onTest}
            disabled={saving}
            className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Teste...' : '📧 Test-Mail senden'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(SmtpConfigForm)
