-- Add Cloudflare to integrations type constraint
-- Für ACME DNS-01 Challenge

-- Drop old constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;

-- Add new constraint with cloudflare
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check 
    CHECK (type IN ('smtp', 'slack', 'teams', 'webhook', 'cloudflare'));

-- Comment
COMMENT ON TABLE integrations IS 'Integration configs for SMTP, Slack, Teams, Webhooks, and Cloudflare DNS';

