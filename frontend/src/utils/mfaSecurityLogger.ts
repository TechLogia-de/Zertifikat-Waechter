import { supabase } from '../lib/supabase'

interface MFASecurityEvent {
  event_type: 'mfa.enrollment.started' | 'mfa.enrollment.completed' | 'mfa.enrollment.failed' |
              'mfa.verification.success' | 'mfa.verification.failed' | 'mfa.disabled' |
              'mfa.challenge.created' | 'mfa.challenge.failed' | 'mfa.unenroll.success'
  user_id?: string
  user_email?: string
  ip_address?: string
  user_agent?: string
  error_message?: string
  factor_id?: string
  attempt_count?: number
  metadata?: Record<string, any>
}

/**
 * Loggt MFA/2FA Security-Events für das Security Monitoring
 */
export async function logMFASecurityEvent(event: MFASecurityEvent) {
  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    // Get tenant_id
    let tenantId = null
    if (user) {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      tenantId = membership?.tenant_id
    }

    // Get IP address (best effort - in production use proper backend)
    let ipAddress = event.ip_address || 'unknown'
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      ipAddress = data.ip || ipAddress
    } catch {
      // Fallback to unknown if IP detection fails
    }

    // Get user agent
    const userAgent = event.user_agent || navigator.userAgent

    // Create event payload
    const payload = {
      user_id: event.user_id || user?.id,
      user_email: event.user_email || user?.email,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: event.error_message,
      factor_id: event.factor_id,
      attempt_count: event.attempt_count,
      timestamp: new Date().toISOString(),
      ...event.metadata
    }

    // Log to events table
    if (tenantId) {
      await supabase.from('events').insert({
        tenant_id: tenantId,
        user_id: user?.id || null,
        type: event.event_type,
        payload,
        ts: new Date().toISOString()
      })

      console.log(`🔒 MFA Security Event logged: ${event.event_type}`)
    }

    // Log failed attempts to console for dev monitoring
    if (event.event_type.includes('failed') || event.event_type.includes('challenge.failed')) {
      console.warn('⚠️ MFA SECURITY ALERT:', {
        type: event.event_type,
        user: event.user_email || user?.email,
        ip: ipAddress,
        error: event.error_message
      })
    }

  } catch (error) {
    console.error('Failed to log MFA security event:', error)
  }
}

/**
 * Prüft, ob ein User zu viele MFA-Versuche hat (Brute Force Protection)
 */
export async function checkMFABruteForce(userId: string): Promise<{
  isBlocked: boolean
  attemptCount: number
  remainingAttempts: number
}> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['mfa.verification.failed', 'mfa.challenge.failed'])
      .gte('ts', fiveMinutesAgo)

    const attemptCount = events?.length || 0
    const maxAttempts = 5
    const isBlocked = attemptCount >= maxAttempts

    return {
      isBlocked,
      attemptCount,
      remainingAttempts: Math.max(0, maxAttempts - attemptCount)
    }
  } catch (error) {
    console.error('Failed to check MFA brute force:', error)
    return { isBlocked: false, attemptCount: 0, remainingAttempts: 5 }
  }
}

/**
 * Blockiert eine IP-Adresse nach zu vielen MFA-Fehlversuchen
 */
export async function blockIPAfterMFAFailures(ipAddress: string, reason: string) {
  try {
    console.warn(`🚫 Blocking IP ${ipAddress} - Reason: ${reason}`)

    // In production würdest du das in eine blocked_ips Tabelle schreiben
    // Für jetzt loggen wir es als Event
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (user) {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        await supabase.from('events').insert({
          tenant_id: membership.tenant_id,
          user_id: user.id,
          type: 'security.ip_blocked',
          payload: {
            ip_address: ipAddress,
            reason,
            blocked_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
          },
          ts: new Date().toISOString()
        })
      }
    }
  } catch (error) {
    console.error('Failed to block IP:', error)
  }
}
