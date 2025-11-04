-- Quick Migration für System-SMTP Feature
-- Kopiere diese SQL und führe sie im Supabase Dashboard aus!

-- 1. Füge neue Spalte hinzu
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS use_system_smtp BOOLEAN DEFAULT false;

-- 2. Index erstellen
CREATE INDEX IF NOT EXISTS idx_integrations_use_system_smtp 
ON integrations(use_system_smtp) 
WHERE type = 'smtp';

-- 3. Prüfe Ergebnis
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name = 'use_system_smtp';

-- 4. Zeige alle Spalten der Tabelle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'integrations'
ORDER BY ordinal_position;

