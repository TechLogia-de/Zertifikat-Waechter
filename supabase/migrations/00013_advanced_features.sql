-- Migration: Advanced IT Features
-- Adds: SSL Health Checks, Tags, API Keys, Notification Rules, Compliance

-- ============================================================================
-- 1. SSL Health Checks Tabelle
-- ============================================================================
CREATE TABLE ssl_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    
    -- TLS Configuration
    tls_version TEXT,
    supported_protocols JSONB DEFAULT '[]'::jsonb,
    cipher_suites JSONB DEFAULT '[]'::jsonb,
    key_exchange TEXT,
    
    -- Security Score
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    protocol_score INTEGER,
    key_exchange_score INTEGER,
    cipher_strength_score INTEGER,
    
    -- Vulnerabilities
    vulnerabilities JSONB DEFAULT '[]'::jsonb,
    has_weak_ciphers BOOLEAN DEFAULT false,
    has_deprecated_protocols BOOLEAN DEFAULT false,
    supports_forward_secrecy BOOLEAN DEFAULT false,
    
    -- SSL Labs Integration
    ssllabs_grade TEXT,
    ssllabs_report_url TEXT,
    ssllabs_last_check TIMESTAMPTZ,
    
    -- Certificate Chain
    chain_issues JSONB DEFAULT '[]'::jsonb,
    is_chain_valid BOOLEAN DEFAULT true,
    
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ssl_checks_tenant_id ON ssl_checks(tenant_id);
CREATE INDEX idx_ssl_checks_certificate_id ON ssl_checks(certificate_id);
CREATE INDEX idx_ssl_checks_asset_id ON ssl_checks(asset_id);
CREATE INDEX idx_ssl_checks_checked_at ON ssl_checks(checked_at DESC);
CREATE INDEX idx_ssl_checks_overall_score ON ssl_checks(overall_score);

-- ============================================================================
-- 2. Tags für Organisation
-- ============================================================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tags_tenant_id ON tags(tenant_id);

-- Certificate Tags (Many-to-Many)
CREATE TABLE certificate_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(certificate_id, tag_id)
);

CREATE INDEX idx_certificate_tags_certificate_id ON certificate_tags(certificate_id);
CREATE INDEX idx_certificate_tags_tag_id ON certificate_tags(tag_id);

-- Asset Tags (Many-to-Many)
CREATE TABLE asset_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, tag_id)
);

CREATE INDEX idx_asset_tags_asset_id ON asset_tags(asset_id);
CREATE INDEX idx_asset_tags_tag_id ON asset_tags(tag_id);

-- ============================================================================
-- 3. API Keys für externe Integrationen
-- ============================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    
    -- Permissions
    permissions JSONB DEFAULT '["read"]'::jsonb,
    scopes JSONB DEFAULT '["certificates:read"]'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    
    -- Expiry
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    description TEXT,
    ip_whitelist JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- ============================================================================
-- 4. Advanced Notification Rules
-- ============================================================================
CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    -- Conditions (JSON Rules Engine)
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Beispiel: {"and": [{"field": "days_until_expiry", "operator": "<=", "value": 30}, {"field": "is_trusted", "operator": "=", "value": false}]}
    
    -- Filters
    certificate_filter JSONB DEFAULT '{}'::jsonb,
    asset_filter JSONB DEFAULT '{}'::jsonb,
    tag_filter JSONB DEFAULT '[]'::jsonb,
    
    -- Actions
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Beispiel: [{"type": "email", "recipients": ["admin@example.com"]}, {"type": "slack", "channel": "#alerts"}]
    
    -- Schedule
    schedule JSONB DEFAULT '{"type": "immediate"}'::jsonb,
    -- Beispiel: {"type": "cron", "expression": "0 9 * * *"} oder {"type": "immediate"}
    
    -- Throttling
    throttle_minutes INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    
    -- Statistics
    trigger_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_rules_tenant_id ON notification_rules(tenant_id);
CREATE INDEX idx_notification_rules_is_active ON notification_rules(is_active);
CREATE INDEX idx_notification_rules_priority ON notification_rules(priority DESC);

-- ============================================================================
-- 5. Compliance Standards Tracking
-- ============================================================================
CREATE TABLE compliance_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    requirements JSONB NOT NULL,
    -- Beispiel: {"min_key_size": 2048, "allowed_protocols": ["TLSv1.2", "TLSv1.3"], "max_cert_age_days": 397}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vordefinierte Standards
