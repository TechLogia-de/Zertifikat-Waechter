import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)

  useEffect(() => {
    // Prüfe ob ein gültiger Reset-Token in der URL ist
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')
    
    if (type === 'recovery' && accessToken) {
      setValidToken(true)
      console.log('✅ Gültiger Password-Reset-Token erkannt')
    } else {
      setError('Ungültiger oder abgelaufener Reset-Link. Bitte fordere einen neuen an.')
    }
  }, [])

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validierung
    if (!newPassword || !confirmPassword) {
      setError('Bitte beide Passwort-Felder ausfüllen')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('❌ Passwörter stimmen nicht überein!')
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError('❌ Passwort muss mindestens 8 Zeichen lang sein!')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      setSuccess(true)
      
      // Nach 3 Sekunden zum Login weiterleiten
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Zurücksetzen des Passworts')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10">
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-lg">
              <img 
                src="/logo.png" 
                alt="Zertifikat-Wächter Logo" 
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-center text-white">
              Passwort zurücksetzen
            </h1>
            <p className="text-center text-blue-100 mt-2">
              Setze ein neues, sicheres Passwort
            </p>
          </div>
        </div>

        <div className="p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-800">
                Passwort erfolgreich zurückgesetzt!
              </h2>
              <p className="text-gray-600">
                Du wirst in wenigen Sekunden zum Login weitergeleitet...
              </p>
              <div className="mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            </div>
          ) : !validToken ? (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-800">
                Ungültiger Reset-Link
              </h2>
              <p className="text-gray-600 mb-4">
                {error || 'Dieser Link ist ungültig oder abgelaufen.'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                Zurück zum Login
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  ❌ {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Neues Passwort
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Mindestens 8 Zeichen"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passwort bestätigen
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Passwort wiederholen"
                    required
                  />
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Passwort-Stärke:</span>
                      <span className={`font-semibold ${
                        newPassword.length < 8 ? 'text-red-600' :
                        newPassword.length < 12 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {newPassword.length < 8 ? 'Schwach' :
                         newPassword.length < 12 ? 'Mittel' :
                         'Stark'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          newPassword.length < 8 ? 'bg-red-500 w-1/3' :
                          newPassword.length < 12 ? 'bg-yellow-500 w-2/3' :
                          'bg-green-500 w-full'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 8}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                >
                  {loading ? '⏳ Setze Passwort...' : '🔒 Passwort speichern'}
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    💡 Nach dem Passwort-Reset:
                  </h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Melde dich mit E-Mail + Passwort an</li>
                    <li>Gehe zu "Einstellungen"</li>
                    <li>Aktiviere MFA (TOTP) für extra Sicherheit</li>
                  </ol>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

