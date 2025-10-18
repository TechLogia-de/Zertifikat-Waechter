import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'

interface UserProfile {
  full_name: string
  company: string
  phone: string
  avatar_url: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Tenant Data
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantName, setTenantName] = useState<string>('')
  const [savingTenant, setSavingTenant] = useState(false)

  // Profile Data
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    company: '',
    phone: '',
    avatar_url: null
  })

  // Email Change
  const [newEmail, setNewEmail] = useState('')
  const [emailChanging, setEmailChanging] = useState(false)

  // Password Change
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordChanging, setPasswordChanging] = useState(false)

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [user])

  async function loadProfile() {
    if (!user) return

    try {
      // Load Tenant info
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id, tenants(name)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        const membershipData = membership as any
        setTenantId(membershipData.tenant_id)
        if (membershipData.tenants) {
          setTenantName(membershipData.tenants.name || '')
        }
      }

      // Supabase speichert user_metadata für Profile-Daten
      const metadata = user.user_metadata || {}
      
      setProfile({
        full_name: metadata.full_name || '',
        company: metadata.company || '',
        phone: metadata.phone || '',
        avatar_url: metadata.avatar_url || null
      })

      setNewEmail(user.email || '')
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          company: profile.company,
          phone: profile.phone,
          avatar_url: profile.avatar_url
        }
      })

      if (updateError) throw updateError

      setSuccess('✅ Profil erfolgreich aktualisiert!')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
      setTimeout(() => setError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function saveTenantName() {
    if (!tenantId || !tenantName) {
      setError('Bitte Organisation eingeben')
      return
    }

    setSavingTenant(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await (supabase as any)
        .from('tenants')
        .update({ name: tenantName })
        .eq('id', tenantId)

      if (updateError) throw updateError

      setSuccess(`✅ Organisation aktualisiert: ${tenantName}`)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Organisation')
      setTimeout(() => setError(null), 5000)
    } finally {
      setSavingTenant(false)
    }
  }

  async function changeEmail() {
    if (!newEmail) {
      setError('Bitte E-Mail-Adresse eingeben')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setError('❌ Ungültige E-Mail-Adresse!')
      return
    }

    if (newEmail === user?.email) {
      setError('Das ist bereits deine aktuelle E-Mail-Adresse')
      return
    }

    setEmailChanging(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (updateError) throw updateError

      setSuccess(`✅ Bestätigungs-E-Mail gesendet an ${newEmail}!\n\nBitte prüfe dein Postfach und bestätige die neue E-Mail-Adresse.`)
      setTimeout(() => setSuccess(null), 10000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Ändern der E-Mail')
      setTimeout(() => setError(null), 5000)
    } finally {
      setEmailChanging(false)
    }
  }

  async function changePassword() {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Bitte alle Passwort-Felder ausfüllen')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('❌ Passwörter stimmen nicht überein!')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setError('❌ Passwort muss mindestens 8 Zeichen lang sein!')
      return
    }

    setPasswordChanging(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) throw updateError

      setSuccess('✅ Passwort erfolgreich geändert!')
      setShowPasswordChange(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Ändern des Passworts')
      setTimeout(() => setError(null), 5000)
    } finally {
      setPasswordChanging(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">👤 Mein Profil</h1>
        <p className="text-sm md:text-base text-[#64748B] mt-1">
          Persönliche Daten • E-Mail ändern • Passwort ändern • Profil verwalten
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-[#D1FAE5] border-2 border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-start">
                <span className="text-2xl mr-3">✅</span>
                <div>
                  <p className="font-bold text-lg mb-1">Erfolg!</p>
                  <p className="text-sm whitespace-pre-line">{success}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#FEE2E2] border-2 border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-start">
                <span className="text-2xl mr-3">❌</span>
                <div>
                  <p className="font-bold text-lg mb-1">Fehler!</p>
                  <p className="text-sm whitespace-pre-line">{error}</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <LoadingState size="lg" text="Lade Profil..." />
          ) : (
            <>
              {/* User Info Card */}
              <div className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl border-4 border-white/30">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{user?.email?.charAt(0).toUpperCase() || '👤'}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-1">
                      {profile.full_name || user?.email?.split('@')[0] || 'Benutzer'}
                    </h2>
                    <p className="text-white/80 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      {user?.email}
                    </p>
                    {tenantName && (
                      <p className="text-white/70 text-sm mt-1 flex items-center gap-2">
                        <span>🏢</span>
                        <span>{tenantName}</span>
                      </p>
                    )}
                    {profile.company && (
                      <p className="text-white/60 text-xs mt-1 flex items-center gap-2">
                        <span>💼</span>
                        <span>{profile.company}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Organisation / Tenant */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-lg">
                    <span className="text-3xl">🏢</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0F172A]">Organisation / Firma</h2>
                    <p className="text-sm text-[#64748B]">Wird im Dashboard und Header angezeigt</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Organisations-Name
                    </label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="ACME GmbH, Techlogia, GASAG, ..."
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                    <p className="text-xs text-[#64748B] mt-2">
                      💡 Dieser Name wird im Dashboard-Header als "🏢 {tenantName}" angezeigt
                    </p>
                  </div>

                  <button
                    onClick={saveTenantName}
                    disabled={savingTenant}
                    className="w-full px-6 py-3 bg-[#F59E0B] text-white rounded-lg font-semibold hover:bg-[#D97706] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                  >
                    {savingTenant ? '⏳ Speichere...' : '🏢 Organisation speichern'}
                  </button>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-lg">
                    <span className="text-3xl">📝</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0F172A]">Persönliche Informationen</h2>
                    <p className="text-sm text-[#64748B]">Aktualisiere deine Profil-Daten</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Vollständiger Name
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      placeholder="Max Mustermann"
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Abteilung / Position (optional)
                    </label>
                    <input
                      type="text"
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                      placeholder="IT-Administrator, DevOps, ..."
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Telefon (optional)
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+49 123 456789"
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                  </div>

                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                  >
                    {saving ? '⏳ Speichere...' : '💾 Profil speichern'}
                  </button>
                </div>
              </div>

              {/* Email Change */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-lg">
                    <span className="text-3xl">📧</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0F172A]">E-Mail-Adresse ändern</h2>
                    <p className="text-sm text-[#64748B]">Deine Login-E-Mail ändern</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Aktuelle E-Mail-Adresse
                    </label>
                    <div className="px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-lg text-[#64748B]">
                      {user?.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Neue E-Mail-Adresse
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="neue-email@example.com"
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                  </div>

                  <div className="bg-[#DBEAFE] border-l-4 border-[#3B82F6] p-4 rounded">
                    <div className="flex items-start gap-2">
                      <span className="text-xl">ℹ️</span>
                      <div>
                        <p className="text-sm text-[#1E40AF] font-semibold mb-1">
                          Wichtig: Bestätigung erforderlich!
                        </p>
                        <p className="text-xs text-[#1E3A8A]">
                          Nach dem Ändern erhältst du eine Bestätigungs-E-Mail an die neue Adresse. 
                          Klicke auf den Link in der E-Mail um die Änderung zu bestätigen.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={changeEmail}
                    disabled={emailChanging || newEmail === user?.email}
                    className="w-full px-6 py-3 bg-[#F59E0B] text-white rounded-lg font-semibold hover:bg-[#D97706] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                  >
                    {emailChanging ? '⏳ Ändere...' : '📧 E-Mail ändern'}
                  </button>
                </div>
              </div>

              {/* Password Change */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-[#FEE2E2] to-[#FECACA] rounded-lg">
                      <span className="text-3xl">🔒</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Passwort ändern</h2>
                      <p className="text-sm text-[#64748B]">Sichere dein Konto</p>
                    </div>
                  </div>
                  {!showPasswordChange && (
                    <button
                      onClick={() => setShowPasswordChange(true)}
                      className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors shadow-md"
                    >
                      Passwort ändern
                    </button>
                  )}
                </div>

                {showPasswordChange ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                        Neues Passwort
                      </label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="Mindestens 8 Zeichen"
                        className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                        Passwort bestätigen
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="Passwort wiederholen"
                        className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                      />
                    </div>

                    {/* Password Strength Indicator */}
                    {passwordData.newPassword && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#64748B]">Passwort-Stärke:</span>
                          <span className={`font-semibold ${
                            passwordData.newPassword.length < 8 ? 'text-[#EF4444]' :
                            passwordData.newPassword.length < 12 ? 'text-[#F59E0B]' :
                            'text-[#10B981]'
                          }`}>
                            {passwordData.newPassword.length < 8 ? 'Schwach' :
                             passwordData.newPassword.length < 12 ? 'Mittel' :
                             'Stark'}
                          </span>
                        </div>
                        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              passwordData.newPassword.length < 8 ? 'bg-[#EF4444] w-1/3' :
                              passwordData.newPassword.length < 12 ? 'bg-[#F59E0B] w-2/3' :
                              'bg-[#10B981] w-full'
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowPasswordChange(false)
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                        }}
                        disabled={passwordChanging}
                        className="flex-1 px-4 py-3 border-2 border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={changePassword}
                        disabled={passwordChanging || passwordData.newPassword.length < 8}
                        className="flex-1 px-4 py-3 bg-[#EF4444] text-white rounded-lg font-semibold hover:bg-[#DC2626] disabled:opacity-50 transition-all shadow-md"
                      >
                        {passwordChanging ? '⏳ Ändere...' : '🔒 Passwort ändern'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-[#64748B]">
                    <p className="text-sm">
                      Dein Passwort ist sicher verschlüsselt. Klicke auf "Passwort ändern" um es zu aktualisieren.
                    </p>
                  </div>
                )}
              </div>

              {/* Account Info */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-r from-[#D1FAE5] to-[#DCFCE7] rounded-lg">
                    <span className="text-3xl">ℹ️</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0F172A]">Account-Informationen</h2>
                    <p className="text-sm text-[#64748B]">Details zu deinem Account</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="text-sm text-[#64748B]">User ID</p>
                      <p className="font-mono text-xs text-[#0F172A] mt-1">{user?.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="text-sm text-[#64748B]">Account erstellt</p>
                      <p className="font-semibold text-[#0F172A] mt-1">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('de-DE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Unbekannt'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="text-sm text-[#64748B]">Letzter Login</p>
                      <p className="font-semibold text-[#0F172A] mt-1">
                        {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('de-DE') : 'Unbekannt'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="text-sm text-[#64748B]">E-Mail bestätigt</p>
                      <p className="font-semibold text-[#0F172A] mt-1">
                        {user?.email_confirmed_at ? (
                          <span className="text-[#10B981]">✅ Ja</span>
                        ) : (
                          <span className="text-[#EF4444]">❌ Nein</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white rounded-xl border-2 border-[#EF4444] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[#FEE2E2] rounded-lg">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#EF4444]">Gefahrenzone</h2>
                    <p className="text-sm text-[#64748B]">Irreversible Aktionen</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#FEE2E2] border border-[#EF4444] rounded-lg p-4">
                    <p className="text-sm text-[#991B1B] mb-3">
                      <strong>Account löschen:</strong> Dies wird deinen Account und alle zugehörigen Daten permanent löschen. 
                      Diese Aktion kann nicht rückgängig gemacht werden!
                    </p>
                    <button
                      onClick={() => {
                        const confirmed = confirm(
                          '⚠️ WARNUNG!\n\nMöchtest du deinen Account wirklich löschen?\n\n' +
                          '• Alle Zertifikate werden gelöscht\n' +
                          '• Alle Alerts werden gelöscht\n' +
                          '• Alle Orders werden gelöscht\n' +
                          '• Diese Aktion kann NICHT rückgängig gemacht werden!\n\n' +
                          'Tippe "LÖSCHEN" um zu bestätigen.'
                        )
                        if (confirmed) {
                          alert('Account-Löschung ist noch nicht implementiert. Kontaktiere den Support.')
                        }
                      }}
                      className="w-full px-4 py-3 bg-[#EF4444] text-white rounded-lg font-semibold hover:bg-[#DC2626] transition-all shadow-md"
                    >
                      🗑️ Account permanent löschen
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

