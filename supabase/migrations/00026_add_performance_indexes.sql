-- Performance-Indexes für häufige Abfragen
-- Composite-Indexes für Multi-Tenant Queries die nach tenant_id + weiterer Spalte filtern

-- Certificates: Suche nach Subject CN innerhalb eines Tenants
CREATE INDEX IF NOT EXISTS idx_certificates_subject_tenant
    ON certificates(subject_cn, tenant_id);

-- Assets: Suche nach Host innerhalb eines Tenants
CREATE INDEX IF NOT EXISTS idx_assets_host_tenant
    ON assets(host, tenant_id);

-- Discovery Results: Zeitbasierte Abfragen pro Tenant (neueste zuerst)
CREATE INDEX IF NOT EXISTS idx_discovery_results_tenant_time
    ON discovery_results(tenant_id, discovered_at DESC);

-- Events: Filterung nach Event-Typ innerhalb eines Tenants
CREATE INDEX IF NOT EXISTS idx_events_tenant_type
    ON events(tenant_id, type);

-- Alerts: Filterung nach Status innerhalb eines Tenants
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status
    ON alerts(tenant_id, status);

-- Agent Logs: Zeitbasierte Abfragen pro Connector (neueste zuerst)
CREATE INDEX IF NOT EXISTS idx_agent_logs_connector_time
    ON agent_logs(connector_id, created_at DESC);
