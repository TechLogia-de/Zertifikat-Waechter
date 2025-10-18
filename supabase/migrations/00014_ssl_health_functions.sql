-- SSL Health Helper Functions und Verbesserungen

-- ============================================================================
-- Function: Trigger SSL Health Check für Asset
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_ssl_health_check(
    p_asset_id UUID,
    p_tenant_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_check_id UUID;
    v_asset RECORD;
BEGIN
    -- Hole Asset Details
    SELECT * INTO v_asset
    FROM assets
    WHERE id = p_asset_id
    AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset nicht gefunden oder keine Berechtigung';
    END IF;

    -- Erstelle Placeholder Check (wird von Edge Function aktualisiert)
    INSERT INTO ssl_checks (
        tenant_id,
        asset_id,
        tls_version,
        supported_protocols,
        cipher_suites,
        overall_score,
        protocol_score,
        key_exchange_score,
        cipher_strength_score,
        vulnerabilities,
        has_weak_ciphers,
        has_deprecated_protocols,
        supports_forward_secrecy,
        chain_issues,
        is_chain_valid
    ) VALUES (
        p_tenant_id,
        p_asset_id,
        'Scanning...',
        '[]'::jsonb,
        '[]'::jsonb,
        0,
        0,
        0,
        0,
        '[]'::jsonb,
        false,
        false,
        false,
        '[]'::jsonb,
        true
    ) RETURNING id INTO v_check_id;

    RETURN v_check_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get Latest SSL Check for Asset
-- ============================================================================
CREATE OR REPLACE FUNCTION get_latest_ssl_check(p_asset_id UUID)
RETURNS TABLE (
    id UUID,
    tls_version TEXT,
    overall_score INTEGER,
    has_issues BOOLEAN,
    checked_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.tls_version,
        sc.overall_score,
        (sc.has_weak_ciphers OR sc.has_deprecated_protocols OR NOT sc.supports_forward_secrecy) as has_issues,
        sc.checked_at
    FROM ssl_checks sc
    WHERE sc.asset_id = p_asset_id
    ORDER BY sc.checked_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get SSL Health Trend (letzte 30 Tage)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ssl_health_trend(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    check_date DATE,
    avg_score NUMERIC,
    total_checks INTEGER,
    issues_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(sc.checked_at) as check_date,
        ROUND(AVG(sc.overall_score), 2) as avg_score,
        COUNT(*)::INTEGER as total_checks,
        COUNT(*) FILTER (WHERE sc.overall_score < 70)::INTEGER as issues_count
    FROM ssl_checks sc
    WHERE sc.tenant_id = p_tenant_id
    AND sc.checked_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(sc.checked_at)
    ORDER BY check_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get SSL Score Distribution
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ssl_score_distribution(p_tenant_id UUID)
RETURNS TABLE (
    score_range TEXT,
    count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_checks AS (
        SELECT DISTINCT ON (asset_id) 
            overall_score
        FROM ssl_checks
        WHERE tenant_id = p_tenant_id
        ORDER BY asset_id, checked_at DESC
    )
    SELECT 
        CASE 
            WHEN overall_score >= 90 THEN 'A+ (90-100)'
            WHEN overall_score >= 80 THEN 'A (80-89)'
            WHEN overall_score >= 70 THEN 'B (70-79)'
            WHEN overall_score >= 60 THEN 'C (60-69)'
            WHEN overall_score >= 50 THEN 'D (50-59)'
            ELSE 'F (0-49)'
        END as score_range,
        COUNT(*)::INTEGER as count
    FROM latest_checks
    GROUP BY score_range
    ORDER BY 
        CASE 
            WHEN overall_score >= 90 THEN 1
            WHEN overall_score >= 80 THEN 2
            WHEN overall_score >= 70 THEN 3
            WHEN overall_score >= 60 THEN 4
            WHEN overall_score >= 50 THEN 5
            ELSE 6
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get Assets Needing SSL Check
-- ============================================================================
CREATE OR REPLACE FUNCTION get_assets_needing_ssl_check(
    p_tenant_id UUID,
    p_max_age_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    asset_id UUID,
    host TEXT,
    port INTEGER,
    last_check TIMESTAMPTZ,
    days_since_check INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as asset_id,
        a.host,
        a.port,
        sc.checked_at as last_check,
        EXTRACT(DAY FROM NOW() - sc.checked_at)::INTEGER as days_since_check
    FROM assets a
    LEFT JOIN LATERAL (
        SELECT checked_at
        FROM ssl_checks
        WHERE asset_id = a.id
        ORDER BY checked_at DESC
        LIMIT 1
    ) sc ON true
    WHERE a.tenant_id = p_tenant_id
    AND a.status = 'active'
    AND (
        sc.checked_at IS NULL 
        OR sc.checked_at < NOW() - (p_max_age_days || ' days')::INTERVAL
    )
    ORDER BY sc.checked_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Calculate SSL Score from Components
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_ssl_score(
    p_protocol_score INTEGER,
    p_key_exchange_score INTEGER,
    p_cipher_strength_score INTEGER,
    p_has_weak_ciphers BOOLEAN,
    p_has_deprecated_protocols BOOLEAN,
    p_supports_forward_secrecy BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
    v_base_score NUMERIC;
    v_final_score INTEGER;
BEGIN
    -- Durchschnitt der drei Hauptscores
    v_base_score := (p_protocol_score + p_key_exchange_score + p_cipher_strength_score) / 3.0;
    
    -- Abzüge für Schwachstellen
    IF p_has_weak_ciphers THEN
        v_base_score := v_base_score - 20;
    END IF;
    
    IF p_has_deprecated_protocols THEN
        v_base_score := v_base_score - 15;
    END IF;
    
    IF NOT p_supports_forward_secrecy THEN
        v_base_score := v_base_score - 10;
    END IF;
    
    -- Score zwischen 0 und 100 begrenzen
    v_final_score := GREATEST(0, LEAST(100, ROUND(v_base_score)));
    
    RETURN v_final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- View: Latest SSL Checks per Asset
-- ============================================================================
CREATE OR REPLACE VIEW latest_ssl_checks AS
SELECT DISTINCT ON (sc.asset_id)
    sc.id,
    sc.tenant_id,
    sc.asset_id,
    sc.certificate_id,
    sc.tls_version,
    sc.overall_score,
    sc.has_weak_ciphers,
    sc.has_deprecated_protocols,
    sc.supports_forward_secrecy,
    sc.checked_at,
    a.host,
    a.port
FROM ssl_checks sc
JOIN assets a ON sc.asset_id = a.id
ORDER BY sc.asset_id, sc.checked_at DESC;

-- ============================================================================
-- Auto-update overall_score beim INSERT/UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_calculate_ssl_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.overall_score := calculate_ssl_score(
        NEW.protocol_score,
        NEW.key_exchange_score,
        NEW.cipher_strength_score,
        NEW.has_weak_ciphers,
        NEW.has_deprecated_protocols,
        NEW.supports_forward_secrecy
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ssl_checks_calculate_score
    BEFORE INSERT OR UPDATE ON ssl_checks
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_ssl_score();

-- ============================================================================
-- RLS für View
-- ============================================================================
ALTER VIEW latest_ssl_checks SET (security_invoker = true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION trigger_ssl_health_check TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_ssl_check TO authenticated;
GRANT EXECUTE ON FUNCTION get_ssl_health_trend TO authenticated;
GRANT EXECUTE ON FUNCTION get_ssl_score_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_assets_needing_ssl_check TO authenticated;
GRANT SELECT ON latest_ssl_checks TO authenticated;

