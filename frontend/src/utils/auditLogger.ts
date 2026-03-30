import { supabase } from '../lib/supabase'
import { generateSimpleHash } from './hashUtils'

export type AuditEventType =
  | 'integration.smtp.updated'
  | 'integration.slack.updated'
  | 'integration.webhook.updated'
  | 'apikey.created'
  | 'apikey.revoked'

/**
 * Log an audit event to the events table with hash chaining.
 * Accepts nullable tenantId/userId and bails early if either is missing.
 */
export async function logAuditEvent(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  type: AuditEventType,
  payload: Record<string, any>
): Promise<void> {
  if (!tenantId || !userId) return
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
