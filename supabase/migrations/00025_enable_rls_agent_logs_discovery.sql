-- Enable RLS auf agent_logs und discovery_results (KRITISCH)
-- Problem: Migration 00024 hat RLS auf discovery_results deaktiviert,
--          agent_logs hatte nur unvollständige Policies.
-- Lösung: RLS aktivieren mit vollständigen CRUD-Policies über memberships
--          und service_role Bypass für Edge Functions.

-- =============================================
-- 1. Discovery Results: Alte Policies aufräumen
-- =============================================

-- RLS aktivieren (war durch 00024 deaktiviert)
ALTER TABLE discovery_results ENABLE ROW LEVEL SECURITY;

-- Alte Policies entfernen falls vorhanden
DROP POLICY IF EXISTS "Users see tenant discovery" ON discovery_results;
DROP POLICY IF EXISTS "Connectors can insert discovery" ON discovery_results;

-- SELECT: User sieht nur Discovery-Results seines Tenants
CREATE POLICY "discovery_results_select_tenant"
    ON discovery_results FOR SELECT
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
        )
    );

-- INSERT: Benutzer mit Operator-Rolle können Ergebnisse erstellen
CREATE POLICY "discovery_results_insert_tenant"
    ON discovery_results FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    );

-- UPDATE: Benutzer mit Operator-Rolle können Ergebnisse aktualisieren
CREATE POLICY "discovery_results_update_tenant"
    ON discovery_results FOR UPDATE
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    );

-- DELETE: Nur Admins/Owners können Ergebnisse löschen
CREATE POLICY "discovery_results_delete_tenant"
    ON discovery_results FOR DELETE
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        )
    );

-- Service Role Bypass: Edge Functions können alles
CREATE POLICY "discovery_results_service_role_bypass"
    ON discovery_results FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 2. Agent Logs: Alte Policies aufräumen
-- =============================================

-- RLS aktivieren (sicherstellen dass aktiv)
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Alte Policies entfernen
DROP POLICY IF EXISTS "Users see tenant agent logs" ON agent_logs;
DROP POLICY IF EXISTS "System can create agent logs" ON agent_logs;

-- SELECT: User sieht nur Logs seines Tenants
CREATE POLICY "agent_logs_select_tenant"
    ON agent_logs FOR SELECT
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
        )
    );

-- INSERT: Benutzer mit Operator-Rolle können Logs erstellen
CREATE POLICY "agent_logs_insert_tenant"
    ON agent_logs FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    );

-- UPDATE: Benutzer mit Operator-Rolle können Logs aktualisieren
CREATE POLICY "agent_logs_update_tenant"
    ON agent_logs FOR UPDATE
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'operator')
        )
    );

-- DELETE: Nur Admins/Owners können Logs löschen
CREATE POLICY "agent_logs_delete_tenant"
    ON agent_logs FOR DELETE
    USING (
        tenant_id IN (
            SELECT m.tenant_id FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        )
    );

-- Service Role Bypass: Edge Functions und Worker können alles
CREATE POLICY "agent_logs_service_role_bypass"
    ON agent_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 3. Grants anpassen (nur authenticated, nicht anon)
-- =============================================

REVOKE ALL ON discovery_results FROM anon;
REVOKE ALL ON agent_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON discovery_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_logs TO authenticated;

-- =============================================
-- Kommentare
-- =============================================

COMMENT ON TABLE agent_logs IS 'Agent Logs mit vollständigen RLS-Policies - Tenant-isoliert über memberships';
COMMENT ON TABLE discovery_results IS 'Network Discovery Ergebnisse mit vollständigen RLS-Policies - Tenant-isoliert über memberships';
