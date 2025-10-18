-- Fix: Mehrdeutigkeit in get_remediation_actions

DROP FUNCTION IF EXISTS get_remediation_actions(UUID);

CREATE OR REPLACE FUNCTION get_remediation_actions(p_tenant_id UUID)
RETURNS TABLE (
    violation_type TEXT,
    count INTEGER,
    severity TEXT,
    remediation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_checks AS (
        SELECT DISTINCT ON (cc.certificate_id, cc.standard_id)
            cc.violations
        FROM compliance_checks cc
        WHERE cc.tenant_id = p_tenant_id
        AND cc.is_compliant = false
        ORDER BY cc.certificate_id, cc.standard_id, cc.checked_at DESC
    ),
    violations_expanded AS (
        SELECT 
            v.value->>'rule' as rule,
            v.value->>'severity' as sev
        FROM latest_checks lc, jsonb_array_elements(lc.violations) v
    )
    SELECT 
        ve.rule as violation_type,
        COUNT(*)::INTEGER as count,
        ve.sev as severity,
        CASE ve.rule
            WHEN 'min_key_size' THEN 'Zertifikat erneuern mit größerer Schlüsselgröße (min. 2048 Bit, empfohlen 3072+ Bit)'
            WHEN 'max_cert_validity_days' THEN 'Neues Zertifikat mit kürzerer Gültigkeitsdauer ausstellen (max. 397 Tage für öffentliche CAs)'
            WHEN 'weak_signature' THEN 'Zertifikat mit stärkerem Signatur-Algorithmus erneuern (SHA-256 oder besser)'
            WHEN 'deprecated_protocol' THEN 'Server-Konfiguration anpassen: TLSv1.0/1.1 deaktivieren, nur TLSv1.2+ erlauben'
            ELSE 'Compliance-Anforderungen prüfen und Zertifikat/Server entsprechend konfigurieren'
        END as remediation
    FROM violations_expanded ve
    GROUP BY ve.rule, ve.sev
    ORDER BY 
        CASE ve.sev
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
        END,
        count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant
GRANT EXECUTE ON FUNCTION get_remediation_actions TO authenticated;

