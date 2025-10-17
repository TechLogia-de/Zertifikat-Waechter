-- Migration: Connector Token System
-- Ermöglicht sichere Token-basierte Agent-Authentifizierung

-- Füge auth_token Spalte hinzu (nur temporär sichtbar bei Erstellung)
ALTER TABLE connectors 
  ADD COLUMN IF NOT EXISTS auth_token TEXT UNIQUE;

-- Funktion: Generiere sicheren Random Token
CREATE OR REPLACE FUNCTION generate_connector_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
BEGIN
    -- Generiere 32-Byte Random Hex Token (64 Zeichen)
    token := encode(gen_random_bytes(32), 'hex');
    RETURN 'cwt_' || token; -- Prefix: CertWatcher Token
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion: Erstelle Connector mit Token
CREATE OR REPLACE FUNCTION create_connector_with_token(
    p_tenant_id UUID,
    p_name TEXT,
    p_scan_targets TEXT[],
    p_scan_ports INTEGER[]
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    auth_token TEXT,
    tenant_id UUID,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_token TEXT;
    v_connector_id UUID;
BEGIN
    -- Generiere Token
    v_token := generate_connector_token();
    
    -- Erstelle Connector
    INSERT INTO connectors (tenant_id, name, type, status, auth_token, auth_token_hash, config)
    VALUES (
        p_tenant_id,
        p_name,
        'agent',
        'inactive',
        v_token,
        crypt(v_token, gen_salt('bf', 10)), -- Hash für sichere Speicherung
        jsonb_build_object(
            'scan_targets', p_scan_targets,
            'scan_ports', p_scan_ports
        )
    )
    RETURNING connectors.id INTO v_connector_id;
    
    -- Gebe Connector-Daten mit Token zurück (Token wird nur EINMAL angezeigt!)
    RETURN QUERY
    SELECT 
        connectors.id,
        connectors.name,
        v_token as auth_token,
        connectors.tenant_id,
        connectors.created_at
    FROM connectors
    WHERE connectors.id = v_connector_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion: Validiere Connector Token (für Agent Login)
CREATE OR REPLACE FUNCTION validate_connector_token(p_token TEXT)
RETURNS TABLE(
    connector_id UUID,
    tenant_id UUID,
    name TEXT,
    config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as connector_id,
        c.tenant_id,
        c.name,
        c.config
    FROM connectors c
    WHERE c.auth_token_hash = crypt(p_token, c.auth_token_hash)
    AND c.status != 'error';
    
    -- Wenn gefunden, update last_seen
    UPDATE connectors
    SET 
        last_seen = NOW(),
        status = 'active'
    WHERE id IN (
        SELECT c.id 
        FROM connectors c
        WHERE c.auth_token_hash = crypt(p_token, c.auth_token_hash)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion: Regeneriere Token (alter wird ungültig)
CREATE OR REPLACE FUNCTION regenerate_connector_token(p_connector_id UUID, p_user_id UUID)
RETURNS TABLE(
    new_token TEXT
) AS $$
DECLARE
    v_token TEXT;
    v_tenant_id UUID;
BEGIN
    -- Prüfe ob User Zugriff auf diesen Connector hat
    SELECT c.tenant_id INTO v_tenant_id
    FROM connectors c
    JOIN memberships m ON m.tenant_id = c.tenant_id
    WHERE c.id = p_connector_id
    AND m.user_id = p_user_id
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kein Zugriff auf diesen Connector';
    END IF;
    
    -- Generiere neuen Token
    v_token := generate_connector_token();
    
    -- Update Connector mit neuem Token
    UPDATE connectors
    SET 
        auth_token = v_token,
        auth_token_hash = crypt(v_token, gen_salt('bf', 10)),
        status = 'inactive', -- Status zurück auf inactive bis Agent sich neu verbindet
        updated_at = NOW()
    WHERE id = p_connector_id;
    
    RETURN QUERY SELECT v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Permissions (callable from Frontend via Supabase)
GRANT EXECUTE ON FUNCTION create_connector_with_token TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_connector_token TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION regenerate_connector_token TO authenticated, anon;

-- Index für schnelle Token-Validierung
CREATE INDEX IF NOT EXISTS idx_connectors_token_hash ON connectors(auth_token_hash) WHERE auth_token_hash IS NOT NULL;

COMMENT ON FUNCTION create_connector_with_token IS 'Erstellt Connector mit sicherem Token. Token bleibt in DB für spätere Anzeige.';
COMMENT ON FUNCTION validate_connector_token IS 'Validiert Agent Token und aktualisiert last_seen. Für Agent-Login.';
COMMENT ON FUNCTION regenerate_connector_token IS 'Generiert neuen Token und macht alten ungültig. Für Token-Reset.';

