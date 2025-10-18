-- Complete Audit Logging für alle Features

-- ============================================================================
-- Neue Event-Types definieren
-- ============================================================================

-- SSL Health Events
-- ssl_health.check_started
-- ssl_health.check_completed
-- ssl_health.check_failed
-- ssl_health.bulk_check_started

-- Compliance Events  
-- compliance.check_started
-- compliance.check_completed
-- compliance.violation_detected
-- compliance.auto_fix_started
-- compliance.auto_fix_completed

-- API Keys Events
-- api_key.created
-- api_key.revoked
-- api_key.deleted
-- api_key.used

-- Notification Rules Events
-- notification_rule.created
-- notification_rule.updated
-- notification_rule.deleted
-- notification_rule.triggered

-- Tags Events
-- tag.created
-- tag.assigned
-- tag.removed
-- tag.deleted

-- ============================================================================
-- Trigger: SSL Health Check Events
-- ============================================================================
CREATE OR REPLACE FUNCTION on_ssl_check_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'ssl_health.check_completed',
        jsonb_build_object(
            'asset_id', NEW.asset_id,
            'certificate_id', NEW.certificate_id,
            'overall_score', NEW.overall_score,
            'has_issues', (NEW.has_weak_ciphers OR NEW.has_deprecated_protocols),
            'vulnerabilities_count', jsonb_array_length(NEW.vulnerabilities)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ssl_check_created_event ON ssl_checks;
CREATE TRIGGER on_ssl_check_created_event
    AFTER INSERT ON ssl_checks
    FOR EACH ROW
    EXECUTE FUNCTION on_ssl_check_created();

-- ============================================================================
-- Trigger: Compliance Check Events
-- ============================================================================
CREATE OR REPLACE FUNCTION on_compliance_check_created()
RETURNS TRIGGER AS $$
DECLARE
    v_standard_name TEXT;
BEGIN
    -- Hole Standard Name
    SELECT name INTO v_standard_name
    FROM compliance_standards
    WHERE id = NEW.standard_id;

    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        CASE 
            WHEN NEW.is_compliant THEN 'compliance.check_passed'
            ELSE 'compliance.violation_detected'
        END,
        jsonb_build_object(
            'certificate_id', NEW.certificate_id,
            'standard', v_standard_name,
            'is_compliant', NEW.is_compliant,
            'violations', NEW.violations
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_compliance_check_created_event ON compliance_checks;
CREATE TRIGGER on_compliance_check_created_event
    AFTER INSERT ON compliance_checks
    FOR EACH ROW
    EXECUTE FUNCTION on_compliance_check_created();

-- ============================================================================
-- Trigger: API Key Events
-- ============================================================================
CREATE OR REPLACE FUNCTION on_api_key_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'api_key.created',
        jsonb_build_object(
            'api_key_id', NEW.id,
            'name', NEW.name,
            'permissions', NEW.permissions,
            'scopes', NEW.scopes,
            'expires_at', NEW.expires_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_api_key_created_event ON api_keys;
CREATE TRIGGER on_api_key_created_event
    AFTER INSERT ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION on_api_key_created();

CREATE OR REPLACE FUNCTION on_api_key_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur bei Status-Änderung (revoke)
    IF OLD.is_active AND NOT NEW.is_active THEN
        PERFORM create_audit_event(
            NEW.tenant_id,
            auth.uid(),
            'api_key.revoked',
            jsonb_build_object(
                'api_key_id', NEW.id,
                'name', NEW.name
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_api_key_updated_event ON api_keys;
CREATE TRIGGER on_api_key_updated_event
    AFTER UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION on_api_key_updated();

-- ============================================================================
-- Trigger: Notification Rule Events
-- ============================================================================
CREATE OR REPLACE FUNCTION on_notification_rule_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'notification_rule.created',
        jsonb_build_object(
            'rule_id', NEW.id,
            'name', NEW.name,
            'conditions', NEW.conditions,
            'actions', NEW.actions,
            'is_active', NEW.is_active
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_notification_rule_created_event ON notification_rules;
CREATE TRIGGER on_notification_rule_created_event
    AFTER INSERT ON notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION on_notification_rule_created();

-- ============================================================================
-- Trigger: Tag Events
-- ============================================================================
CREATE OR REPLACE FUNCTION on_tag_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'tag.created',
        jsonb_build_object(
            'tag_id', NEW.id,
            'name', NEW.name,
            'color', NEW.color
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tag_created_event ON tags;
CREATE TRIGGER on_tag_created_event
    AFTER INSERT ON tags
    FOR EACH ROW
    EXECUTE FUNCTION on_tag_created();

CREATE OR REPLACE FUNCTION on_certificate_tag_assigned()
RETURNS TRIGGER AS $$
DECLARE
    v_cert RECORD;
    v_tag RECORD;
BEGIN
    -- Hole Zertifikat und Tag Info
    SELECT c.tenant_id, c.subject_cn INTO v_cert
    FROM certificates c
    WHERE c.id = NEW.certificate_id;

    SELECT t.name INTO v_tag
    FROM tags t
    WHERE t.id = NEW.tag_id;

    PERFORM create_audit_event(
        v_cert.tenant_id,
        auth.uid(),
        'tag.assigned',
        jsonb_build_object(
            'certificate_id', NEW.certificate_id,
            'certificate_cn', v_cert.subject_cn,
            'tag_id', NEW.tag_id,
            'tag_name', v_tag.name
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_certificate_tag_assigned_event ON certificate_tags;
CREATE TRIGGER on_certificate_tag_assigned_event
    AFTER INSERT ON certificate_tags
    FOR EACH ROW
    EXECUTE FUNCTION on_certificate_tag_assigned();

-- ============================================================================
-- Function: Log manual action from frontend
-- ============================================================================
CREATE OR REPLACE FUNCTION log_user_action(
    p_tenant_id UUID,
    p_action_type TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    v_event_id := create_audit_event(
        p_tenant_id,
        auth.uid(),
        p_action_type,
        p_payload
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_user_action TO authenticated;

-- ============================================================================
-- View: Recent Events per Category
-- ============================================================================
CREATE OR REPLACE VIEW event_summary AS
SELECT 
    tenant_id,
    DATE(ts) as event_date,
    SPLIT_PART(type, '.', 1) as category,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE type LIKE '%error%' OR type LIKE '%failed%') as error_count,
    COUNT(*) FILTER (WHERE type LIKE '%success%' OR type LIKE '%completed%') as success_count
FROM events
GROUP BY tenant_id, DATE(ts), SPLIT_PART(type, '.', 1);

ALTER VIEW event_summary SET (security_invoker = true);
GRANT SELECT ON event_summary TO authenticated;

-- ============================================================================
-- Stats Function
-- ============================================================================
CREATE OR REPLACE FUNCTION get_audit_stats(p_tenant_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_events INTEGER,
    events_today INTEGER,
    most_active_category TEXT,
    error_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(*) FILTER (WHERE ts > NOW() - INTERVAL '1 day')::INTEGER as events_today,
        MODE() WITHIN GROUP (ORDER BY SPLIT_PART(type, '.', 1)) as most_active_category,
        ROUND((COUNT(*) FILTER (WHERE type LIKE '%error%' OR type LIKE '%failed%')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) as error_rate
    FROM events
    WHERE tenant_id = p_tenant_id
    AND ts > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_audit_stats TO authenticated;

