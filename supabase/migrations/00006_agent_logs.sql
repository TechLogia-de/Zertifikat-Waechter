-- Agent Logs Tabelle
-- Speichert strukturierte Logs von allen Agents für UI-Anzeige

CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    connector_id UUID REFERENCES connectors(id) ON DELETE CASCADE NOT NULL,
    connector_name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_agent_logs_tenant_id ON agent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_connector_id ON agent_logs(connector_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON agent_logs(level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp DESC);

-- RLS deaktiviert für MVP
ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;

-- Permissions
GRANT ALL ON agent_logs TO anon, authenticated;

-- Auto-Cleanup alte Logs (behalte nur letzte 7 Tage)
CREATE OR REPLACE FUNCTION cleanup_old_agent_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM agent_logs
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE agent_logs IS 'Strukturierte Logs von Agents für UI-Anzeige';
COMMENT ON FUNCTION cleanup_old_agent_logs IS 'Löscht Logs älter als 7 Tage (täglich ausführen)';

