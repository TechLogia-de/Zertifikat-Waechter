-- Soft-Delete Support für certificates, assets, connectors, integrations
-- Fügt deleted_at Spalte hinzu und aktualisiert RLS-Policies

-- =============================================
-- 1. deleted_at Spalte hinzufügen
-- =============================================

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================
-- 2. Partial Indexes für Performance (nur aktive Datensätze)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_certificates_active
    ON certificates(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_active
    ON assets(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_connectors_active
    ON connectors(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_integrations_active
    ON integrations(tenant_id) WHERE deleted_at IS NULL;

-- =============================================
-- 3. Certificates: RLS-Policies aktualisieren
-- =============================================

DROP POLICY IF EXISTS "Users can view tenant certificates" ON certificates;
CREATE POLICY "Users can view tenant certificates"
    ON certificates FOR SELECT
    USING (user_has_tenant_access(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Operators can manage certificates" ON certificates;
CREATE POLICY "Operators can manage certificates"
    ON certificates FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']));

DROP POLICY IF EXISTS "Operators can update certificates" ON certificates;
CREATE POLICY "Operators can update certificates"
    ON certificates FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']) AND deleted_at IS NULL);

-- =============================================
-- 4. Assets: RLS-Policies aktualisieren
-- =============================================

DROP POLICY IF EXISTS "Users can view tenant assets" ON assets;
CREATE POLICY "Users can view tenant assets"
    ON assets FOR SELECT
    USING (user_has_tenant_access(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Operators can manage assets" ON assets;
CREATE POLICY "Operators can manage assets"
    ON assets FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']) AND deleted_at IS NULL);

-- =============================================
-- 5. Connectors: RLS-Policies aktualisieren
-- =============================================

DROP POLICY IF EXISTS "Users can view tenant connectors" ON connectors;
CREATE POLICY "Users can view tenant connectors"
    ON connectors FOR SELECT
    USING (user_has_tenant_access(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can manage connectors" ON connectors;
CREATE POLICY "Admins can manage connectors"
    ON connectors FOR ALL
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin', 'operator']) AND deleted_at IS NULL);

-- =============================================
-- 6. Integrations: RLS-Policies aktualisieren
-- =============================================

DROP POLICY IF EXISTS "Users can view tenant integrations" ON integrations;
CREATE POLICY "Users can view tenant integrations"
    ON integrations FOR SELECT
    USING (user_has_tenant_access(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
CREATE POLICY "Admins can insert integrations"
    ON integrations FOR INSERT
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
CREATE POLICY "Admins can update integrations"
    ON integrations FOR UPDATE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']) AND deleted_at IS NULL)
    WITH CHECK (user_has_role(tenant_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;
CREATE POLICY "Admins can delete integrations"
    ON integrations FOR DELETE
    USING (user_has_role(tenant_id, ARRAY['owner', 'admin']) AND deleted_at IS NULL);

-- =============================================
-- 7. Helper-Funktion: Soft-Delete statt echtem DELETE
-- =============================================

CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Setzt deleted_at anstatt die Zeile zu löschen
    EXECUTE format(
        'UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1',
        TG_TABLE_SCHEMA, TG_TABLE_NAME
    ) USING OLD.id;
    RETURN NULL; -- Verhindert das echte DELETE
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION soft_delete IS 'Trigger-Funktion für Soft-Delete: setzt deleted_at statt Zeile zu löschen';

-- =============================================
-- Kommentare
-- =============================================

COMMENT ON COLUMN certificates.deleted_at IS 'Soft-Delete Zeitstempel - NULL bedeutet aktiv';
COMMENT ON COLUMN assets.deleted_at IS 'Soft-Delete Zeitstempel - NULL bedeutet aktiv';
COMMENT ON COLUMN connectors.deleted_at IS 'Soft-Delete Zeitstempel - NULL bedeutet aktiv';
COMMENT ON COLUMN integrations.deleted_at IS 'Soft-Delete Zeitstempel - NULL bedeutet aktiv';
