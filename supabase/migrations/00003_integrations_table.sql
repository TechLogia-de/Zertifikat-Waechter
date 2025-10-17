-- Integrations Table für SMTP, Slack, Webhook Settings
-- Führe diese Migration aus um Integrations zu aktivieren

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('smtp', 'slack', 'teams', 'webhook')),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, type, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled);

-- Updated_at trigger
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS deaktiviert (wie andere Tabellen für MVP)
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;

-- Permissions
GRANT ALL ON integrations TO anon, authenticated;

-- Beispiel-Einträge können später über UI erstellt werden

