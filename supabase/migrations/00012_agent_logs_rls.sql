-- Agent Logs & Discovery Results RLS
-- Multi-Tenant Security für Agent-Daten

-- =====================================
-- Agent Logs RLS
-- =====================================

-- RLS aktivieren
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- DROP alte Policies falls vorhanden
DROP POLICY IF EXISTS "Users see tenant agent logs" ON agent_logs;
DROP POLICY IF EXISTS "System can create agent logs" ON agent_logs;

-- SELECT: User sieht nur Logs seiner Tenant-Connectors
CREATE POLICY "Users see tenant agent logs" ON agent_logs
    FOR SELECT USING (
        connector_id IN (
            SELECT id FROM connectors 
            WHERE user_has_tenant_access(tenant_id)
        )
    );

-- INSERT: System kann Logs erstellen (Service Role)
CREATE POLICY "System can create agent logs" ON agent_logs
    FOR INSERT WITH CHECK (true); -- Agent schreibt mit Service Role

-- =====================================
-- Discovery Results RLS  
-- =====================================

-- RLS aktivieren
ALTER TABLE discovery_results ENABLE ROW LEVEL SECURITY;

-- DROP alte Policies falls vorhanden
DROP POLICY IF EXISTS "Users see tenant discovery" ON discovery_results;
DROP POLICY IF EXISTS "Connectors can insert discovery" ON discovery_results;

-- SELECT: User sieht nur Discovery-Results seines Tenants
CREATE POLICY "Users see tenant discovery" ON discovery_results
    FOR SELECT USING (user_has_tenant_access(tenant_id));

-- INSERT: Agents können Discovery-Results erstellen
CREATE POLICY "Connectors can insert discovery" ON discovery_results
    FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

-- =====================================
-- Comments
-- =====================================

COMMENT ON TABLE agent_logs IS 'Agent logs with RLS - users see only their tenant logs';
COMMENT ON TABLE discovery_results IS 'Network discovery results with RLS - tenant isolated';

-- =====================================
-- Test: Prüfe ob RLS funktioniert
-- =====================================
-- SELECT tablename, rls.relrowsecurity 
-- FROM pg_class rls
-- JOIN pg_namespace ns ON rls.relnamespace = ns.oid
-- WHERE ns.nspname = 'public' 
-- AND rls.relname IN ('agent_logs', 'discovery_results');
-- → Sollte relrowsecurity = true zeigen!

