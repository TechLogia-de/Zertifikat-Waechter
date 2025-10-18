-- =====================================================
-- Webhook Delivery System für Produktion
-- =====================================================

-- Webhook Delivery Logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    -- Delivery Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    
    -- Response Details
    status_code INT,
    response_body TEXT,
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    next_retry_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Metadata
    request_headers JSONB,
    response_headers JSONB
);

-- Indizes für Performance
CREATE INDEX idx_webhook_deliveries_tenant ON webhook_deliveries(tenant_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- RLS Policies
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own webhook deliveries" ON webhook_deliveries
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
        )
    );

-- Webhook Delivery Queue Function
CREATE OR REPLACE FUNCTION queue_webhook_delivery(
    p_tenant_id UUID,
    p_integration_id UUID,
    p_event_type TEXT,
    p_payload JSONB,
    p_max_attempts INT DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delivery_id UUID;
BEGIN
    INSERT INTO webhook_deliveries (
        tenant_id,
        integration_id,
        event_type,
        payload,
        status,
        max_attempts
    ) VALUES (
        p_tenant_id,
        p_integration_id,
        p_event_type,
        p_payload,
        'pending',
        p_max_attempts
    )
    RETURNING id INTO v_delivery_id;
    
    RETURN v_delivery_id;
END;
$$;

-- Funktion: Webhook als erfolgreich markieren
CREATE OR REPLACE FUNCTION mark_webhook_delivered(
    p_delivery_id UUID,
    p_status_code INT,
    p_response_body TEXT DEFAULT NULL,
    p_response_headers JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE webhook_deliveries
    SET 
        status = 'success',
        delivered_at = NOW(),
        status_code = p_status_code,
        response_body = p_response_body,
        response_headers = p_response_headers
    WHERE id = p_delivery_id;
END;
$$;

-- Funktion: Webhook Retry planen
CREATE OR REPLACE FUNCTION schedule_webhook_retry(
    p_delivery_id UUID,
    p_error_message TEXT,
    p_status_code INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attempts INT;
    v_max_attempts INT;
    v_backoff_seconds INT;
BEGIN
    -- Hole aktuelle Versuche
    SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM webhook_deliveries
    WHERE id = p_delivery_id;
    
    v_attempts := v_attempts + 1;
    
    IF v_attempts >= v_max_attempts THEN
        -- Max Versuche erreicht
        UPDATE webhook_deliveries
        SET 
            status = 'failed',
            attempts = v_attempts,
            error_message = p_error_message,
            status_code = p_status_code
        WHERE id = p_delivery_id;
    ELSE
        -- Exponential Backoff: 2^attempts Minuten
        v_backoff_seconds := POWER(2, v_attempts) * 60;
        
        UPDATE webhook_deliveries
        SET 
            status = 'retrying',
            attempts = v_attempts,
            error_message = p_error_message,
            status_code = p_status_code,
            next_retry_at = NOW() + (v_backoff_seconds || ' seconds')::INTERVAL
        WHERE id = p_delivery_id;
    END IF;
END;
$$;

-- View: Webhook Delivery Stats
CREATE OR REPLACE VIEW webhook_delivery_stats AS
SELECT
    tenant_id,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'success') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'retrying') as retrying,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    ROUND(AVG(attempts), 2) as avg_attempts,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as success_rate
FROM webhook_deliveries
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- RLS für View
ALTER VIEW webhook_delivery_stats SET (security_invoker = on);

COMMENT ON TABLE webhook_deliveries IS 'Webhook Delivery Log mit Retry-Mechanismus';
COMMENT ON FUNCTION queue_webhook_delivery IS 'Webhook in Delivery Queue einreihen';
COMMENT ON FUNCTION mark_webhook_delivered IS 'Webhook als erfolgreich zugestellt markieren';
COMMENT ON FUNCTION schedule_webhook_retry IS 'Webhook für Retry planen mit Exponential Backoff';

