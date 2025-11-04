-- Quick Fix für discovery_results RLS Problem
-- Führe dieses SQL in Supabase SQL Editor aus!
-- Dashboard → SQL Editor → New Query → Paste & Run

-- 1. Alte Policies löschen
DROP POLICY IF EXISTS "Users see tenant discovery" ON discovery_results;
DROP POLICY IF EXISTS "Connectors can insert discovery" ON discovery_results;

-- 2. RLS komplett deaktivieren (wie assets, certificates, etc.)
ALTER TABLE discovery_results DISABLE ROW LEVEL SECURITY;

-- 3. Stelle sicher dass Anon Role volle Rechte hat
GRANT ALL ON discovery_results TO anon, authenticated;

-- 4. Stelle sicher dass Sequences auch zugänglich sind
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Erfolg prüfen
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'discovery_results';

-- Erwartetes Ergebnis: RLS Enabled = false


