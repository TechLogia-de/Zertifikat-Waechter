-- ACME Audit Events
-- Automatische Event-Erstellung für alle ACME-Aktionen

-- =====================================
-- Trigger: ACME Account erstellt
-- =====================================
CREATE OR REPLACE FUNCTION on_acme_account_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'acme.account.created',
        jsonb_build_object(
            'account_id', NEW.id,
            'provider', NEW.provider,
            'email', NEW.email,
            'status', NEW.status
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_acme_account_created_event
    AFTER INSERT ON acme_accounts
    FOR EACH ROW
    EXECUTE FUNCTION on_acme_account_created();

-- =====================================
-- Trigger: ACME Account gelöscht
-- =====================================
CREATE OR REPLACE FUNCTION on_acme_account_deleted()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        OLD.tenant_id,
        auth.uid(),
        'acme.account.deleted',
        jsonb_build_object(
            'account_id', OLD.id,
            'provider', OLD.provider,
            'email', OLD.email
        )
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_acme_account_deleted_event
    BEFORE DELETE ON acme_accounts
    FOR EACH ROW
    EXECUTE FUNCTION on_acme_account_deleted();

-- =====================================
-- Trigger: ACME Order erstellt
-- =====================================
CREATE OR REPLACE FUNCTION on_acme_order_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'acme.order.created',
        jsonb_build_object(
            'order_id', NEW.id,
            'domain', NEW.domain,
            'challenge_type', NEW.challenge_type,
            'status', NEW.status
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_acme_order_created_event
    AFTER INSERT ON acme_orders
    FOR EACH ROW
    EXECUTE FUNCTION on_acme_order_created();

-- =====================================
-- Trigger: ACME Order Status geändert
-- =====================================
CREATE OR REPLACE FUNCTION on_acme_order_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur Event erstellen wenn Status sich geändert hat
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM create_audit_event(
            NEW.tenant_id,
            auth.uid(),
            'acme.order.status_changed',
            jsonb_build_object(
                'order_id', NEW.id,
                'domain', NEW.domain,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'last_error', NEW.last_error
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_acme_order_updated_event
    AFTER UPDATE ON acme_orders
    FOR EACH ROW
    EXECUTE FUNCTION on_acme_order_updated();

-- =====================================
-- Trigger: ACME Order gelöscht
-- =====================================
CREATE OR REPLACE FUNCTION on_acme_order_deleted()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        OLD.tenant_id,
        auth.uid(),
        'acme.order.deleted',
        jsonb_build_object(
            'order_id', OLD.id,
            'domain', OLD.domain,
            'status', OLD.status
        )
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_acme_order_deleted_event
    BEFORE DELETE ON acme_orders
    FOR EACH ROW
    EXECUTE FUNCTION on_acme_order_deleted();

-- =====================================
-- Trigger: Cloudflare Integration gespeichert
-- =====================================
CREATE OR REPLACE FUNCTION on_cloudflare_config_saved()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur für Cloudflare Integrations
    IF NEW.type = 'cloudflare' THEN
        PERFORM create_audit_event(
            NEW.tenant_id,
            auth.uid(),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'acme.cloudflare.configured'
                ELSE 'acme.cloudflare.updated'
            END,
            jsonb_build_object(
                'integration_id', NEW.id,
                'enabled', NEW.enabled,
                'has_zone_id', (NEW.config->>'zone_id' IS NOT NULL AND NEW.config->>'zone_id' != '')
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_cloudflare_integration_event
    AFTER INSERT OR UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION on_cloudflare_config_saved();

-- Comment
COMMENT ON FUNCTION create_audit_event IS 'Creates tamper-proof audit events with SHA-256 hash chain for ACME operations';