INSERT INTO compliance_standards (name, description, requirements) VALUES
('PCI-DSS', 'Payment Card Industry Data Security Standard', '{
    "min_key_size": 2048,
    "allowed_protocols": ["TLSv1.2", "TLSv1.3"],
    "max_cert_validity_days": 397,
    "require_forward_secrecy": true,
    "forbidden_ciphers": ["RC4", "3DES", "MD5"]
}'::jsonb),
('HIPAA', 'Health Insurance Portability and Accountability Act', '{
    "min_key_size": 2048,
    "allowed_protocols": ["TLSv1.2", "TLSv1.3"],
    "require_encryption": true,
    "require_forward_secrecy": true
}'::jsonb),
('ISO27001', 'Information Security Management', '{
    "min_key_size": 2048,
    "allowed_protocols": ["TLSv1.2", "TLSv1.3"],
    "max_cert_validity_days": 825,
    "require_certificate_monitoring": true
}'::jsonb),
('BSI TR-02102-2', 'German BSI Technical Guideline', '{
    "min_key_size": 3000,
    "allowed_protocols": ["TLSv1.2", "TLSv1.3"],
    "require_forward_secrecy": true,
    "forbidden_protocols": ["SSLv2", "SSLv3", "TLSv1.0", "TLSv1.1"]
}'::jsonb);

-- Compliance Checks
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    standard_id UUID REFERENCES compliance_standards(id) ON DELETE CASCADE,
    
    is_compliant BOOLEAN DEFAULT false,
    violations JSONB DEFAULT '[]'::jsonb,
    -- Beispiel: [{"rule": "min_key_size", "expected": 2048, "actual": 1024, "severity": "high"}]
    
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compliance_checks_tenant_id ON compliance_checks(tenant_id);
CREATE INDEX idx_compliance_checks_certificate_id ON compliance_checks(certificate_id);
CREATE INDEX idx_compliance_checks_standard_id ON compliance_checks(standard_id);
CREATE INDEX idx_compliance_checks_is_compliant ON compliance_checks(is_compliant);

-- ============================================================================
-- 6. RLS Policies für neue Tabellen
-- ============================================================================

-- SSL Checks RLS
ALTER TABLE ssl_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see tenant ssl_checks" ON ssl_checks
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );

-- Tags RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see tenant tags" ON tags
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );
CREATE POLICY "Users manage tenant tags" ON tags
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'operator')
        )
    );

-- Certificate Tags RLS
ALTER TABLE certificate_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see certificate_tags" ON certificate_tags
    FOR SELECT USING (
        certificate_id IN (
            SELECT c.id FROM certificates c
            JOIN memberships m ON c.tenant_id = m.tenant_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Asset Tags RLS
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see asset_tags" ON asset_tags
    FOR SELECT USING (
        asset_id IN (
            SELECT a.id FROM assets a
            JOIN memberships m ON a.tenant_id = m.tenant_id
            WHERE m.user_id = auth.uid()
        )
    );

-- API Keys RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see tenant api_keys" ON api_keys
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );
CREATE POLICY "Admins manage api_keys" ON api_keys
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Notification Rules RLS
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see tenant notification_rules" ON notification_rules
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );
CREATE POLICY "Admins manage notification_rules" ON notification_rules
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'operator')
        )
    );

-- Compliance Checks RLS
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see tenant compliance_checks" ON compliance_checks
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function: Get Compliance Status for Certificate
CREATE OR REPLACE FUNCTION get_certificate_compliance_status(cert_id UUID, tenant_uuid UUID)
RETURNS TABLE (
    standard_name TEXT,
    is_compliant BOOLEAN,
    violations JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.name,
        cc.is_compliant,
        cc.violations
    FROM compliance_checks cc
    JOIN compliance_standards cs ON cc.standard_id = cs.id
    WHERE cc.certificate_id = cert_id 
    AND cc.tenant_id = tenant_uuid
    ORDER BY cc.checked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get SSL Health Summary for Tenant
CREATE OR REPLACE FUNCTION get_ssl_health_summary(tenant_uuid UUID)
RETURNS TABLE (
    total_checks INTEGER,
    avg_score NUMERIC,
    critical_issues INTEGER,
    weak_ciphers INTEGER,
    deprecated_protocols INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_checks,
        ROUND(AVG(overall_score), 2) as avg_score,
        COUNT(*) FILTER (WHERE overall_score < 50)::INTEGER as critical_issues,
        COUNT(*) FILTER (WHERE has_weak_ciphers = true)::INTEGER as weak_ciphers,
        COUNT(*) FILTER (WHERE has_deprecated_protocols = true)::INTEGER as deprecated_protocols
    FROM ssl_checks
    WHERE tenant_id = tenant_uuid
    AND checked_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Triggers für Updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ssl_checks_updated_at BEFORE UPDATE ON ssl_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Ende Migration
-- ============================================================================

