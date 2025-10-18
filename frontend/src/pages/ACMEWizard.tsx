import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface WizardProps {
  tenantId: string
  onComplete: () => void
  existingAccounts: any[]
}

export default function ACMEWizard({ tenantId, onComplete, existingAccounts }: WizardProps) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Form data
  const [accountId, setAccountId] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [domain, setDomain] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [challengeType, setChallengeType] = useState<'dns-01' | 'http-01'>('dns-01')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function createAccountAndOrder() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let finalAccountId = accountId

      // Schritt 1: Account erstellen (falls noch keiner existiert)
      if (!finalAccountId && email) {
        const { data: accountData, error: accountError } = await supabase
          .from('acme_accounts')
          .insert({
            tenant_id: tenantId,
            provider: 'letsencrypt',
            email: email,
            status: 'active'
          })
          .select()
          .single()

        if (accountError) throw accountError
        finalAccountId = accountData.id
        setSuccess(`✅ Account erstellt für ${email}`)
      }

      // Schritt 2: Domain zusammensetzen
      const fullDomain = subdomain ? `${subdomain}.${domain}` : domain

      // Schritt 3: Order erstellen
      const { error: orderError } = await supabase
        .from('acme_orders')
        .insert({
          tenant_id: tenantId,
          acme_account_id: finalAccountId,
          domain: fullDomain,
          challenge_type: challengeType,
          status: 'pending'
        })

      if (orderError) throw orderError

      setSuccess(`✅ Zertifikats-Order erstellt!\n🌐 ${fullDomain}\n\nDas Zertifikat wird automatisch ausgestellt.`)
      
      setTimeout(() => {
        onComplete()
      }, 3000)

    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">🎓 SSL-Zertifikat einrichten - Schritt für Schritt</h2>
          <p className="text-sm opacity-90">Folge der Anleitung, wir führen dich durch!</p>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          <div className="text-xs mt-2 opacity-75">
            Schritt {step} von 3
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Account wählen oder erstellen */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-2">
                  1️⃣ ACME Account
                </h3>
                <p className="text-[#64748B] mb-4">
                  Ein ACME Account wird benötigt um Zertifikate von Let's Encrypt zu beantragen. 
                  Das ist kostenlos und dauert nur eine Minute!
                </p>
              </div>

              {existingAccounts.length > 0 ? (
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Vorhandenen Account nutzen:
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
                  >
                    <option value="">Neuen Account erstellen...</option>
                    {existingAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.email} - {acc.provider}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {(!accountId || existingAccounts.length === 0) && (
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    {existingAccounts.length > 0 ? 'Oder neue E-Mail-Adresse:' : 'Deine E-Mail-Adresse:'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
                  />
                  <p className="text-xs text-[#64748B] mt-2">
                    💡 Diese Email wird nur für wichtige Benachrichtigungen von Let's Encrypt verwendet
                  </p>
                </div>
              )}

              <div className="bg-[#DBEAFE] border-l-4 border-[#3B82F6] p-4 rounded">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <p className="font-semibold text-[#1E40AF] mb-1">Was ist Let's Encrypt?</p>
                    <p className="text-sm text-[#1E3A8A]">
                      Let's Encrypt ist eine kostenlose Certificate Authority (CA), die SSL/TLS-Zertifikate 
                      ausstellt. Millionen von Websites nutzen Let's Encrypt für HTTPS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Domain eingeben */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-2">
                  2️⃣ Deine Domain / Subdomain
                </h3>
                <p className="text-[#64748B] mb-4">
                  Gib die Domain ein, für die du ein SSL-Zertifikat brauchst.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Haupt-Domain:
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.toLowerCase())}
                    placeholder="example.com"
                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Subdomain (optional):
                  </label>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    placeholder="www, api, shop, blog, ..."
                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
                  />
                  <p className="text-xs text-[#64748B] mt-2">
                    💡 Leer lassen für Haupt-Domain, oder z.B. "www" für www.example.com
                  </p>
                </div>

                {(domain || subdomain) && (
                  <div className="bg-[#F8FAFC] border-2 border-[#3B82F6] rounded-lg p-4">
                    <p className="text-sm text-[#64748B] mb-2">Zertifikat wird erstellt für:</p>
                    <p className="text-2xl font-bold text-[#3B82F6]">
                      {subdomain ? `${subdomain}.${domain}` : domain || 'domain.com'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-[#D1FAE5] border-l-4 border-[#10B981] p-4 rounded">
                  <p className="font-semibold text-[#065F46] mb-1">✅ Beispiele:</p>
                  <ul className="text-sm text-[#047857] space-y-1">
                    <li>• example.com</li>
                    <li>• www.example.com</li>
                    <li>• shop.example.com</li>
                    <li>• api.example.com</li>
                  </ul>
                </div>
                <div className="bg-[#FEE2E2] border-l-4 border-[#EF4444] p-4 rounded">
                  <p className="font-semibold text-[#991B1B] mb-1">❌ Nicht möglich:</p>
                  <ul className="text-sm text-[#991B1B] space-y-1">
                    <li>• *.example.com (Wildcard)</li>
                    <li>• localhost</li>
                    <li>• IP-Adressen</li>
                    <li>• .local domains</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Challenge Type */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-2">
                  3️⃣ Verifikations-Methode wählen
                </h3>
                <p className="text-[#64748B] mb-4">
                  Let's Encrypt muss prüfen, dass die Domain dir gehört. Wähle eine Methode:
                </p>
              </div>

              <div className="space-y-4">
                <div
                  onClick={() => setChallengeType('http-01')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    challengeType === 'http-01'
                      ? 'border-[#3B82F6] bg-[#DBEAFE]'
                      : 'border-[#E2E8F0] hover:border-[#3B82F6]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={challengeType === 'http-01'}
                      onChange={() => setChallengeType('http-01')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#0F172A] mb-1">
                        📡 HTTP-01 (Empfohlen für Anfänger)
                      </h4>
                      <p className="text-sm text-[#64748B] mb-2">
                        Einfache Methode: Let's Encrypt ruft deine Website auf Port 80 ab
                      </p>
                      <div className="bg-white rounded p-3 text-xs space-y-1">
                        <p className="text-[#10B981]">✅ Vorteile:</p>
                        <ul className="ml-4 text-[#64748B]">
                          <li>• Sehr einfach</li>
                          <li>• Keine DNS-Konfiguration nötig</li>
                          <li>• Funktioniert sofort</li>
                        </ul>
                        <p className="text-[#EF4444] mt-2">⚠️ Voraussetzung:</p>
                        <ul className="ml-4 text-[#64748B]">
                          <li>• Server muss auf Port 80 erreichbar sein</li>
                          <li>• Domain muss auf deinen Server zeigen</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setChallengeType('dns-01')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    challengeType === 'dns-01'
                      ? 'border-[#3B82F6] bg-[#DBEAFE]'
                      : 'border-[#E2E8F0] hover:border-[#3B82F6]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={challengeType === 'dns-01'}
                      onChange={() => setChallengeType('dns-01')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#0F172A] mb-1">
                        🌐 DNS-01 (Für Fortgeschrittene)
                      </h4>
                      <p className="text-sm text-[#64748B] mb-2">
                        DNS-Methode: Cloudflare API erstellt automatisch DNS-Records
                      </p>
                      <div className="bg-white rounded p-3 text-xs space-y-1">
                        <p className="text-[#10B981]">✅ Vorteile:</p>
                        <ul className="ml-4 text-[#64748B]">
                          <li>• Funktioniert für Wildcard-Zertifikate (*.domain.com)</li>
                          <li>• Kein offener Port 80 nötig</li>
                          <li>• Auch für interne Server</li>
                        </ul>
                        <p className="text-[#EF4444] mt-2">⚠️ Voraussetzung:</p>
                        <ul className="ml-4 text-[#64748B]">
                          <li>• Cloudflare API Token benötigt</li>
                          <li>• Domain muss bei Cloudflare sein</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {challengeType === 'dns-01' && (
                <div className="bg-[#FEF3C7] border-l-4 border-[#F59E0B] p-4 rounded">
                  <p className="font-semibold text-[#92400E] mb-1">💡 Hinweis:</p>
                  <p className="text-sm text-[#78350F]">
                    Für DNS-01 musst du zuerst Cloudflare konfigurieren (oben auf der Seite). 
                    Für den Anfang empfehlen wir <strong>HTTP-01</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg">
              <p className="font-semibold">❌ Fehler:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg">
              <p className="font-semibold">✅ Erfolg!</p>
              <p className="text-sm whitespace-pre-line">{success}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-[#E2E8F0]">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={loading}
                className="px-6 py-3 border-2 border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
              >
                ← Zurück
              </button>
            )}
            
            {step < 3 ? (
              <button
                onClick={() => {
                  // Validation
                  if (step === 1 && !accountId && !email) {
                    setError('Bitte E-Mail-Adresse eingeben oder Account wählen')
                    return
                  }
                  if (step === 2 && !domain) {
                    setError('Bitte Domain eingeben')
                    return
                  }
                  setError(null)
                  setStep(step + 1)
                }}
                className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors shadow-md"
              >
                Weiter →
              </button>
            ) : (
              <button
                onClick={createAccountAndOrder}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-md"
              >
                {loading ? '⏳ Erstelle...' : '✅ Zertifikat beantragen'}
              </button>
            )}

            <button
              onClick={onComplete}
              disabled={loading}
              className="px-6 py-3 text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

