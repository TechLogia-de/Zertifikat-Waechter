-- Migration: System-SMTP Option
-- Ermöglicht Benutzern zwischen eigenem SMTP und System-SMTP zu wählen

-- Füge use_system_smtp Flag zu integrations hinzu
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS use_system_smtp BOOLEAN DEFAULT false;

COMMENT ON COLUMN integrations.use_system_smtp IS 
'Wenn true, wird der System-SMTP-Server verwendet (aus .env). Wenn false, werden die config-Daten des Users verwendet.';

-- Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_integrations_use_system_smtp ON integrations(use_system_smtp) WHERE type = 'smtp';

