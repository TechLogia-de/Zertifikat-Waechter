import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import QRCode from 'qrcode'
import { logMFASecurityEvent, checkMFABruteForce } from '../utils/mfaSecurityLogger'

interface Policy {
  id: string
  tenant_id: string
  warn_days: number[]
  channels: {
    email: boolean
    webhook: boolean
    slack: boolean
    teams: boolean
  }
}

export default function Settings() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string>('')
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // MFA (TOTP) State
  type FactorStatus = 'verified' | 'unverified' | 'pending' | 'errored'
  interface TotpFactor {
    id: string
    factor_type: 'totp'
    status: FactorStatus
    friendly_name?: string | null
  }

  const [mfaLoading, setMfaLoading] = useState<boolean>(false)
  const [totpFactor, setTotpFactor] = useState<TotpFactor | null>(null)
  const [totpEnabled, setTotpEnabled] = useState<boolean>(false)
  const [enrolling, setEnrolling] = useState<boolean>(false)
  const [verifying, setVerifying] = useState<boolean>(false)
  const [disabling, setDisabling] = useState<boolean>(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpIssuer, setTotpIssuer] = useState<string | null>(null)
  const [totpLabel, setTotpLabel] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    loadMfaStatus()
  }, [user])

  async function loadSettings() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        setTenantId(membership.tenant_id)

        const { data: policyData } = await supabase
          .from('policies')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .maybeSingle()

        if (policyData) {
          setPolicy(policyData as Policy)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMfaStatus() {
    if (!user) return
    setMfaLoading(true)
    setMfaError(null)
    try {
      console.log('📡 Lade MFA-Status von Supabase...')
      const { data, error } = await (supabase.auth as any).mfa.listFactors()
      if (error) throw error

      const factors: any[] = (data?.factors as any[]) || []
      console.log('📋 Gefundene MFA-Faktoren:', factors.length)
      
      const totp = factors.find((f) => f.factor_type === 'totp') || null
      if (totp) {
        console.log('🔐 TOTP-Faktor gefunden:', {
          id: totp.id.substring(0, 8) + '...',
          status: totp.status,
          friendly_name: totp.friendly_name
        })
        
        setTotpFactor({
          id: totp.id,
          factor_type: 'totp',
          status: totp.status as FactorStatus,
          friendly_name: (totp as any).friendly_name ?? null,
        })
        
        const isVerified = totp.status === 'verified'
        setTotpEnabled(isVerified)
        
        console.log(isVerified ? '✅ MFA ist aktiviert (verified)' : '⚠️ MFA nicht aktiviert (Status: ' + totp.status + ')')
      } else {
        console.log('❌ Kein TOTP-Faktor gefunden')
        setTotpFactor(null)
        setTotpEnabled(false)
      }
    } catch (err: any) {
      console.error('❌ Fehler beim Laden des MFA-Status:', err)
      setMfaError(err.message || 'Fehler beim Laden des MFA-Status')
    } finally {
      setMfaLoading(false)
    }
  }

  // Versucht, einen vorhandenen, noch nicht verifizierten TOTP‑Faktor wiederzufinden
  async function recoverUnverifiedTotpFactor(): Promise<TotpFactor | null> {
    try {
      const { data, error } = await (supabase.auth as any).mfa.listFactors()
      if (error) throw error
      const factors: any[] = (data?.factors as any[]) || []
      const totp = factors.find((f) => f.factor_type === 'totp' && f.status !== 'verified')
      if (totp) {
        const recovered: TotpFactor = {
          id: totp.id,
          factor_type: 'totp',
          status: totp.status as FactorStatus,
          friendly_name: (totp as any).friendly_name ?? null,
        }
        setTotpFactor(recovered)
        setTotpEnabled(false)
        return recovered
      }
    } catch (e) {
      console.error('Failed to recover TOTP factor:', e)
    }
    return null
  }

  async function startMfaEnrollment() {
    setEnrolling(true)
    setMfaError(null)
    setMfaSuccess(null)
    setQrImageUrl(null)
    setTotpUri(null)
    setTotpSecret(null)
    setTotpIssuer(null)
    setTotpLabel(null)
    setVerificationCode('')

    // Log MFA enrollment started
    await logMFASecurityEvent({
      event_type: 'mfa.enrollment.started',
      metadata: { method: 'TOTP' }
    })

    // Log aktuellen Auth-Status für Debugging
    const { data: { session } } = await supabase.auth.getSession()
    const currentAAL = session?.user?.aal || 'unknown'
    const currentProvider = session?.user?.app_metadata?.provider
    const providers = session?.user?.app_metadata?.providers || []
    const hasPassword = providers.includes('email') || currentProvider === 'email'
    
    console.log('📊 Auth-Status:', {
      aal: currentAAL,
      provider: currentProvider,
      providers: providers,
      hasPassword: hasPassword
    })
    
    // Hinweis: Bei einigen Supabase-Versionen ist AAL "unknown"
    // Daher versuchen wir einfach den MFA-Enroll und fangen AAL2-Fehler ab

    try {
      // 0) Prüfe zuerst, ob bereits ein TOTP‑Faktor existiert
      try {
        const { data: preFactorsData, error: preFactorsErr } = await (supabase.auth as any).mfa.listFactors()
        if (preFactorsErr) throw preFactorsErr
        const preFactors: any[] = (preFactorsData?.factors as any[]) || []
        const existingTotp: any | undefined = preFactors.find((f) => f.factor_type === 'totp')
        if (existingTotp) {
          // Wenn bereits vorhanden: Status in den State übernehmen und (falls unverified) direkt zur Verifizierung springen
          setTotpFactor({ id: existingTotp.id, factor_type: 'totp', status: existingTotp.status })
          setTotpEnabled(existingTotp.status === 'verified')
          if (existingTotp.status !== 'verified') {
            setMfaError('Es existiert bereits ein TOTP‑Faktor. Bitte Verifizierung abschließen oder abbrechen.')
          }
          return
        }
      } catch (preCheckErr) {
        // Wenn das Vorab-Listing fehlschlägt, nicht hart abbrechen; wir versuchen dennoch das Enroll
        console.warn('MFA pre-check failed, continue with enroll:', preCheckErr)
      }

      // 1) Eindeutigen friendlyName vergeben (hilft, doppelte Namen zu vermeiden)
      const emailPart = user?.email ? user.email : 'user'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const friendlyName = `TOTP ${emailPart} ${timestamp}`

      // 2) Issuer für Microsoft Authenticator App festlegen (wichtig für Erkennbarkeit)
      const issuer = 'Zertifikat-Wächter'

      const { data, error } = await (supabase.auth as any).mfa.enroll({ 
        factorType: 'totp', 
        friendlyName,
        issuer 
      })
      if (error) throw error

      const factorId: string = data?.id
      const totpData = data?.totp || {}
      const qrFromServer: string | undefined = totpData.qr_code
      let otpauthUri: string | undefined = totpData.uri
      const secretFromServer: string | undefined = totpData.secret

      // WICHTIG: otpauth URI korrigieren für Microsoft Authenticator
      if (otpauthUri) {
        // 1. Ersetze "localhost" im Label mit dem richtigen Issuer
        otpauthUri = otpauthUri.replace(
          /otpauth:\/\/totp\/(localhost|127\.0\.0\.1)(:|%3A)/gi,
          `otpauth://totp/${encodeURIComponent(issuer)}:`
        )
        
        // 2. Falls kein Issuer-Parameter vorhanden ist, hinzufügen
        if (!otpauthUri.includes('issuer=')) {
          const separator = otpauthUri.includes('?') ? '&' : '?'
          otpauthUri = `${otpauthUri}${separator}issuer=${encodeURIComponent(issuer)}`
        }
        
        // 3. Falls Issuer "localhost" ist, ersetzen
        otpauthUri = otpauthUri.replace(
          /issuer=(localhost|127\.0\.0\.1)/gi,
          `issuer=${encodeURIComponent(issuer)}`
        )
        
        console.log('📱 TOTP URI korrigiert:', {
          original: totpData.uri?.substring(0, 80),
          corrected: otpauthUri.substring(0, 80),
          issuer
        })
      }

      if (factorId) {
        setTotpFactor({ id: factorId, factor_type: 'totp', status: 'unverified' })
      }

      // Parse otpauth URI to extract secret/issuer/label for manual setup
      function parseOtpAuthUri(uri: string): { secret: string | null; issuer: string | null; label: string | null } {
        try {
          const httpUri = uri.replace('otpauth://', 'http://')
          const url = new URL(httpUri)
          const params = new URLSearchParams(url.search)
          const secret = params.get('secret')
          const issuer = params.get('issuer')
          const rawPath = url.pathname.replace(/^\//, '')
          const label = rawPath ? decodeURIComponent(rawPath) : null
          return { secret, issuer, label }
        } catch (_) {
          const secretMatch = uri.match(/secret=([^&]+)/i)
          const issuerMatch = uri.match(/issuer=([^&]+)/i)
          const labelMatch = uri.match(/^otpauth:\/\/totp\/([^?]+)/i)
          return {
            secret: secretMatch ? decodeURIComponent(secretMatch[1]) : null,
            issuer: issuerMatch ? decodeURIComponent(issuerMatch[1]) : null,
            label: labelMatch ? decodeURIComponent(labelMatch[1]) : null,
          }
        }
      }

      if (otpauthUri) {
        setTotpUri(otpauthUri)
        const parsed = parseOtpAuthUri(otpauthUri)
        setTotpSecret(secretFromServer || parsed.secret)
        setTotpIssuer(parsed.issuer)
        setTotpLabel(parsed.label)
      } else {
        setTotpUri(null)
        setTotpSecret(secretFromServer || null)
        setTotpIssuer(null)
        setTotpLabel(null)
      }

      if (qrFromServer) {
        setQrImageUrl(qrFromServer)
      } else if (otpauthUri) {
        // Parse URI erst für QR-Code-Logging
        const parsedForLog = parseOtpAuthUri(otpauthUri)
        
        // Generiere QR-Code mit optimalen Einstellungen für Microsoft Authenticator
        // Größer für bessere Scan-Erkennung, Error Correction Level "M" für Stabilität
        const dataUrl = await QRCode.toDataURL(otpauthUri, { 
          width: 280, 
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0F172A',  // Dunkle Farbe für hohen Kontrast
            light: '#FFFFFF'   // Weißer Hintergrund
          }
        })
        setQrImageUrl(dataUrl)
        
        // Console-Log für Debugging (nur in Dev Mode)
        if ((import.meta as any).env.DEV) {
          console.log('✅ TOTP QR-Code generiert:', {
            issuer: parsedForLog.issuer || issuer,
            label: parsedForLog.label,
            secret_length: (secretFromServer || parsedForLog.secret)?.length,
            uri_length: otpauthUri.length,
            uri_preview: `${otpauthUri.substring(0, 50)}...`
          })
        }
      } else {
        throw new Error('Kein QR-Code/URI vom Server erhalten')
      }

      // Log successful enrollment start
      await logMFASecurityEvent({
        event_type: 'mfa.enrollment.started',
        factor_id: factorId,
        metadata: {
          method: 'TOTP',
          issuer,
          has_qr: !!qrImageUrl
        }
      })

    } catch (err: any) {
      console.error('Failed to start MFA enrollment:', err)

      const message: string = (err?.message || '').toLowerCase()
      
      // Spezielle Behandlung für AAL2-Fehler
      if (message.includes('aal2') || message.includes('assurance level')) {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        const sessionProvider = currentSession?.user?.app_metadata?.provider
        const sessionProviders = currentSession?.user?.app_metadata?.providers || []
        const userHasPassword = sessionProviders.includes('email')
        
        if (!userHasPassword) {
          // Kein Passwort vorhanden
          setMfaError(
            '🔐 MFA-Aktivierung - Passwort erforderlich:\n\n' +
            'Um MFA zu aktivieren, musst du zuerst ein Passwort setzen.\n\n' +
            '✅ SO GEHT\'S:\n\n' +
            '1️⃣ Melde dich ab\n' +
            '2️⃣ Klicke auf der Login-Seite: "Passwort vergessen?"\n' +
            '3️⃣ Gib deine E-Mail ein: ' + (user?.email || '') + '\n' +
            '4️⃣ Öffne die E-Mail und setze ein Passwort\n' +
            '5️⃣ Logge dich mit E-Mail + Passwort ein (NICHT Google!)\n' +
            '6️⃣ Komme zurück und aktiviere MFA\n\n' +
            'Dies ist eine Sicherheitsmaßnahme (AAL2-Level erforderlich).'
          )
        } else {
          // Hat Passwort, aber mit Google eingeloggt
          setMfaError(
            '🔐 Bitte mit Passwort einloggen:\n\n' +
            'Du hast ein Passwort, bist aber gerade mit Google eingeloggt.\n\n' +
            '✅ LÖSUNG:\n\n' +
            '1️⃣ Melde dich ab\n' +
            '2️⃣ Logge dich mit E-Mail + Passwort ein (NICHT Google!)\n' +
            '3️⃣ Komme zurück und aktiviere MFA\n\n' +
            'Wichtig: Nur beim Passwort-Login wird der AAL2-Level erreicht!'
          )
        }
        
        await logMFASecurityEvent({
          event_type: 'mfa.enrollment.failed',
          error_message: `AAL2 required - Provider: ${sessionProvider}, Has Password: ${userHasPassword}`,
          metadata: { 
            method: 'TOTP',
            provider: sessionProvider,
            providers: sessionProviders,
            hasPassword: userHasPassword
          }
        })
        
        setEnrolling(false)
        return
      }

      // Log failed enrollment
      await logMFASecurityEvent({
        event_type: 'mfa.enrollment.failed',
        error_message: err?.message || 'Unknown error',
        metadata: { method: 'TOTP', error_code: err.code }
      })

      // Spezifischer Fall: "A factor with the friendly name \"\" for this user already exists"
      if (message.includes('friendly name') && message.includes('already exists')) {
        // Versuche bestehenden unverifizierten Faktor zu nutzen
        const recovered = await recoverUnverifiedTotpFactor()
        if (recovered) {
          setMfaError('Ein TOTP‑Faktor mit ähnlichem Namen existiert bereits. Bitte Verifizierung abschließen oder abbrechen.')
          return
        }
        // Falls nichts zu recovern ist, generische Meldung
        setMfaError('TOTP‑Faktor existiert bereits. Bitte alte Faktoren entfernen oder Verifizierung abschließen.')
        return
      }
      if (message.includes('not enabled') || message.includes('disabled')) {
        setMfaError('MFA ist serverseitig deaktiviert. Bitte MFA/TOTP in Supabase aktivieren.')
      } else if (message.includes('too many') || message.includes('max')) {
        // Falls bereits ein unverifizierter Faktor existiert, zur Verifizierung übergehen
        recoverUnverifiedTotpFactor().then((recovered) => {
          if (recovered) {
            setMfaError('Es existiert bereits ein unverifizierter TOTP‑Faktor. Bitte Verifizierung abschließen oder abbrechen.')
          } else {
            setMfaError('Zu viele Faktoren registriert. Bitte zunächst alte Faktoren entfernen.')
          }
        })
      } else {
        setMfaError(err.message || 'Fehler beim Aktivieren von MFA')
      }
    } finally {
      setEnrolling(false)
    }
  }

  async function verifyMfa() {
    const code = verificationCode.trim()
    let factorIdToUse: string | null = totpFactor?.id ?? null

    // Check for brute force attempts
    if (user) {
      const bruteForceCheck = await checkMFABruteForce(user.id)
      if (bruteForceCheck.isBlocked) {
        setMfaError(`⚠️ Zu viele Fehlversuche! Du hast ${bruteForceCheck.attemptCount} Versuche in 5 Minuten gemacht. Bitte warte.`)

        await logMFASecurityEvent({
          event_type: 'mfa.verification.failed',
          factor_id: factorIdToUse || undefined,
          error_message: 'Brute force protection triggered',
          attempt_count: bruteForceCheck.attemptCount
        })

        return
      }
    }

    if (!factorIdToUse) {
      // Fallback: Versuche bestehenden unverifizierten Faktor zu finden
      const recovered = await recoverUnverifiedTotpFactor()
      factorIdToUse = recovered?.id ?? null
      if (!factorIdToUse) {
        setMfaError('Kein TOTP‑Faktor gefunden. Die Aktivierung wird neu gestartet – bitte QR‑Code erneut scannen.')
        // Neu starten, damit der Nutzer einen neuen QR‑Code erhält
        await startMfaEnrollment()
        return
      }
    }
    if (code.length !== 6) {
      setMfaError('Bitte den 6‑stelligen Code eingeben')
      return
    }
    setVerifying(true)
    setMfaError(null)
    setMfaSuccess(null)
    try {
      // WICHTIG: Erst Challenge erstellen, dann verifizieren!
      // Ohne Challenge schlägt verify() fehl mit "challenge ID not found"
      const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa.challenge({
        factorId: factorIdToUse
      })
      if (challengeError) throw challengeError

      if (!challengeData || !challengeData.id) {
        throw new Error('Challenge ID nicht erhalten')
      }

      const challengeId = challengeData.id
      console.log('🔐 Challenge ID erhalten:', challengeId)

      // Jetzt mit der Challenge ID und dem Code verifizieren
      const { error: verifyError } = await (supabase.auth as any).mfa.verify({
        factorId: factorIdToUse,
        challengeId: challengeId,
        code,
      })
      if (verifyError) throw verifyError

      setMfaSuccess('✅ MFA (TOTP) aktiviert!')
      setTotpEnabled(true)
      setTotpFactor((prev) => (prev ? { ...prev, status: 'verified' } : { id: factorIdToUse!, factor_type: 'totp', status: 'verified' }))
      setQrImageUrl(null)
      setTotpUri(null)
      setTotpSecret(null)
      setTotpIssuer(null)
      setTotpLabel(null)
      setVerificationCode('')

      // Log success für Debugging und Security Monitoring
      console.log('✅ MFA erfolgreich aktiviert für Faktor:', factorIdToUse)

      await logMFASecurityEvent({
        event_type: 'mfa.enrollment.completed',
        factor_id: factorIdToUse,
        metadata: {
          method: 'TOTP',
          success: true
        }
      })

      // WICHTIG: Status neu laden, um sicherzustellen, dass er persistiert ist
      console.log('🔄 Lade MFA-Status neu nach Verifizierung...')
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1s warten für Supabase-Propagierung
      await loadMfaStatus()
    } catch (err: any) {
      console.error('Failed to verify MFA:', err)

      // Log failed verification
      await logMFASecurityEvent({
        event_type: 'mfa.verification.failed',
        factor_id: factorIdToUse || undefined,
        error_message: err?.message || 'Verification failed',
        metadata: {
          code_length: code.length,
          method: 'TOTP'
        }
      })

      const message: string = (err?.message || '').toLowerCase()
      if (message.includes('not enabled') || message.includes('disabled')) {
        setMfaError('MFA ist serverseitig deaktiviert. Bitte MFA/TOTP in Supabase aktivieren.')
      } else if (message.includes('invalid') || message.includes('code')) {
        setMfaError('Ungültiger Code. Bitte prüfe, ob der Code aktuell ist und erneut versuchen.')
      } else if (message.includes('challenge')) {
        setMfaError('Challenge-Fehler. Bitte starte die Aktivierung neu (QR-Code erneut scannen).')
      } else {
        setMfaError(err?.message || 'Fehler bei der Verifizierung')
      }
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnrollment() {
    if (!totpFactor?.id) {
      setQrImageUrl(null)
      setVerificationCode('')
      return
    }
    try {
      await (supabase.auth as any).mfa.unenroll({ factorId: totpFactor.id })
    } catch (_) {
      // ignore cleanup errors
    } finally {
      setQrImageUrl(null)
      setTotpUri(null)
      setTotpSecret(null)
      setTotpIssuer(null)
      setTotpLabel(null)
      setVerificationCode('')
      setTotpFactor(null)
      setTotpEnabled(false)
      setMfaSuccess(null)
      setMfaError(null)
    }
  }

  async function disableMfa() {
    if (!totpFactor?.id) return
    setDisabling(true)
    setMfaError(null)
    setMfaSuccess(null)
    try {
      console.log('🗑️ Deaktiviere MFA-Faktor:', totpFactor.id.substring(0, 8) + '...')
      const { error } = await (supabase.auth as any).mfa.unenroll({ factorId: totpFactor.id })
      if (error) throw error

      setMfaSuccess('✅ MFA wurde deaktiviert')
      setTotpEnabled(false)
      setTotpFactor(null)

      // Log MFA disabled
      await logMFASecurityEvent({
        event_type: 'mfa.disabled',
        factor_id: totpFactor.id,
        metadata: {
          method: 'TOTP',
          reason: 'User requested'
        }
      })

      // Status neu laden
      console.log('🔄 Lade MFA-Status neu nach Deaktivierung...')
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadMfaStatus()
    } catch (err: any) {
      console.error('❌ Fehler beim Deaktivieren von MFA:', err)
      setMfaError(err.message || 'Fehler beim Deaktivieren von MFA')
    } finally {
      setDisabling(false)
    }
  }

  async function handleSave() {
    if (!policy || !tenantId) return

    setSaving(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('policies')
        .upsert({
          id: policy.id,
          tenant_id: tenantId,
          warn_days: policy.warn_days,
          channels: policy.channels
        })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(channel: keyof Policy['channels']) {
    if (!policy) return
    setPolicy({
      ...policy,
      channels: {
        ...policy.channels,
        [channel]: !policy.channels[channel]
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                <span className="text-xl sm:text-2xl">⚙️</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Einstellungen</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
              Alert-Policies • Warnschwellen • Notification-Channels • MFA
            </p>
          </div>
          <Link
            to="/integrations"
            className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 whitespace-nowrap"
          >
            <span>🔗 Integrationen verwalten</span>
          </Link>
        </div>
      </div>

      {/* Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-4xl">
        {loading ? (
          <div className="py-12">
            <LoadingState size="md" text="Lade Einstellungen..." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Einstellungen erfolgreich gespeichert!</span>
              </div>
            )}

            {/* Notification Channels */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-xl font-bold text-[#0F172A] mb-4">
                Benachrichtigungskanäle
              </h2>
              <div className="space-y-4">
                {policy && Object.entries(policy.channels).map(([channel, enabled]) => (
                  <div key={channel} className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {channel === 'email' && '📧'}
                        {channel === 'webhook' && '🔗'}
                        {channel === 'slack' && '💬'}
                        {channel === 'teams' && '👥'}
                      </span>
                      <div>
                        <p className="font-semibold text-[#0F172A] capitalize">{channel}</p>
                        <p className="text-sm text-[#64748B]">
                          {channel === 'email' && 'E-Mail Benachrichtigungen'}
                          {channel === 'webhook' && 'Webhook Integration'}
                          {channel === 'slack' && 'Slack Notifications'}
                          {channel === 'teams' && 'Microsoft Teams'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleChannel(channel as keyof Policy['channels'])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? 'bg-[#3B82F6]' : 'bg-[#CBD5E1]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Days Editor */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-xl font-bold text-[#0F172A] mb-4">
                Warnschwellen bearbeiten
              </h2>
              <p className="text-sm text-[#64748B] mb-4">
                Bei wie vielen Tagen vor Ablauf sollen Warnungen gesendet werden?
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {policy?.warn_days.map((days, idx) => (
                    <div key={idx} className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-[#64748B] font-medium">
                          Schwelle {idx + 1}
                        </label>
                        <button
                          onClick={() => {
                            if (!policy) return
                            const newWarnDays = [...policy.warn_days]
                            newWarnDays.splice(idx, 1)
                            setPolicy({ ...policy, warn_days: newWarnDays })
                          }}
                          className="text-[#EF4444] hover:text-[#DC2626] text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={days}
                        onChange={(e) => {
                          if (!policy) return
                          const newValue = parseInt(e.target.value) || 0
                          const newWarnDays = [...policy.warn_days]
                          newWarnDays[idx] = newValue
                          setPolicy({ ...policy, warn_days: newWarnDays })
                        }}
                        className="w-full text-center text-2xl font-bold text-[#3B82F6] bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
                      />
                      <p className="text-xs text-[#64748B] mt-2 text-center">Tage</p>
                    </div>
                  ))}
                </div>

                {/* Add New Threshold */}
                <button
                  onClick={() => {
                    if (!policy) return
                    const newWarnDays = [...policy.warn_days, 90].sort((a, b) => b - a)
                    setPolicy({ ...policy, warn_days: newWarnDays })
                  }}
                  className="w-full py-3 border-2 border-dashed border-[#E2E8F0] rounded-lg text-[#64748B] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors font-medium"
                >
                  + Schwelle hinzufügen
                </button>

                {/* Quick Presets */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-3">Schnellauswahl:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Standard', values: [60, 30, 14, 7, 3, 1] },
                      { label: 'Minimal', values: [30, 7, 1] },
                      { label: 'Ausführlich', values: [90, 60, 30, 21, 14, 7, 3, 1] },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          if (!policy) return
                          setPolicy({ ...policy, warn_days: preset.values })
                        }}
                        className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* MFA (TOTP) Settings */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#0F172A]">Sicherheit: Zwei‑Faktor‑Authentifizierung (TOTP)</h2>
                {mfaLoading && <span className="text-sm text-[#64748B]">Lade…</span>}
              </div>

              {mfaSuccess && (
                <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg mb-4">
                  {mfaSuccess}
                </div>
              )}
              {mfaError && (
                <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg mb-4">
                  ❌ {mfaError}
                  {mfaError.includes('serverseitig deaktiviert') && (
                    <div className="mt-2 text-[#991B1B] text-xs">
                      Tipp: In `supabase/config.toml` den Block `[auth.mfa]` aktivieren und unter `[auth.mfa.totp]` `enroll_enabled=true`, `verify_enabled=true` setzen. Danach Supabase neu starten.
                    </div>
                  )}
                </div>
              )}

              {totpEnabled ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
                    <div>
                      <p className="font-semibold text-[#0F172A]">Status</p>
                      <p className="text-sm text-[#64748B]">TOTP ist aktiviert für dein Konto.</p>
                    </div>
                    <span className="px-3 py-1 rounded bg-[#D1FAE5] text-[#065F46] text-sm font-medium">Aktiv</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={disableMfa}
                      disabled={disabling}
                      className="px-4 py-2 bg-[#EF4444] text-white rounded-lg font-semibold hover:bg-[#DC2626] disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {disabling ? '⏳ Deaktiviere…' : 'MFA deaktivieren'}
                    </button>
                  </div>
                </div>
              ) : (qrImageUrl || totpFactor?.status === 'unverified') ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-white border-2 border-[#3B82F6] rounded-xl shadow-lg inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {qrImageUrl ? (
                        <img src={qrImageUrl} alt="TOTP QR Code" className="w-72 h-72 object-contain" />
                      ) : (
                        <div className="w-72 h-72 flex items-center justify-center text-[#64748B]">
                          <div className="text-center">
                            <div className="text-4xl mb-2">📱</div>
                            <div>Kein QR‑Code verfügbar</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-[#64748B] mt-4 text-center space-y-2">
                      <p className="font-semibold text-[#0F172A]">✅ Kompatible Apps:</p>
                      <div className="flex flex-col gap-1 text-xs">
                        <span>• Microsoft Authenticator</span>
                        <span>• Google Authenticator</span>
                        <span>• 1Password / Authy</span>
                      </div>
                    </div>
                    <div className="w-full mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                      <p className="text-sm font-semibold text-[#0F172A] mb-2">Manuelle Einrichtung</p>
                      {totpSecret ? (
                        <div className="space-y-2">
                          {totpIssuer || totpLabel ? (
                            <p className="text-xs text-[#64748B]">
                              {(totpIssuer && totpLabel) ? `${totpIssuer} – ${totpLabel}` : (totpIssuer || totpLabel)}
                            </p>
                          ) : null}
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={totpSecret}
                              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-sm bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => { if (totpSecret) navigator.clipboard?.writeText(totpSecret).catch(() => {}) }}
                              className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                            >
                              Kopieren
                            </button>
                          </div>
                          <p className="text-xs text-[#64748B]">In deiner Authenticator‑App „Schlüssel eingeben“ wählen. Typ: TOTP, 6 Ziffern, 30s.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-[#64748B]">Falls kein Schlüssel sichtbar ist, kannst du die otpauth‑URI kopieren:</p>
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={totpUri ?? ''}
                              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => { if (totpUri) navigator.clipboard?.writeText(totpUri).catch(() => {}) }}
                              className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                            >
                              Kopieren
                            </button>
                          </div>
                          <p className="text-xs text-[#64748B]">
                            Wenn du den QR‑Code bereits gescannt hast, gib unten einfach den 6‑stelligen Code ein. Andernfalls kannst du die Aktivierung über „Abbrechen" und anschließend „MFA (TOTP) aktivieren" neu starten.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-[#0F172A]">6‑stelligen Code eingeben</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                      placeholder="123456"
                    />
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={verifyMfa}
                        disabled={verifying || verificationCode.length !== 6}
                        className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {verifying ? '⏳ Verifiziere…' : 'MFA aktivieren'}
                      </button>
                      <button
                        onClick={cancelEnrollment}
                        className="px-4 py-3 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#64748B]">
                    Schütze deinen Account mit einer zusätzlichen Sicherheitsstufe. Nach der Aktivierung benötigst du bei der Anmeldung einen Code aus deiner Authenticator‑App.
                  </p>
                  <button
                    onClick={startMfaEnrollment}
                    disabled={enrolling}
                    className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {enrolling ? '⏳ Starte…' : 'MFA (TOTP) aktivieren'}
                  </button>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-md"
              >
                {saving ? '⏳ Speichern...' : '💾 Einstellungen speichern'}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

