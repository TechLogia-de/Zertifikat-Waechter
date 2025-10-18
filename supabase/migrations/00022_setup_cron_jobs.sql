-- =====================================================
-- Webhook Delivery System - Helper Functions
-- =====================================================
-- Diese Funktionen werden von den Cron-Jobs aufgerufen

-- Cleanup alte Webhook Deliveries
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_deliveries
    WHERE status = 'success'
    AND delivered_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % old webhook deliveries', v_deleted_count;
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_webhook_deliveries IS 'Löscht erfolgreiche Webhook-Deliveries älter als 30 Tage';

-- =====================================================
-- WICHTIG: Cron-Jobs müssen in Supabase Dashboard eingerichtet werden!
-- =====================================================
-- 
-- Supabase verwendet pg_cron, aber Jobs werden über das Dashboard verwaltet.
-- 
-- So richtest du die Cron-Jobs ein:
-- 
-- 1. Gehe zu: Supabase Dashboard → Database → Cron Jobs
-- 
-- 2. Erstelle folgende Jobs:
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ JOB 1: Alert Processing (alle 5 Minuten)                            │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Name:     process-alerts                                             │
-- │ Schedule: */5 * * * *                                                │
-- │ Command:  SELECT net.http_post(                                      │
-- │               url := current_setting('app.supabase_url')             │
-- │                      || '/functions/v1/send-alerts',                 │
-- │               headers := jsonb_build_object(                         │
-- │                   'Authorization',                                   │
-- │                   'Bearer ' || current_setting('app.service_role')   │
-- │               )                                                      │
-- │           ) as request_id;                                           │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ JOB 2: Webhook Queue Processing (jede Minute)                       │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Name:     process-webhook-queue                                      │
-- │ Schedule: * * * * *                                                  │
-- │ Command:  SELECT net.http_post(                                      │
-- │               url := current_setting('app.supabase_url')             │
-- │                      || '/functions/v1/process-webhook-queue',       │
-- │               headers := jsonb_build_object(                         │
-- │                   'Authorization',                                   │
-- │                   'Bearer ' || current_setting('app.service_role')   │
-- │               )                                                      │
-- │           ) as request_id;                                           │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ JOB 3: Certificate Scan (alle 6 Stunden)                            │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Name:     scan-certificates                                          │
-- │ Schedule: 0 */6 * * *                                                │
-- │ Command:  SELECT net.http_post(                                      │
-- │               url := current_setting('app.supabase_url')             │
-- │                      || '/functions/v1/scan-certificates',           │
-- │               headers := jsonb_build_object(                         │
-- │                   'Authorization',                                   │
-- │                   'Bearer ' || current_setting('app.service_role')   │
-- │               )                                                      │
-- │           ) as request_id;                                           │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ JOB 4: Cleanup Old Deliveries (täglich um 3 Uhr)                   │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Name:     cleanup-webhook-deliveries                                 │
-- │ Schedule: 0 3 * * *                                                  │
-- │ Command:  SELECT cleanup_old_webhook_deliveries();                   │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- =====================================================

-- Erstelle eine Tabelle für Job-Logs (optional, für Monitoring)
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'success', 'failed')),
    message TEXT,
    details JSONB
);

CREATE INDEX idx_cron_job_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX idx_cron_job_logs_started_at ON cron_job_logs(started_at DESC);

COMMENT ON TABLE cron_job_logs IS 'Log-Tabelle für Cron-Job Ausführungen';

