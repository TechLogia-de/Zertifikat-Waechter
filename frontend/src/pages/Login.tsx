import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // MFA (TOTP) Login Flow
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null)
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) throw error
    } catch (err: any) {
      console.error('Google login error:', err)
      setError(err.message || 'Google Anmeldung fehlgeschlagen')
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Reset MFA state before a new attempt
    setMfaRequired(false)
    setSelectedFactorId(null)
    setOtpCode('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError && data?.session) {
      // Erfolgreich eingeloggt, App leitet automatisch weiter
      setLoading(false)
      return
    }

    // Prüfe auf MFA-Anforderung
    const isMfaError = !!signInError && (
      // verschiedene mögliche Kennzeichen abdecken
      (signInError.message && signInError.message.toLowerCase().includes('mfa')) ||
      (signInError as any).name === 'AuthMFAError' ||
      (signInError as any).status === 403 ||
      (signInError as any).code === 'mfa_required'
    )

    if (isMfaError) {
      try {
        setMfaLoading(true)
        // Verfügbare Faktoren für diese Anmeldesitzung abfragen
        const { data: factorsData, error: factorsError } = await (supabase.auth as any).mfa.listFactors()
        if (factorsError) throw factorsError

        const factors: any[] = (factorsData?.factors as any[]) || []
        // Bevorzugt verifizierten TOTP‑Faktor wählen; falls keiner verifiziert ist, ersten TOTP nehmen
        const verifiedTotp = factors.find((f) => f.factor_type === 'totp' && f.status === 'verified')
        const fallbackTotp = factors.find((f) => f.factor_type === 'totp')
        const totp = verifiedTotp || fallbackTotp
        if (!totp) {
          throw new Error('MFA ist aktiviert, aber kein TOTP‑Faktor gefunden. Bitte in den Einstellungen prüfen.')
        }

        const factorId: string = totp.id
        setSelectedFactorId(factorId)

        // Challenge starten (notwendig, bevor verifiziert werden kann)
        const { error: challengeError } = await (supabase.auth as any).mfa.challenge({ factorId })
        if (challengeError) throw challengeError

        setMfaRequired(true)
        setSuccess('MFA erforderlich – bitte den 6‑stelligen Code eingeben.')
      } catch (mfaErr: any) {
        console.error('MFA start failed:', mfaErr)
        const msg = (mfaErr?.message || '').toLowerCase()
        if (msg.includes('factor') && msg.includes('not found')) {
          setError('Kein gültiger MFA‑Faktor gefunden. Bitte in den Einstellungen MFA erneut aktivieren.')
        } else if (msg.includes('inactive') || msg.includes('unverified')) {
          setError('MFA‑Faktor ist noch nicht verifiziert. Bitte in den Einstellungen abschließen.')
        } else {
          setError(mfaErr?.message || 'MFA konnte nicht gestartet werden')
        }
      } finally {
        setMfaLoading(false)
        setLoading(false)
      }
      return
    }

    // Kein MFA-Fehler, also „normaler“ Fehler anzeigen
    if (signInError) {
      setError(signInError.message || 'Anmeldung fehlgeschlagen')
    }
    setLoading(false)
  }

  async function verifyOtp() {
    if (!selectedFactorId) {
      setError('Kein TOTP‑Faktor ausgewählt')
      return
    }
    if (otpCode.trim().length !== 6) {
      setError('Bitte 6‑stelligen Code eingeben')
      return
    }
    setVerifyingOtp(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: verifyError } = await (supabase.auth as any).mfa.verify({
        factorId: selectedFactorId,
        code: otpCode.trim(),
      })
      if (verifyError) throw verifyError

      // Erfolgreich: Session wird gesetzt, App leitet automatisch weiter
      setSuccess('Anmeldung erfolgreich')
      setMfaRequired(false)
      setOtpCode('')
      setSelectedFactorId(null)
    } catch (err: any) {
      console.error('MFA verify failed:', err)
      setError(err?.message || 'MFA‑Verifizierung fehlgeschlagen')
    } finally {
      setVerifyingOtp(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    // Validierung
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein')
      setLoading(false)
      return
    }

    if (!tenantName.trim()) {
      setError('Bitte gib einen Firmennamen ein')
      setLoading(false)
      return
    }

    try {
      // 1. Benutzer registrieren
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tenant_name: tenantName.trim()
          }
        }
      })

      if (authError) throw authError

      // Prüfen ob Email-Bestätigung erforderlich ist
      if (authData.user && !authData.session) {
        setSuccess(
          'Registrierung erfolgreich! Bitte prüfe deine E-Mails und bestätige deine Adresse. ' +
          'Danach kannst du dich anmelden.'
        )
        setIsLogin(true)
        setPassword('')
        setConfirmPassword('')
        setTenantName('')
        return
      }

      if (authData.user && authData.session) {
        // User ist direkt eingeloggt (Email-Bestätigung deaktiviert)
        try {
          // 2. Tenant erstellen
          const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert({ name: tenantName.trim() } as any)
            .select()
            .single()

          if (tenantError) {
            console.error('Tenant creation failed:', tenantError)
            throw new Error('Fehler beim Erstellen der Organisation: ' + tenantError.message)
          }

          if (!tenant) {
            throw new Error('Tenant konnte nicht erstellt werden')
          }

          // 3. Membership erstellen (User als Owner)
          const membershipInsert: Database['public']['Tables']['memberships']['Insert'] = {
            user_id: authData.user.id,
            tenant_id: (tenant as any).id,
            role: 'owner'
          }

          const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .insert(membershipInsert as any)
            .select()
            .single()

          if (membershipError) {
            console.error('Membership creation failed:', membershipError)
            
            // Cleanup: Tenant löschen
            await supabase.from('tenants').delete().eq('id', (tenant as any).id)
            
            throw new Error('Fehler beim Erstellen der Mitgliedschaft: ' + membershipError.message)
          }

          // 4. Standard-Policy erstellen
          const policyInsert: Database['public']['Tables']['policies']['Insert'] = {
            tenant_id: (tenant as any).id,
            warn_days: [60, 30, 14, 7, 3, 1],
            channels: { email: true, webhook: false, slack: false, teams: false }
          }

          const { data: policy, error: policyError } = await supabase
            .from('policies')
            .insert(policyInsert as any)
            .select()

          if (policyError) {
            console.error('Policy creation failed:', policyError)
            // Policy ist optional, also nicht abbrechen
          }

          setSuccess('Registrierung erfolgreich! Du bist jetzt eingeloggt.')
          // User ist bereits eingeloggt, wird automatisch zum Dashboard weitergeleitet
          
        } catch (setupError: any) {
          console.error('Setup failed after user creation:', setupError)
          throw setupError
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      setError(err.message || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header mit Logo */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-lg">
              <img 
                src="/logo.png" 
                alt="Zertifikat-Wächter Logo" 
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-white">
              Zertifikat-Wächter
            </h1>
            <p className="text-center text-blue-100 mt-2 text-sm">
              SSL/TLS Certificate Monitoring Platform
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {/* Tabs */}
          <div className="flex mb-4 sm:mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setIsLogin(true)
                setError(null)
                setSuccess(null)
              }}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-sm sm:text-base font-medium transition-colors ${
                isLogin
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Anmelden
            </button>
            <button
              onClick={() => {
                setIsLogin(false)
                setError(null)
                setSuccess(null)
              }}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-sm sm:text-base font-medium transition-colors ${
                !isLogin
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Registrieren
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
              ✅ {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
              ❌ {error}
            </div>
          )}

          {/* MFA Required: OTP Eingabe */}
          {mfaRequired && (
            <div className="mb-6 p-4 border border-yellow-300 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                Zur Sicherheit ist eine Zwei‑Faktor‑Verifizierung erforderlich. Öffne deine Authenticator‑App und gib den 6‑stelligen Code ein.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-4 py-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                  placeholder="123456"
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifyingOtp ? '⏳ Prüfe…' : 'Bestätigen'}
                </button>
              </div>
            </div>
          )}

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Passwort
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {loading ? '⏳ Wird geladen...' : '🔐 Anmelden'}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label htmlFor="tenant-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Firmenname / Organisation
                </label>
                <input
                  id="tenant-name"
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="Meine Firma GmbH"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-2">
                  E-Mail
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Passwort
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Passwort bestätigen
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="Passwort wiederholen"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {loading ? '⏳ Wird erstellt...' : '🚀 Account erstellen'}
              </button>
            </form>
          )}

          {/* Trennlinie mit "ODER" */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">ODER</span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? '⏳ Wird geladen...' : 'Mit Google anmelden'}
          </button>

          {/* Footer */}
          <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
            {isLogin ? (
              <p>
                Noch kein Account?{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Jetzt registrieren
                </button>
              </p>
            ) : (
              <p>
                Bereits registriert?{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Zum Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


