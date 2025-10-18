-- Compliance Dashboard Erweiterungen

-- ============================================================================
-- Function: Run Compliance Check für ein Zertifikat
-- ============================================================================
CREATE OR REPLACE FUNCTION run_compliance_check(
    p_certificate_id UUID,
    p_standard_id UUID,
    p_tenant_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_check_id UUID;
    v_cert RECORD;
    v_standard RECORD;
    v_violations JSONB := '[]'::jsonb;
    v_is_compliant BOOLEAN := true;
BEGIN
    -- Hole Zertifikat
    SELECT * INTO v_cert
    FROM certificates
    WHERE id = p_certificate_id
    AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Zertifikat nicht gefunden';
    END IF;

    -- Hole Standard
    SELECT * INTO v_standard
    FROM compliance_standards
    WHERE id = p_standard_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Standard nicht gefunden';
    END IF;

    -- Prüfe Key Size
    IF (v_standard.requirements->>'min_key_size')::integer IS NOT NULL THEN
        IF v_cert.key_size < (v_standard.requirements->>'min_key_size')::integer THEN
            v_violations := v_violations || jsonb_build_object(
                'rule', 'min_key_size',
                'severity', 'high',
                'expected', v_standard.requirements->>'min_key_size',
                'actual', v_cert.key_size,
                'message', 'Schlüsselgröße zu klein'
            );
            v_is_compliant := false;
        END IF;
    END IF;

    -- Prüfe Certificate Validity Days
    IF (v_standard.requirements->>'max_cert_validity_days')::integer IS NOT NULL THEN
        DECLARE
            v_validity_days INTEGER;
        BEGIN
            v_validity_days := EXTRACT(DAY FROM (v_cert.not_after - v_cert.not_before));
            IF v_validity_days > (v_standard.requirements->>'max_cert_validity_days')::integer THEN
                v_violations := v_violations || jsonb_build_object(
                    'rule', 'max_cert_validity_days',
                    'severity', 'medium',
                    'expected', v_standard.requirements->>'max_cert_validity_days',
                    'actual', v_validity_days,
                    'message', 'Zertifikat zu lange gültig'
                );
                v_is_compliant := false;
            END IF;
        END;
    END IF;

    -- Erstelle Check
    INSERT INTO compliance_checks (
        tenant_id,
        certificate_id,
        standard_id,
        is_compliant,
        violations
    ) VALUES (
        p_tenant_id,
        p_certificate_id,
        p_standard_id,
        v_is_compliant,
        v_violations
    ) RETURNING id INTO v_check_id;

    RETURN v_check_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Run Compliance Checks für alle Zertifikate eines Tenants
-- ============================================================================
CREATE OR REPLACE FUNCTION run_all_compliance_checks(
    p_tenant_id UUID,
    p_standard_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_certs INTEGER,
    checks_created INTEGER,
    compliant INTEGER,
    non_compliant INTEGER
) AS $$
DECLARE
    v_total INTEGER := 0;
    v_created INTEGER := 0;
    v_compliant INTEGER := 0;
    v_non_compliant INTEGER := 0;
    v_cert RECORD;
    v_standard RECORD;
    v_check_id UUID;
BEGIN
    -- Loop durch alle Zertifikate
    FOR v_cert IN 
        SELECT id FROM certificates 
        WHERE tenant_id = p_tenant_id
    LOOP
        v_total := v_total + 1;

        -- Loop durch Standards (entweder alle oder nur einen)
        FOR v_standard IN
            SELECT id FROM compliance_standards
            WHERE p_standard_id IS NULL OR id = p_standard_id
        LOOP
            BEGIN
                v_check_id := run_compliance_check(v_cert.id, v_standard.id, p_tenant_id);
                v_created := v_created + 1;

                -- Zähle compliant/non-compliant
                DECLARE
                    v_is_compliant BOOLEAN;
                BEGIN
                    SELECT is_compliant INTO v_is_compliant
                    FROM compliance_checks
                    WHERE id = v_check_id;

                    IF v_is_compliant THEN
                        v_compliant := v_compliant + 1;
                    ELSE
                        v_non_compliant := v_non_compliant + 1;
                    END IF;
                END;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Continue bei Fehler
                    NULL;
            END;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_total, v_created, v_compliant, v_non_compliant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get Compliance Trend (letzte 90 Tage)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_compliance_trend(
    p_tenant_id UUID,
    p_standard_id UUID,
    p_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    check_date DATE,
    compliance_rate NUMERIC,
    total_checks INTEGER,
    compliant INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(cc.checked_at) as check_date,
        ROUND((COUNT(*) FILTER (WHERE cc.is_compliant)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as compliance_rate,
        COUNT(*)::INTEGER as total_checks,
        COUNT(*) FILTER (WHERE cc.is_compliant)::INTEGER as compliant
    FROM compliance_checks cc
    WHERE cc.tenant_id = p_tenant_id
    AND cc.standard_id = p_standard_id
    AND cc.checked_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(cc.checked_at)
    ORDER BY check_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get Compliance Risk Score
-- ============================================================================
CREATE OR REPLACE FUNCTION get_compliance_risk_score(p_tenant_id UUID)
RETURNS TABLE (
    overall_score INTEGER,
    risk_level TEXT,
    critical_violations INTEGER,
    high_violations INTEGER,
    medium_violations INTEGER,
    standards_failing INTEGER
) AS $$
DECLARE
    v_total_checks INTEGER;
    v_compliant_checks INTEGER;
    v_critical_violations INTEGER := 0;
    v_high_violations INTEGER := 0;
    v_medium_violations INTEGER := 0;
    v_standards_failing INTEGER := 0;
    v_compliance_rate NUMERIC;
    v_score INTEGER;
    v_risk_level TEXT;
BEGIN
    -- Hole neueste Checks pro Zertifikat/Standard
    WITH latest_checks AS (
        SELECT DISTINCT ON (certificate_id, standard_id)
            *
        FROM compliance_checks
        WHERE tenant_id = p_tenant_id
        ORDER BY certificate_id, standard_id, checked_at DESC
    )
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE is_compliant)
    INTO v_total_checks, v_compliant_checks
    FROM latest_checks;

    -- Zähle Violations nach Severity
    WITH latest_checks AS (
        SELECT DISTINCT ON (certificate_id, standard_id)
            violations
        FROM compliance_checks
        WHERE tenant_id = p_tenant_id
        ORDER BY certificate_id, standard_id, checked_at DESC
    )
    SELECT 
        COUNT(*) FILTER (WHERE v->>'severity' = 'critical'),
        COUNT(*) FILTER (WHERE v->>'severity' = 'high'),
        COUNT(*) FILTER (WHERE v->>'severity' = 'medium')
    INTO v_critical_violations, v_high_violations, v_medium_violations
    FROM latest_checks, jsonb_array_elements(violations) v;

    -- Zähle Standards die nicht erfüllt werden
    WITH latest_checks AS (
        SELECT DISTINCT ON (standard_id)
            standard_id,
            is_compliant
        FROM compliance_checks
        WHERE tenant_id = p_tenant_id
        ORDER BY standard_id, checked_at DESC
    )
    SELECT COUNT(*) FILTER (WHERE NOT is_compliant)
    INTO v_standards_failing
    FROM latest_checks;

    -- Berechne Score
    IF v_total_checks = 0 THEN
        v_score := 0;
        v_risk_level := 'unknown';
    ELSE
        v_compliance_rate := (v_compliant_checks::NUMERIC / v_total_checks::NUMERIC) * 100;
        v_score := ROUND(v_compliance_rate - (v_critical_violations * 10) - (v_high_violations * 5) - (v_medium_violations * 2));
        v_score := GREATEST(0, LEAST(100, v_score));

        -- Risk Level
        IF v_score >= 80 THEN
            v_risk_level := 'low';
        ELSIF v_score >= 60 THEN
            v_risk_level := 'medium';
        ELSIF v_score >= 40 THEN
            v_risk_level := 'high';
        ELSE
            v_risk_level := 'critical';
        END IF;
    END IF;

    RETURN QUERY SELECT 
        v_score,
        v_risk_level,
        v_critical_violations,
        v_high_violations,
        v_medium_violations,
        v_standards_failing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get Remediation Actions
-- ============================================================================
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
        SELECT DISTINCT ON (certificate_id, standard_id)
            violations
        FROM compliance_checks
        WHERE tenant_id = p_tenant_id
        AND NOT is_compliant
        ORDER BY certificate_id, standard_id, checked_at DESC
    ),
    violations_expanded AS (
        SELECT 
            v->>'rule' as rule,
            v->>'severity' as severity
        FROM latest_checks, jsonb_array_elements(violations) v
    )
    SELECT 
        rule as violation_type,
        COUNT(*)::INTEGER as count,
        severity,
        CASE rule
            WHEN 'min_key_size' THEN 'Zertifikat erneuern mit größerer Schlüsselgröße (min. 2048 Bit, empfohlen 3072+ Bit)'
            WHEN 'max_cert_validity_days' THEN 'Neues Zertifikat mit kürzerer Gültigkeitsdauer ausstellen (max. 397 Tage für öffentliche CAs)'
            WHEN 'weak_signature' THEN 'Zertifikat mit stärkerem Signatur-Algorithmus erneuern (SHA-256 oder besser)'
            WHEN 'deprecated_protocol' THEN 'Server-Konfiguration anpassen: TLSv1.0/1.1 deaktivieren, nur TLSv1.2+ erlauben'
            ELSE 'Compliance-Anforderungen prüfen und Zertifikat/Server entsprechend konfigurieren'
        END as remediation
    FROM violations_expanded
    GROUP BY rule, severity
    ORDER BY 
        CASE severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
        END,
        count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION run_compliance_check TO authenticated;
GRANT EXECUTE ON FUNCTION run_all_compliance_checks TO authenticated;
GRANT EXECUTE ON FUNCTION get_compliance_trend TO authenticated;
GRANT EXECUTE ON FUNCTION get_compliance_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION get_remediation_actions TO authenticated;

