-- Network Discovery Results Tabelle
-- Speichert gefundene Hosts, offene Ports und Services

CREATE TABLE IF NOT EXISTS discovery_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    connector_id UUID REFERENCES connectors(id) ON DELETE CASCADE NOT NULL,
    host TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    open_ports INTEGER[] DEFAULT '{}',
    services TEXT[] DEFAULT '{}',
    response_time INTEGER, -- in milliseconds
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connector_id, ip_address)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_discovery_results_tenant_id ON discovery_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_connector_id ON discovery_results(connector_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_ip ON discovery_results(ip_address);
CREATE INDEX IF NOT EXISTS idx_discovery_results_discovered_at ON discovery_results(discovered_at DESC);

-- Updated_at Trigger
CREATE TRIGGER update_discovery_results_updated_at BEFORE UPDATE ON discovery_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS deaktiviert für MVP (wie andere Tabellen)
ALTER TABLE discovery_results DISABLE ROW LEVEL SECURITY;

-- Permissions
GRANT ALL ON discovery_results TO anon, authenticated;

COMMENT ON TABLE discovery_results IS 'Network Discovery Ergebnisse: Gefundene Hosts, offene Ports, Services';
COMMENT ON COLUMN discovery_results.open_ports IS 'Array offener TCP Ports';
COMMENT ON COLUMN discovery_results.services IS 'Erkannte Services (HTTP, SSH, LDAP, etc.)';
COMMENT ON COLUMN discovery_results.response_time IS 'Response Time in Millisekunden';

