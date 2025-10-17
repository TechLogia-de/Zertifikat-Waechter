-- Initial Schema for Zertifikat-Wächter
-- Multi-tenant certificate monitoring system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships Table (User-Tenant relationship)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'auditor', 'external')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Connectors Table (Agents for intranet scanning)
CREATE TABLE IF NOT EXISTS connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'agent' CHECK (type IN ('agent', 'scanner')),
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
    last_seen TIMESTAMPTZ,
    auth_token_hash TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets Table (hosts/services to monitor)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 443,
    proto TEXT NOT NULL DEFAULT 'https' CHECK (proto IN ('https', 'tls', 'ldaps', 'smtp', 'imap', 'pop3')),
    labels JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    fingerprint TEXT UNIQUE NOT NULL,
    subject_cn TEXT NOT NULL,
    san JSONB,
    issuer TEXT,
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    key_alg TEXT,
    key_size INTEGER,
    serial TEXT,
    is_trusted BOOLEAN DEFAULT false,
    is_self_signed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checks Table (scan results history)
CREATE TABLE IF NOT EXISTS checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE NOT NULL,
    ran_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'expired')),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    first_triggered_at TIMESTAMPTZ DEFAULT NOW(),
    last_notified_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies Table (alert policies per tenant)
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    warn_days INTEGER[] NOT NULL DEFAULT ARRAY[60, 30, 14, 7, 3, 1],
    channels JSONB NOT NULL DEFAULT '{"email": true, "webhook": false, "slack": false, "teams": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Events Table (audit log with hash chain)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    ts TIMESTAMPTZ DEFAULT NOW(),
    prev_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACME Accounts Table
CREATE TABLE IF NOT EXISTS acme_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('letsencrypt', 'zerossl', 'buypass')),
    email TEXT NOT NULL,
    account_url TEXT,
    private_key_ref TEXT, -- Reference to secure storage, NOT the key itself
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACME Orders Table
CREATE TABLE IF NOT EXISTS acme_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    acme_account_id UUID REFERENCES acme_accounts(id) ON DELETE CASCADE NOT NULL,
    domain TEXT NOT NULL,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('http-01', 'dns-01')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'valid', 'invalid', 'revoked')),
    order_url TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connectors_tenant_id ON connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_connector_id ON assets(connector_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_id ON certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_certificates_asset_id ON certificates(asset_id);
CREATE INDEX IF NOT EXISTS idx_certificates_not_after ON certificates(not_after);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_expiry ON certificates(tenant_id, not_after);
CREATE INDEX IF NOT EXISTS idx_certificates_fingerprint ON certificates(fingerprint);
CREATE INDEX IF NOT EXISTS idx_checks_certificate_id ON checks(certificate_id);
CREATE INDEX IF NOT EXISTS idx_checks_ran_at ON checks(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_certificate_id ON alerts(certificate_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_id ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_acme_orders_tenant_id ON acme_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acme_orders_status ON acme_orders(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acme_accounts_updated_at BEFORE UPDATE ON acme_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acme_orders_updated_at BEFORE UPDATE ON acme_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


