-- Seed data for Zertifikat-Wächter
-- Run this to populate the database with demo data

-- Demo Tenant
INSERT INTO tenants (id, name) VALUES 
('00000000-0000-0000-0000-000000000001', 'Demo Tenant')
ON CONFLICT (id) DO NOTHING;

-- Demo User wird über Supabase Auth angelegt
-- Nach dem ersten Login manuell ein Membership anlegen:
-- INSERT INTO memberships (user_id, tenant_id, role) VALUES
-- ('<user_id_from_auth_users>', '00000000-0000-0000-0000-000000000001', 'owner');

-- Demo Assets
INSERT INTO assets (tenant_id, host, port, proto, labels, status) VALUES
('00000000-0000-0000-0000-000000000001', 'google.com', 443, 'https', '{"type": "external", "env": "prod"}', 'active'),
('00000000-0000-0000-0000-000000000001', 'github.com', 443, 'https', '{"type": "external", "env": "prod"}', 'active'),
('00000000-0000-0000-0000-000000000001', 'cloudflare.com', 443, 'https', '{"type": "external", "env": "prod"}', 'active')
ON CONFLICT DO NOTHING;

-- Demo Policy
INSERT INTO policies (tenant_id, warn_days, channels) VALUES
('00000000-0000-0000-0000-000000000001', ARRAY[60, 30, 14, 7, 3, 1], '{"email": true, "webhook": false}')
ON CONFLICT DO NOTHING;


