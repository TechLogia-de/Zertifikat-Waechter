# System-SMTP Feature 🛡️

## Überblick

Mit dem neuen **System-SMTP** Feature können Benutzer wählen zwischen:

1. **Eigener SMTP-Server**: Benutzer konfiguriert seine eigenen SMTP-Zugangsdaten
2. **System-SMTP**: Benutzer nutzt den zentralen SMTP-Server von Zertifikat-Wächter

Dies macht die Einrichtung für Benutzer ohne eigenen E-Mail-Server deutlich einfacher!

---

## 📋 Änderungen

### 1. Datenbank Migration
**Datei**: `supabase/migrations/00023_system_smtp_option.sql`

```sql
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS use_system_smtp BOOLEAN DEFAULT false;
```

**Ausführen**:
```bash
# Lokal mit Supabase CLI
supabase db push

# Oder direkt in Supabase Dashboard SQL Editor
```

---

### 2. Frontend Anpassungen
**Datei**: `frontend/src/pages/Integrations.tsx`

#### Neuer Toggle-Button
- Schöner visueller Toggle zwischen "System-SMTP" und "Eigener SMTP"
- Automatische Deaktivierung der Config-Felder wenn System-SMTP aktiv ist
- Klare Statusmeldungen welcher Modus aktiv ist

#### Funktionen
- `saveSMTP()` - Speichert das `use_system_smtp` Flag
- `testSMTPConnection()` - Testet E-Mail-Versand mit gewähltem Modus
- `loadIntegrations()` - Lädt gespeicherte Einstellung

---

### 3. Backend Anpassungen
**Datei**: `worker/api.py`

#### Endpunkt `/send-email`
```python
# Prüft use_system_smtp Flag
if use_system_smtp:
    # Verwende System-SMTP aus .env
    smtp_config = {
        'host': os.getenv('SMTP_HOST'),
        'port': int(os.getenv('SMTP_PORT', 587)),
        'user': os.getenv('SMTP_USER'),
        'password': os.getenv('SMTP_PASSWORD'),
        'from': os.getenv('SMTP_FROM')
    }
else:
    # Verwende User-Config
    smtp_config = data.get('smtp_config')
```

---

## 🚀 Deployment

### 1. Datenbank Migration anwenden
```bash
# SSH auf Server
ssh root@your-server.com

cd /root/Zertifikat-Wächter

# Migration ausführen (wenn Supabase lokal)
supabase db push

# ODER in Supabase Dashboard:
# 1. Gehe zu SQL Editor
# 2. Kopiere Inhalt von supabase/migrations/00023_system_smtp_option.sql
# 3. Führe aus
```

### 2. Frontend neu bauen
```bash
cd frontend
npm run build
```

### 3. Backend neu starten
```bash
# Worker/API neu starten
cd worker
source venv/bin/activate  # Windows: venv\Scripts\activate
python api.py

# Oder via Docker
docker-compose restart worker
```

---

## 👤 Benutzung

### Für Administratoren

#### System-SMTP konfigurieren
In `worker/.env`:
```bash
SMTP_HOST=mail.techlogia.de
SMTP_PORT=587
SMTP_USER=noreply@zertifikat-waechter.de
SMTP_PASSWORD=super_geheim_123
SMTP_FROM=noreply@zertifikat-waechter.de
```

**⚠️ Wichtig**: Diese Credentials sind sensitiv! Niemals in Git committen!

---

### Für Endbenutzer

#### Option 1: System-SMTP verwenden (Einfach! 🎉)

1. Gehe zu **Integrationen** → **E-Mail**
2. Klicke auf **"System-SMTP aktiv"** Toggle
3. Gib deine Test-E-Mail ein
4. Klicke **"Test-Mail senden"**
5. ✅ Fertig! E-Mails werden über den zentralen Server versendet

**Vorteile**:
- ✅ Keine SMTP-Konfiguration nötig
- ✅ Sofort einsatzbereit
- ✅ Zuverlässiger Server
- ✅ Professionelle Absender-Adresse

---

#### Option 2: Eigener SMTP-Server (Fortgeschritten)

1. Gehe zu **Integrationen** → **E-Mail**
2. Toggle ist auf **"Eigenen SMTP verwenden"**
3. Trage deine SMTP-Daten ein:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Benutzer: `deine-email@gmail.com`
   - Passwort: `app-passwort` (nicht normales Passwort!)
   - From: `alerts@deine-firma.de`
