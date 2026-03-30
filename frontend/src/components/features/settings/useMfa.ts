import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import QRCode from 'qrcode'
import { logMFASecurityEvent, checkMFABruteForce } from '../../../utils/mfaSecurityLogger'
import type { User } from '@supabase/supabase-js'

type FactorStatus = 'verified' | 'unverified' | 'pending' | 'errored'

interface TotpFactor {
  id: string
  factor_type: 'totp'
  status: FactorStatus
  friendly_name?: string | null
}

/**
 * Custom hook encapsulating all MFA/TOTP enrollment, verification, and disabling logic.
 */
export function useMfa(user: User | null | undefined) {
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

  async function loadMfaStatus() {
    if (!user) return
    setMfaLoading(true)
    setMfaError(null)
    try {
      const { data, error } = await (supabase.auth as any).mfa.listFactors()
      if (error) throw error

      const factors: any[] = (data?.factors as any[]) || []

      const totp = factors.find((f) => f.factor_type === 'totp') || null
      if (totp) {
        setTotpFactor({
          id: totp.id,
          factor_type: 'totp',
          status: totp.status as FactorStatus,
          friendly_name: (totp as any).friendly_name ?? null,
        })

        const isVerified = totp.status === 'verified'
        setTotpEnabled(isVerified)
      } else {
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

  // Attempt to recover an existing unverified TOTP factor
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

  async function initiateMfaEnrollment() {
    // Clear existing factors (including unverified) to avoid AAL2 requirement
    setMfaError(null)
    setMfaSuccess(null)

    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.warn('Session refresh failed:', refreshError)
      }

      const { data: factorsData, error: factorsErr } = await (supabase.auth as any).mfa.listFactors()

      if (!factorsErr && factorsData?.factors && factorsData.factors.length > 0) {
        for (const factor of factorsData.factors) {
          try {
            await (supabase.auth as any).mfa.unenroll({ factorId: factor.id })
          } catch (deleteErr) {
            console.warn(`Could not unenroll factor ${factor.id.substring(0, 8)}...:`, deleteErr)
          }
        }

        // Brief wait for Supabase to process the deletion
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Start MFA enrollment directly
      await startMfaEnrollment()
    } catch (err: any) {
      console.error('Fehler beim Vorbereiten des MFA-Enrollments:', err)
      setMfaError('Fehler beim Vorbereiten: ' + (err.message || 'Unbekannter Fehler'))
    }
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

    try {
      // 0) Check if a TOTP factor already exists
      try {
        const { data: preFactorsData, error: preFactorsErr } = await (supabase.auth as any).mfa.listFactors()
        if (preFactorsErr) throw preFactorsErr
        const preFactors: any[] = (preFactorsData?.factors as any[]) || []
        const existingTotp: any | undefined = preFactors.find((f) => f.factor_type === 'totp')
        if (existingTotp) {
          setTotpFactor({ id: existingTotp.id, factor_type: 'totp', status: existingTotp.status })
          setTotpEnabled(existingTotp.status === 'verified')
          if (existingTotp.status !== 'verified') {
            setMfaError('Es existiert bereits ein TOTP‑Faktor. Bitte Verifizierung abschließen oder abbrechen.')
          }
          return
        }
      } catch (preCheckErr) {
        console.warn('MFA pre-check failed, continue with enroll:', preCheckErr)
      }

      // 1) Assign a unique friendlyName
      const emailPart = user?.email ? user.email : 'user'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const friendlyName = `TOTP ${emailPart} ${timestamp}`

      // 2) Set issuer for Authenticator app recognition
      const issuer = 'Zertifikat-Wächter'

      const { data, error } = await (supabase.auth as any).mfa.enroll({
        factorType: 'totp',
        friendlyName,
        issuer
      })

      if (error) {
        console.error('❌ MFA.enroll() Fehler Details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          fullError: JSON.stringify(error, null, 2)
        })

        // Special handling for AAL2 errors
        if (error.message?.includes('AAL2') || error.status === 403) {
          console.error('🔴 AAL2-FEHLER ERKANNT!')
          console.error('📋 Mögliche Ursachen:')
          console.error('1. "Enhanced MFA Security" ist im Supabase Dashboard aktiviert')
          console.error('2. Es existiert ein versteckter MFA-Faktor in der Datenbank')
          console.error('3. Die Session wurde nicht korrekt refreshed')
          console.error('')
          console.error('🔧 Lösungsschritte:')
          console.error('1. Öffne Supabase Dashboard → Authentication → Providers')
          console.error('2. Deaktiviere "Limit duration of AAL1 sessions" unter "Enhanced MFA Security"')
          console.error('3. Klicke auf "Save changes"')
          console.error('4. Warte 30 Sekunden')
          console.error('5. Melde dich komplett ab und neu an')
          console.error('6. Versuche MFA erneut zu aktivieren')
        }

        throw error
      }

      const factorId: string = data?.id
      const totpData = data?.totp || {}
      const qrFromServer: string | undefined = totpData.qr_code
      let otpauthUri: string | undefined = totpData.uri
      const secretFromServer: string | undefined = totpData.secret

      // Fix otpauth URI for Microsoft Authenticator compatibility
      if (otpauthUri) {
        otpauthUri = otpauthUri.replace(
          /otpauth:\/\/totp\/(localhost|127\.0\.0\.1)(:|%3A)/gi,
          `otpauth://totp/${encodeURIComponent(issuer)}:`
        )

        if (!otpauthUri.includes('issuer=')) {
          const separator = otpauthUri.includes('?') ? '&' : '?'
          otpauthUri = `${otpauthUri}${separator}issuer=${encodeURIComponent(issuer)}`
        }

        otpauthUri = otpauthUri.replace(
          /issuer=(localhost|127\.0\.0\.1)/gi,
          `issuer=${encodeURIComponent(issuer)}`
        )

      }

      if (factorId) {
        setTotpFactor({ id: factorId, factor_type: 'totp', status: 'unverified' })
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
        // Generate QR code with optimal settings for Authenticator apps
        const dataUrl = await QRCode.toDataURL(otpauthUri, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0F172A',
            light: '#FFFFFF'
          }
        })
        setQrImageUrl(dataUrl)

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

      // Special handling for AAL2 errors
      if (message.includes('aal2') || message.includes('assurance level')) {
        setMfaError(
          '🔐 Sicherheitsstufe nicht ausreichend:\n\n' +
          'Das MFA-Enrollment benötigt eine höhere Sicherheitsstufe (AAL2).\n' +
          'Bitte melde dich ab und mit deinem Passwort erneut an.'
        )

        await logMFASecurityEvent({
          event_type: 'mfa.enrollment.failed',
          error_message: 'AAL2 required even after re-auth',
          metadata: { method: 'TOTP' }
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

      if (message.includes('friendly name') && message.includes('already exists')) {
        const recovered = await recoverUnverifiedTotpFactor()
        if (recovered) {
          setMfaError('Ein TOTP‑Faktor mit ähnlichem Namen existiert bereits. Bitte Verifizierung abschließen oder abbrechen.')
          return
        }
        setMfaError('TOTP‑Faktor existiert bereits. Bitte alte Faktoren entfernen oder Verifizierung abschließen.')
        return
      }
      if (message.includes('not enabled') || message.includes('disabled')) {
        setMfaError('MFA ist serverseitig deaktiviert. Bitte MFA/TOTP in Supabase aktivieren.')
      } else if (message.includes('too many') || message.includes('max')) {
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
      const recovered = await recoverUnverifiedTotpFactor()
      factorIdToUse = recovered?.id ?? null
      if (!factorIdToUse) {
        setMfaError('Kein TOTP‑Faktor gefunden. Die Aktivierung wird neu gestartet – bitte QR‑Code erneut scannen.')
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
      // Create challenge first, then verify
      const { data: challengeData, error: challengeError } = await (supabase.auth as any).mfa.challenge({
        factorId: factorIdToUse
      })
      if (challengeError) throw challengeError

      if (!challengeData || !challengeData.id) {
        throw new Error('Challenge ID nicht erhalten')
      }

      const challengeId = challengeData.id

      // Verify with challenge ID and code
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

      await logMFASecurityEvent({
        event_type: 'mfa.enrollment.completed',
        factor_id: factorIdToUse,
        metadata: {
          method: 'TOTP',
          success: true
        }
      })

      // Reload status to ensure persistence
      await new Promise(resolve => setTimeout(resolve, 1000))
      await loadMfaStatus()
    } catch (err: any) {
      console.error('Failed to verify MFA:', err)

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
      const { error } = await (supabase.auth as any).mfa.unenroll({ factorId: totpFactor.id })
      if (error) throw error

      setMfaSuccess('✅ MFA wurde deaktiviert')
      setTotpEnabled(false)
      setTotpFactor(null)

      await logMFASecurityEvent({
        event_type: 'mfa.disabled',
        factor_id: totpFactor.id,
        metadata: {
          method: 'TOTP',
          reason: 'User requested'
        }
      })

      // Reload status
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadMfaStatus()
    } catch (err: any) {
      console.error('❌ Fehler beim Deaktivieren von MFA:', err)
      setMfaError(err.message || 'Fehler beim Deaktivieren von MFA')
    } finally {
      setDisabling(false)
    }
  }

  return {
    // State
    mfaLoading,
    totpFactor,
    totpEnabled,
    enrolling,
    verifying,
    disabling,
    qrImageUrl,
    totpUri,
    totpSecret,
    totpIssuer,
    totpLabel,
    verificationCode,
    mfaError,
    mfaSuccess,
    // Actions
    setVerificationCode,
    loadMfaStatus,
    initiateMfaEnrollment,
    verifyMfa,
    cancelEnrollment,
    disableMfa,
  }
}
