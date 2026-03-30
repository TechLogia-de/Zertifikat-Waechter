-- Add configurable alert interval per tenant
-- Defaults to 24 hours if not set (NULL)
ALTER TABLE policies ADD COLUMN IF NOT EXISTS alert_interval_hours INTEGER DEFAULT 24;

-- Ensure the value is at least 1 hour
ALTER TABLE policies ADD CONSTRAINT alert_interval_hours_min CHECK (alert_interval_hours >= 1);