4. Klicke **"Test-Mail senden"**

**Vorteile**:
- ✅ Eigene Kontrolle über E-Mails
- ✅ Eigene Absender-Adresse
- ✅ Eigene Server-Infrastruktur

---

## 🔍 Testen

### Test 1: System-SMTP
```bash
# 1. Frontend öffnen
http://localhost:3000/integrations

# 2. Toggle auf "System-SMTP aktiv" setzen
# 3. Test-E-Mail Adresse eingeben
# 4. "Test-Mail senden" klicken
# ✅ E-Mail sollte ankommen mit Hinweis "System-SMTP (Zertifikat-Wächter)"
```

### Test 2: Eigener SMTP
```bash
# 1. Frontend öffnen
# 2. Toggle auf "Eigenen SMTP verwenden" setzen
# 3. SMTP-Daten eintragen (z.B. Gmail)
# 4. Test-E-Mail senden
# ✅ E-Mail sollte ankommen mit Hinweis "Eigener SMTP (smtp.gmail.com)"
```

---

## 📊 Datenbank Abfragen

### Prüfen welche Tenants System-SMTP verwenden
```sql
SELECT 
  t.name as tenant,
  i.use_system_smtp,
  i.config->>'host' as smtp_host,
  i.enabled
FROM integrations i
JOIN tenants t ON t.id = i.tenant_id
WHERE i.type = 'smtp';
```

### Statistik
```sql
SELECT 
  use_system_smtp,
  COUNT(*) as anzahl
FROM integrations
WHERE type = 'smtp' AND enabled = true
GROUP BY use_system_smtp;
```

---

## 🔒 Sicherheitshinweise

### System-SMTP Credentials
1. **Niemals in Git committen!**
2. Nur in `.env` speichern
3. `.env` ist in `.gitignore`
4. Auf Produktionsserver sicher speichern
5. Regelmäßig Passwörter rotieren

### RLS (Row Level Security)
Die `integrations` Tabelle hat bereits RLS aktiviert:
```sql
-- Nur eigene Tenant-Integrations sehen
CREATE POLICY "Users can view own tenant integrations"
ON integrations FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
));
```

---

## 🐛 Troubleshooting

### Problem: "System-SMTP ist nicht vollständig konfiguriert"
**Lösung**: Prüfe `worker/.env`:
```bash
cat worker/.env | grep SMTP
```
Alle Felder müssen ausgefüllt sein!

### Problem: E-Mails kommen nicht an
**Debug**:
```bash
# Worker Logs prüfen
tail -f worker/logs/worker.log

# API Logs
python worker/api.py
# Sollte zeigen: "✅ E-Mail erfolgreich gesendet via System-SMTP"
```

### Problem: Migration schlägt fehl
**Lösung**:
```sql
-- Prüfe ob Spalte bereits existiert
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name = 'use_system_smtp';

-- Wenn leer, führe Migration manuell aus
ALTER TABLE integrations ADD COLUMN use_system_smtp BOOLEAN DEFAULT false;
```

---

## 🎯 Nächste Schritte

### Geplante Erweiterungen
1. ✅ System-SMTP Toggle (Fertig!)
2. 🔄 SMTP-Integration in `send-alerts` Function (TODO)
3. 🔄 Rate-Limiting für System-SMTP (TODO)
4. 🔄 E-Mail Templates anpassbar machen (TODO)
5. 🔄 Multi-SMTP Provider Support (Sendgrid, Mailgun, etc.)

---

## 📝 Changelog

### Version 1.0 (2025-10-20)
- ✅ System-SMTP Toggle im Frontend
- ✅ Backend unterstützt System-SMTP aus .env
- ✅ Datenbank Migration
- ✅ Test-Funktion für beide Modi
- ✅ Visuelle Unterscheidung aktiv/inaktiv

---

## 📞 Support

Bei Fragen oder Problemen:
1. Logs prüfen: `worker/api.py` Console Output
2. Datenbank prüfen: SQL Queries oben verwenden
3. Issue erstellen mit:
   - Fehlermeldung
   - Screenshots
   - Log-Auszüge

---

**Viel Erfolg mit dem neuen System-SMTP Feature! 🚀**

