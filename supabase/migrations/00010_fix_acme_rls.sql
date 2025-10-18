-- Fix ACME RLS Policies
-- Problem: FOR ALL mit USING funktioniert nicht für INSERT
-- Lösung: Separate Policies für SELECT, INSERT, UPDATE, DELETE

-- Drop alte Policies
DROP POLICY IF EXISTS "Admins can view acme accounts" ON acme_accounts;
DROP POLICY IF EXISTS "Admins can manage acme accounts" ON acme_accounts;
DROP POLICY IF EXISTS "Users can view acme orders" ON acme_orders;
DROP POLICY IF EXISTS "Admins can manage acme orders" ON acme_orders;

-- =====================================
-- ACME Accounts Policies (getrennt)
-- =====================================

-- SELECT: Admins können Accounts sehen
CREATE POLICY "Admins can view acme accounts"
    ON acme_accounts FOR SELECT
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- INSERT: Admins können Accounts erstellen
CREATE POLICY "Admins can insert acme accounts"
    ON acme_accounts FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- UPDATE: Admins können Accounts bearbeiten
CREATE POLICY "Admins can update acme accounts"
    ON acme_accounts FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']))
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- DELETE: Admins können Accounts löschen
CREATE POLICY "Admins can delete acme accounts"
    ON acme_accounts FOR DELETE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- =====================================
-- ACME Orders Policies (getrennt)
-- =====================================

-- SELECT: Alle User können Orders sehen
CREATE POLICY "Users can view acme orders"
    ON acme_orders FOR SELECT
    USING (user_has_tenant_access(tenant_id));

-- INSERT: Admins können Orders erstellen
CREATE POLICY "Admins can insert acme orders"
    ON acme_orders FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- UPDATE: Admins können Orders bearbeiten
CREATE POLICY "Admins can update acme orders"
    ON acme_orders FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']))
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- DELETE: Admins können Orders löschen
CREATE POLICY "Admins can delete acme orders"
    ON acme_orders FOR DELETE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']));

-- Comment
COMMENT ON TABLE acme_accounts IS 'ACME Certificate Authority Accounts with proper RLS';
COMMENT ON TABLE acme_orders IS 'ACME Certificate Renewal Orders with proper RLS';

