-- Auto-Remediation Features

-- ============================================================================
-- Function: Get Certificates needing Remediation
-- ============================================================================
-- WICHTIG: Erst DROP mit vollständiger Signatur
DROP FUNCTION IF EXISTS get_certificates_needing_remediation(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_certificates_needing_remediation(
    p_tenant_id UUID,
    p_violation_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    certificate_id UUID,
    subject_cn TEXT,
    current_key_size INTEGER,
    required_key_size INTEGER,
    domain TEXT,
    violation_type TEXT,
    severity TEXT,
    severity_order INTEGER,
    can_auto_fix BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_checks AS (
        SELECT DISTINCT ON (cc.certificate_id, cc.standard_id)
            cc.certificate_id,
            cc.violations,
            cc.standard_id
        FROM compliance_checks cc
        WHERE cc.tenant_id = p_tenant_id
        AND cc.is_compliant = false
        ORDER BY cc.certificate_id, cc.standard_id, cc.checked_at DESC
    ),
    violations_expanded AS (
        SELECT 
            lc.certificate_id,
            v.value->>'rule' as rule,
            v.value->>'severity' as sev,
            v.value->>'expected' as expected,
            v.value->>'actual' as actual
        FROM latest_checks lc, jsonb_array_elements(lc.violations) v
    )
    SELECT DISTINCT
        ve.certificate_id,
        c.subject_cn,
        c.key_size as current_key_size,
        (ve.expected)::INTEGER as required_key_size,
        c.subject_cn as domain,
        ve.rule as violation_type,
        ve.sev as severity,
        CASE ve.sev
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
        END as severity_order,
        CASE 
            WHEN ve.rule = 'min_key_size' THEN true
            WHEN ve.rule = 'max_cert_validity_days' THEN true
            ELSE false
        END as can_auto_fix
    FROM violations_expanded ve
    JOIN certificates c ON ve.certificate_id = c.id
    WHERE p_violation_type IS NULL OR ve.rule = p_violation_type
    ORDER BY severity_order, c.subject_cn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Create Auto-Remediation Order
-- ============================================================================
CREATE OR REPLACE FUNCTION create_auto_remediation_order(
    p_certificate_id UUID,
    p_tenant_id UUID,
    p_key_size INTEGER DEFAULT 2048
)
RETURNS UUID AS $$
DECLARE
    v_cert RECORD;
    v_acme_account RECORD;
    v_order_id UUID;
BEGIN
    -- Hole Zertifikat
    SELECT * INTO v_cert
    FROM certificates
    WHERE id = p_certificate_id
    AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Zertifikat nicht gefunden';
    END IF;

    -- Hole ACME Account (erster aktiver)
    SELECT * INTO v_acme_account
    FROM acme_accounts
    WHERE tenant_id = p_tenant_id
    AND provider = 'letsencrypt'
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kein ACME Account gefunden. Bitte erstelle zuerst einen ACME Account.';
    END IF;

    -- ⚠️ WICHTIG: Prüfe Domain-Ownership
    DECLARE
        v_domain_owned BOOLEAN;
        v_check_domain TEXT;
    BEGIN
        -- Für Wildcards (*.example.com) prüfe gegen Basis-Domain (example.com)
        IF v_cert.subject_cn LIKE '*%' THEN
            v_check_domain := SUBSTRING(v_cert.subject_cn FROM 3);  -- Remove "*."
            
            -- Prüfe: Basis-Domain ODER irgendeine Subdomain existiert als Asset
            SELECT EXISTS (
                SELECT 1 
                FROM assets a
                WHERE a.tenant_id = p_tenant_id
                AND (
                    a.host = v_check_domain 
                    OR a.host = v_cert.subject_cn
                    OR a.host LIKE '%.' || v_check_domain  -- Beliebige Subdomain
                )
            ) INTO v_domain_owned;
        ELSE
            -- Normale Domain: Exakter Match
            SELECT EXISTS (
                SELECT 1 
                FROM assets a
                WHERE a.tenant_id = p_tenant_id
                AND a.host = v_cert.subject_cn
            ) INTO v_domain_owned;
        END IF;

        IF NOT v_domain_owned THEN
            RAISE EXCEPTION 'Domain-Ownership nicht verifiziert! Für Wildcard-Zertifikat muss mindestens eine Subdomain als Asset existieren.';
        END IF;
    END;

    -- Erstelle ACME Order (RICHTIGER Spaltenname!)
    INSERT INTO acme_orders (
        tenant_id,
        acme_account_id,  -- RICHTIG: acme_account_id (nicht account_id!)
        domain,
        challenge_type,
        status,
        key_size,
        auto_remediation
    ) VALUES (
        p_tenant_id,
        v_acme_account.id,
        v_cert.subject_cn,
        'dns-01',
        'pending',
        p_key_size,
        true
    ) RETURNING id INTO v_order_id;

    -- Log Event (nutze create_audit_event für automatische Hash-Berechnung)
    PERFORM create_audit_event(
        p_tenant_id,
        auth.uid(),
        'auto_remediation.created',
        jsonb_build_object(
            'certificate_id', p_certificate_id,
            'order_id', v_order_id,
            'domain', v_cert.subject_cn,
            'new_key_size', p_key_size,
            'old_key_size', v_cert.key_size
        )
    );

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Add auto_remediation column to acme_orders
-- ============================================================================
ALTER TABLE acme_orders 
ADD COLUMN IF NOT EXISTS auto_remediation BOOLEAN DEFAULT false;

ALTER TABLE acme_orders 
ADD COLUMN IF NOT EXISTS key_size INTEGER DEFAULT 2048;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_certificates_needing_remediation TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_remediation_order TO authenticated;

