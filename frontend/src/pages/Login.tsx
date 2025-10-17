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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 py-5 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-white">
            🛡️ Zertifikat-Wächter
          </h1>
          <p className="text-center text-blue-100 mt-2 text-xs sm:text-sm">
            SSL/TLS Zertifikate überwachen
          </p>
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


