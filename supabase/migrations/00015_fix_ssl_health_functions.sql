-- Fix: Mehrdeutigkeit in get_assets_needing_ssl_check Function

DROP FUNCTION IF EXISTS get_assets_needing_ssl_check(UUID, INTEGER);

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
        FROM ssl_checks s
        WHERE s.asset_id = a.id  -- Explizit s.asset_id statt asset_id
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

-- Grant
GRANT EXECUTE ON FUNCTION get_assets_needing_ssl_check TO authenticated;

