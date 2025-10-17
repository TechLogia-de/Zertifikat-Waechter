-- Row Level Security (RLS) Policies
-- Ensures multi-tenant data isolation

-- Helper function to check tenant access
CREATE OR REPLACE FUNCTION user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = target_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION user_has_role(target_tenant_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = target_tenant_id
        AND role = ANY(required_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE acme_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acme_orders ENABLE ROW LEVEL SECURITY;

-- Tenants Policies
CREATE POLICY "Users can view their tenants"
    ON tenants FOR SELECT
    USING (
        id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners can update their tenants"
    ON tenants FOR UPDATE
    USING (user_has_role(id, ARRAY['owner', 'admin']));

CREATE POLICY "Users can create tenants"
    ON tenants FOR INSERT
    WITH CHECK (true); -- Will create membership in trigger

-- Memberships Policies
CREATE POLICY "Users can view own memberships"
    ON memberships FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage memberships"
    ON memberships FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- Connectors Policies
CREATE POLICY "Users can view tenant connectors"
    ON connectors FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage connectors"
    ON connectors FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']));

-- Assets Policies
CREATE POLICY "Users can view tenant assets"
    ON assets FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Operators can manage assets"
    ON assets FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']));

-- Certificates Policies
CREATE POLICY "Users can view tenant certificates"
    ON certificates FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Operators can manage certificates"
    ON certificates FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']));

CREATE POLICY "Operators can update certificates"
    ON certificates FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']));

-- Checks Policies (read-only for most users)
CREATE POLICY "Users can view checks for their certificates"
    ON checks FOR SELECT
    USING (
        certificate_id IN (
            SELECT id FROM certificates 
            WHERE user_has_tenant_access(tenant_id)
        )
    );

CREATE POLICY "Operators can create checks"
    ON checks FOR INSERT
    WITH CHECK (
        certificate_id IN (
            SELECT id FROM certificates 
            WHERE user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator'])
        )
    );

-- Alerts Policies
CREATE POLICY "Users can view tenant alerts"
    ON alerts FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can acknowledge alerts"
    ON alerts FOR UPDATE
    USING (user_has_tenant_access(tenant_id))
    WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "System can create alerts"
    ON alerts FOR INSERT
    WITH CHECK (user_has_tenant_access(tenant_id));

-- Policies Policies (alert policies)
CREATE POLICY "Users can view tenant policies"
    ON policies FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage policies"
    ON policies FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- Events Policies (audit log - append only)
CREATE POLICY "Users can view tenant events"
    ON events FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "System can create events"
    ON events FOR INSERT
    WITH CHECK (user_has_tenant_access(tenant_id));

-- ACME Accounts Policies
CREATE POLICY "Admins can view acme accounts"
    ON acme_accounts FOR SELECT
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

CREATE POLICY "Admins can manage acme accounts"
    ON acme_accounts FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- ACME Orders Policies
CREATE POLICY "Users can view acme orders"
    ON acme_orders FOR SELECT
    USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage acme orders"
    ON acme_orders FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- Trigger: Auto-create membership when creating a tenant
CREATE OR REPLACE FUNCTION auto_create_tenant_membership()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO memberships (user_id, tenant_id, role)
    VALUES (auth.uid(), NEW.id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_tenant_created
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_tenant_membership();

-- View: User's tenants with role
CREATE OR REPLACE VIEW user_tenants AS
SELECT 
    t.id,
    t.name,
    t.created_at,
    m.role,
    m.created_at as member_since
FROM tenants t
JOIN memberships m ON t.id = m.tenant_id
WHERE m.user_id = auth.uid();


