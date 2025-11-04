-- Fix RLS für discovery_results - Agent braucht INSERT/UPDATE Rechte
-- Problem: Migration 00012 hat RLS aktiviert, aber Policy user_has_tenant_access() 
--          funktioniert nicht für Anon Key (Agent)
-- Lösung: RLS deaktivieren wie bei assets/certificates (konsistent!)

-- 1. Alte Policies löschen
DROP POLICY IF EXISTS "Users see tenant discovery" ON discovery_results;
DROP POLICY IF EXISTS "Connectors can insert discovery" ON discovery_results;

-- 2. RLS komplett deaktivieren (wie assets, certificates, etc.)
ALTER TABLE discovery_results DISABLE ROW LEVEL SECURITY;

-- 3. Stelle sicher dass Anon Role volle Rechte hat
GRANT ALL ON discovery_results TO anon, authenticated;

-- 4. Stelle sicher dass Sequences auch zugänglich sind
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Kommentar für Dokumentation
COMMENT ON TABLE discovery_results IS 'Network Discovery Results - RLS disabled for Agent access via Anon Key (consistent with assets/certificates)';

