-- Add device classification fields to discovery_results
-- These fields store the intelligent device detection results from the Go agent
ALTER TABLE discovery_results
  ADD COLUMN IF NOT EXISTS hostname TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS os_type TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS is_gateway BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banner_info TEXT;

-- Index for device type filtering
CREATE INDEX IF NOT EXISTS idx_discovery_results_device_type
  ON discovery_results(device_type)
  WHERE device_type IS NOT NULL;

-- Index for gateway lookup
CREATE INDEX IF NOT EXISTS idx_discovery_results_is_gateway
  ON discovery_results(tenant_id, is_gateway)
  WHERE is_gateway = TRUE;
