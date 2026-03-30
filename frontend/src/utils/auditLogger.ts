import { supabase } from '../lib/supabase'

/**
 * Generate a simple SHA-256 hash (browser-compatible)
 */
async function generateSimpleHash(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * Log an audit event to the events table with hash chaining.
 * Follows the same pattern as mfaSecurityLogger.ts.
 */
export async function logAuditEvent(
  tenantId: string,
  userId: string,
  type: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    // Fetch the most recent event hash for chain integrity
    const { data: lastEvent } = await supabase
      .from('events')
      .select('hash')
      .eq('tenant_id', tenantId)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prevHash = lastEvent?.hash || '0'.repeat(64)
    const ts = new Date().toISOString()

    const eventString = JSON.stringify({
      tenant_id: tenantId,
      type,
      prev_hash: prevHash,
      ts
    })
    const hash = await generateSimpleHash(eventString)

    const { error: insertError } = await supabase.from('events').insert({
      tenant_id: tenantId,
      user_id: userId,
      type,
      payload,
      ts,
      hash,
      prev_hash: prevHash
    })

    if (insertError) {
      console.error('Failed to insert audit event:', insertError)
    }
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Failed to log audit event:', error)
  }
}
