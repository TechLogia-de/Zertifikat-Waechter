import { supabase } from '../lib/supabase'

/**
 * Hook zum Loggen von User-Aktionen ins Audit Log
 */
export function useAuditLog() {
  async function logAction(
    tenantId: string,
    actionType: string,
    payload: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_user_action', {
        p_tenant_id: tenantId,
        p_action_type: actionType,
        p_payload: payload
      })

      if (error) {
        console.error('[Audit Log] Error:', error)
      }
    } catch (error) {
      console.error('[Audit Log] Failed to log action:', error)
      // Fehler nicht werfen - Audit Log Fehler soll die App nicht blockieren
    }
  }

  return { logAction }
}

/**
 * Event Types für konsistente Verwendung
 */
export const AuditEventTypes = {
  // SSL Health
  SSL_HEALTH_CHECK_STARTED: 'ssl_health.check_started',
  SSL_HEALTH_BULK_STARTED: 'ssl_health.bulk_check_started',
  
  // Compliance
  COMPLIANCE_CHECK_STARTED: 'compliance.check_started',
  COMPLIANCE_AUTO_FIX_STARTED: 'compliance.auto_fix_started',
  COMPLIANCE_AUTO_FIX_COMPLETED: 'compliance.auto_fix_completed',
  
  // Certificates
  CERTIFICATE_VIEWED: 'certificate.viewed',
  CERTIFICATE_EXPORTED: 'certificate.exported',
  
  // Domain Scans
  DOMAIN_SCAN_STARTED: 'scan.domain_started',
  DOMAIN_SCAN_COMPLETED: 'scan.domain_completed',
  DOMAIN_DELETED: 'scan.domain_deleted',
  
  // Alerts
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  ALERT_DISMISSED: 'alert.dismissed',
  
  // Settings
  SETTINGS_UPDATED: 'settings.updated',
  POLICY_UPDATED: 'policy.updated',
  
  // Integrations
  INTEGRATION_CONFIGURED: 'integration.configured',
  INTEGRATION_TESTED: 'integration.tested',
  
  // User
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  
  // Reports
  REPORT_GENERATED: 'report.generated',
  REPORT_DOWNLOADED: 'report.downloaded',
} as const

