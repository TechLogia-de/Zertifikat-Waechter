-- ============================================================
-- Löscht ALLE Test-Daten für einen Tenant
-- ACHTUNG: Dies ist UNWIDERRUFLICH!
-- ============================================================

-- SCHRITT 1: Finde deine Tenant ID
-- Führe dies aus um deine Tenant ID zu sehen:

SELECT 
  m.tenant_id,
  t.name as tenant_name,
  u.email as user_email
FROM memberships m
JOIN tenants t ON m.tenant_id = t.id
JOIN auth.users u ON m.user_id = u.id
WHERE u.id = auth.uid();

-- Kopiere die tenant_id und ersetze sie unten!

-- ============================================================
-- SCHRITT 2: Ersetze DEINE_TENANT_ID mit der ID von oben
-- ============================================================

-- VORSICHT: Kommentiere die nächsten Zeilen nur aus, wenn du sicher bist!

/*
-- Deine Tenant ID hier eintragen:
DO $$
DECLARE
  v_tenant_id UUID := 'DEINE_TENANT_ID_HIER_EINFUEGEN';  -- ← HIER ÄNDERN!
BEGIN
  -- Lösche Checks (müssen zuerst weg wegen Foreign Key)
  DELETE FROM checks 
  WHERE certificate_id IN (
    SELECT id FROM certificates WHERE tenant_id = v_tenant_id
  );
  
  -- Lösche Alerts
  DELETE FROM alerts WHERE tenant_id = v_tenant_id;
  
  -- Lösche Certificates
  DELETE FROM certificates WHERE tenant_id = v_tenant_id;
  
  -- Lösche Assets
  DELETE FROM assets WHERE tenant_id = v_tenant_id;
  
  -- Zeige was gelöscht wurde
  RAISE NOTICE '✅ Alle Daten für Tenant % gelöscht!', v_tenant_id;
END $$;
*/

-- ============================================================
-- SCHRITT 3: Prüfe dass alles gelöscht ist
-- ============================================================

SELECT 
  (SELECT COUNT(*) FROM certificates WHERE tenant_id = auth.uid()) as certificates,
  (SELECT COUNT(*) FROM assets WHERE tenant_id = auth.uid()) as assets,
  (SELECT COUNT(*) FROM alerts WHERE tenant_id = auth.uid()) as alerts;

-- Sollte alle 0 zeigen!

-- ============================================================
-- FERTIG! Gehe zurück zur App und füge neue Domains hinzu!
-- ============================================================

