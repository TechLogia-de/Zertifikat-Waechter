# ⚡ Quick Guide: System-SMTP aktivieren

## 🎯 Was ist neu?

Benutzer können jetzt wählen:
- **System-SMTP**: E-Mails über den Zertifikat-Wächter Server senden (einfach!)
- **Eigener SMTP**: Eigenen E-Mail-Server verwenden (fortgeschritten)

---

## 🚀 3-Schritte Installation

### Schritt 1: Datenbank Migration
**Windows**:
```batch
apply-system-smtp-migration.bat
```

**Linux/Mac**:
```bash
./apply-system-smtp-migration.sh
```

**Oder manuell im Supabase Dashboard**:
1. Öffne https://app.supabase.com
2. SQL Editor → New Query
3. Kopiere `supabase/migrations/00023_system_smtp_option.sql`
4. Ausführen

---

### Schritt 2: System-SMTP konfigurieren

Bearbeite `worker/.env`:
```bash
# System-SMTP für alle Benutzer
SMTP_HOST=mail.techlogia.de
SMTP_PORT=587
SMTP_USER=noreply@zertifikat-waechter.de
SMTP_PASSWORD=dein_sicheres_passwort
SMTP_FROM=noreply@zertifikat-waechter.de
```

⚠️ **Wichtig**: Niemals in Git committen! `.env` ist bereits in `.gitignore`

---

### Schritt 3: Services neu starten

**Frontend neu bauen**:
```bash
cd frontend
npm run build
```

**Worker neu starten**:
```bash
cd worker
python api.py
```

✅ **Fertig!** System-SMTP ist jetzt aktiv!

---

## 👤 Benutzung (für Endbenutzer)

### Option A: System-SMTP (Empfohlen für Anfänger)

1. Login → **Integrationen**
2. Tab **"E-Mail"**
3. Klick auf Button **"System-SMTP aktiv"** ✓
4. Felder werden automatisch ausgegraut
5. Gib Test-E-Mail ein
6. Klick **"Test-Mail senden"**
7. ✅ E-Mail kommt über System-Server an!

**Vorteile**:
- ⚡ In 30 Sekunden fertig
- 🔒 Sicher und zuverlässig
- 📧 Professionelle Absender-Adresse
- 🎯 Keine SMTP-Kenntnisse nötig

---

### Option B: Eigener SMTP (für Profis)

1. Login → **Integrationen**
2. Tab **"E-Mail"**
3. Button auf **"Eigenen SMTP verwenden"** setzen
4. Trage deine Daten ein:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: `deine-email@gmail.com`
   - Password: `app-passwort`
   - From: `alerts@firma.de`
5. Klick **"Test-Mail senden"**
6. ✅ E-Mail kommt über deinen Server an!

---

## 🖼️ Screenshots

### System-SMTP aktiviert:
```
┌─────────────────────────────────────────┐
│ 🛡️ System-Benachrichtigungen           │
│                                         │
│ ✅ Aktiviert: Du nutzt den SMTP-Server│
│ von Zertifikat-Wächter...              │
│                                         │
│ [🛡️ System-SMTP aktiv ✓]              │
└─────────────────────────────────────────┘

┌─ SMTP Config (ausgegraut) ─────────────┐
│ Host: ████████████ (deaktiviert)       │
│ Port: ████ (deaktiviert)               │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Eigener SMTP aktiviert:
```
┌─────────────────────────────────────────┐
│ 🛡️ System-Benachrichtigungen           │
│                                         │
│ ⚙️ Eigener SMTP: Du verwendest deinen │
│ eigenen E-Mail-Server...               │
│                                         │
│ [⚙️ Eigenen SMTP verwenden →]          │
└─────────────────────────────────────────┘

┌─ SMTP Config ──────────────────────────┐
│ Host: [smtp.gmail.com____________]     │
│ Port: [587___]                         │
│ User: [alerts@firma.de__________]      │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## 🔍 Testen

### Test 1: System-SMTP
```bash
1. Öffne http://localhost:3000/integrations
2. Toggle auf "System-SMTP aktiv"
3. Test-E-Mail eingeben
4. "Test-Mail senden"
5. Prüfe Posteingang
   → Betreff: "🛡️ Test von Zertifikat-Wächter"
   → Inhalt: "Modus: System-SMTP (Zertifikat-Wächter)"
```

### Test 2: Eigener SMTP
```bash
1. Toggle auf "Eigenen SMTP verwenden"
2. Gmail Daten eintragen
3. "Test-Mail senden"
4. Prüfe Posteingang
   → Inhalt: "Modus: Eigener SMTP (smtp.gmail.com)"
```

---

## 🐛 Häufige Probleme

### "System-SMTP ist nicht vollständig konfiguriert"
**Ursache**: `.env` fehlt SMTP-Daten

**Lösung**:
```bash
cd worker
cat .env | grep SMTP
# Alle 5 Variablen müssen ausgefüllt sein!
```

---

### E-Mails kommen nicht an
**Debug-Schritte**:

1. **Worker Logs prüfen**:
   ```bash
   cd worker
   python api.py
   # Suche nach: "✅ E-Mail erfolgreich gesendet"
   ```

2. **SMTP-Verbindung testen**:
   ```bash
   cd worker
   python send_test_mail.py
   ```

3. **Spam-Ordner prüfen** 📧

---

### Toggle funktioniert nicht
**Browser Cache leeren**:
```
Strg + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

---

## 📊 Monitoring

### Welche Benutzer nutzen System-SMTP?
```sql
SELECT 
  t.name,
  i.use_system_smtp,
  i.enabled
FROM integrations i
JOIN tenants t ON t.id = i.tenant_id
WHERE i.type = 'smtp';
```

### Statistik
```sql
SELECT 
  CASE 
    WHEN use_system_smtp THEN 'System-SMTP'
    ELSE 'Eigener SMTP'
  END as modus,
  COUNT(*) as anzahl
FROM integrations
WHERE type = 'smtp' AND enabled = true
GROUP BY use_system_smtp;
```

---

## 📞 Support

Problem nicht gelöst?

1. **Logs prüfen**: `worker/api.py` Console
2. **Migration prüfen**: SQL Query oben
3. **Dokumentation**: `SYSTEM-SMTP-FEATURE.md`
4. **Issue erstellen**: Mit Screenshots + Logs

---

## ✅ Checkliste

- [ ] Migration ausgeführt
- [ ] `worker/.env` mit SMTP-Daten befüllt
- [ ] Frontend neu gebaut (`npm run build`)
- [ ] Worker neu gestartet (`python api.py`)
- [ ] Test-E-Mail mit System-SMTP versendet
- [ ] Test-E-Mail mit eigenem SMTP versendet
- [ ] Produktiv geschaltet! 🚀

---

**Viel Erfolg! Bei Fragen einfach melden! 💪**

