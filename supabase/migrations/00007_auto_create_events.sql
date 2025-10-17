-- Automatische Event-Erstellung mit Hash-Chain
-- Erstellt Events für wichtige Aktionen (Zertifikate, Agents, etc.)

-- Funktion: Erstelle Event mit Hash-Chain
CREATE OR REPLACE FUNCTION create_audit_event(
    p_tenant_id UUID,
    p_user_id UUID,
    p_type TEXT,
    p_payload JSONB
)
RETURNS UUID AS $$
DECLARE
    v_prev_hash TEXT;
    v_hash TEXT;
    v_event_id UUID;
    v_canonical TEXT;
    v_ts TIMESTAMPTZ;
BEGIN
    v_ts := NOW();
    
    -- Hole letzten Hash für diesen Tenant
    SELECT hash INTO v_prev_hash
    FROM events
    WHERE tenant_id = p_tenant_id
    ORDER BY ts DESC
    LIMIT 1;
    
    -- Wenn kein vorheriger Event, nutze Null-Hash
    IF v_prev_hash IS NULL THEN
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;
    
    -- Berechne Hash: SHA256(prev_hash || canonical_json || timestamp)
    v_canonical := p_payload::text;
    v_hash := encode(
        digest(
            v_prev_hash || v_canonical || v_ts::text,
            'sha256'
        ),
        'hex'
    );
    
    -- Erstelle Event
    INSERT INTO events (tenant_id, user_id, type, payload, ts, prev_hash, hash)
    VALUES (p_tenant_id, p_user_id, p_type, p_payload, v_ts, v_prev_hash, v_hash)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-Event bei neuen Zertifikaten
CREATE OR REPLACE FUNCTION on_certificate_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        NULL, -- System action
        'certificate.created',
        jsonb_build_object(
            'certificate_id', NEW.id,
            'subject_cn', NEW.subject_cn,
            'fingerprint', NEW.fingerprint,
            'not_after', NEW.not_after,
            'issuer', NEW.issuer
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_certificate_created_event
    AFTER INSERT ON certificates
    FOR EACH ROW
    EXECUTE FUNCTION on_certificate_created();

-- Trigger: Auto-Event bei Agent-Verbindung
CREATE OR REPLACE FUNCTION on_connector_status_changed()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur wenn Status sich ändert
    IF NEW.status != OLD.status THEN
        PERFORM create_audit_event(
            NEW.tenant_id,
            NULL,
            CASE 
                WHEN NEW.status = 'active' THEN 'connector.connected'
                WHEN NEW.status = 'inactive' THEN 'connector.disconnected'
                ELSE 'connector.error'
            END,
            jsonb_build_object(
                'connector_id', NEW.id,
                'connector_name', NEW.name,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_connector_status_changed_event
    AFTER UPDATE ON connectors
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION on_connector_status_changed();

-- Trigger: Auto-Event bei neuen Discovery Results
CREATE OR REPLACE FUNCTION on_discovery_result_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        NULL,
        'discovery.host_found',
        jsonb_build_object(
            'ip_address', NEW.ip_address,
            'open_ports', NEW.open_ports,
            'services', NEW.services,
            'connector_id', NEW.connector_id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_discovery_result_created_event
    AFTER INSERT ON discovery_results
    FOR EACH ROW
    EXECUTE FUNCTION on_discovery_result_created();

-- Permissions
GRANT EXECUTE ON FUNCTION create_audit_event TO anon, authenticated;

COMMENT ON FUNCTION create_audit_event IS 'Erstellt Event mit kryptographischer Hash-Chain für Audit Log';

