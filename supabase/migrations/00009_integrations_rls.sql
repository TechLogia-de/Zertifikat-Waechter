-- Enable RLS for integrations table
-- Multi-Tenant Security für Integrations

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their tenant's integrations
CREATE POLICY "Users can view tenant integrations"
    ON integrations FOR SELECT
    USING (user_has_tenant_access(tenant_id));

-- Policy: Admins can manage integrations
CREATE POLICY "Admins can insert integrations"
    ON integrations FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

CREATE POLICY "Admins can update integrations"
    ON integrations FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']))
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

CREATE POLICY "Admins can delete integrations"
    ON integrations FOR DELETE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- Comment
COMMENT ON TABLE integrations IS 'Integration configs with RLS enabled for multi-tenant security';

