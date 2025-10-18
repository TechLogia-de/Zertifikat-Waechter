-- ACME Provider Detection und Mixed Setup Support

-- ============================================================================
-- Add dns_provider column to assets
-- ============================================================================
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS dns_provider TEXT CHECK (dns_provider IN ('cloudflare', 'route53', 'other', 'unknown'));

-- ============================================================================
-- Function: Detect DNS Provider for Domain
-- ============================================================================
CREATE OR REPLACE FUNCTION detect_dns_provider(
    p_tenant_id UUID,
    p_domain TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_base_domain TEXT;
    v_has_cloudflare BOOLEAN;
BEGIN
    -- Extrahiere Basis-Domain
    IF p_domain LIKE '*%' THEN
        v_base_domain := SUBSTRING(p_domain FROM 3);
    ELSE
        v_base_domain := p_domain;
    END IF;

    -- Prüfe ob Cloudflare-Integration existiert und aktiv ist
    SELECT EXISTS (
        SELECT 1
        FROM integrations
        WHERE tenant_id = p_tenant_id
        AND type = 'cloudflare'
        AND is_active = true
        AND config->>'api_token' IS NOT NULL
    ) INTO v_has_cloudflare;

    IF v_has_cloudflare THEN
        RETURN 'cloudflare';
    END IF;

    -- Weitere Provider könnten hier geprüft werden
    -- Route53, Google Cloud DNS, etc.

    RETURN 'unknown';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get recommended challenge type
-- ============================================================================
CREATE OR REPLACE FUNCTION get_recommended_challenge_type(
    p_tenant_id UUID,
    p_domain TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_provider TEXT;
BEGIN
    v_provider := detect_dns_provider(p_tenant_id, p_domain);

    -- Cloudflare → DNS-01 (am besten für Wildcards)
    IF v_provider = 'cloudflare' THEN
        RETURN 'dns-01';
    END IF;

    -- Wildcard braucht IMMER DNS-01
    IF p_domain LIKE '*%' THEN
        RETURN 'dns-01';  -- Aber wird fehlschlagen ohne DNS-Provider!
    END IF;

    -- Normale Domain ohne DNS-Provider → HTTP-01
    RETURN 'http-01';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Check if domain can be auto-processed
-- ============================================================================
CREATE OR REPLACE FUNCTION can_auto_process_acme_order(
    p_tenant_id UUID,
    p_domain TEXT,
    p_challenge_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_provider TEXT;
BEGIN
    v_provider := detect_dns_provider(p_tenant_id, p_domain);

    -- DNS-01 braucht DNS Provider
    IF p_challenge_type = 'dns-01' THEN
        RETURN v_provider IN ('cloudflare', 'route53');
    END IF;

    -- HTTP-01 braucht Webserver-Zugriff (haben wir nicht)
    -- Für MVP: Nur manuelle HTTP-01
    IF p_challenge_type = 'http-01' THEN
        RETURN false;  -- Manuelle Verarbeitung nötig
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION detect_dns_provider TO authenticated;
GRANT EXECUTE ON FUNCTION get_recommended_challenge_type TO authenticated;
GRANT EXECUTE ON FUNCTION can_auto_process_acme_order TO authenticated;

