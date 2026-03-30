-- Prevent duplicate assets per tenant (same host:port combination)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_unique_host_port_tenant
    ON assets(tenant_id, host, port)
    WHERE deleted_at IS NULL;

-- Index for certificate expiry queries (Reports, Dashboard, Alerts)
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_not_after
    ON certificates(tenant_id, not_after);
