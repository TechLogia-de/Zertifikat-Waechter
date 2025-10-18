# 🚀 Webhook-Integration - Produktions-Setup

## Überblick

Das Webhook-System ist vollständig produktionsbereit und läuft **automatisch im Hintergrund**. Du musst nur die Webhooks über die UI konfigurieren - den Rest erledigt das System!

## ✨ Features

- ✅ **Automatische Delivery Queue** - Webhooks werden gepuffert und asynchron versendet
- ✅ **Retry mit Exponential Backoff** - Fehlgeschlagene Webhooks werden automatisch wiederholt
- ✅ **HMAC-SHA256 Signierung** - Jeder Webhook ist kryptographisch signiert
- ✅ **URL-Validierung** - Private IPs werden blockiert (SSRF-Schutz)
- ✅ **Monitoring & Logs** - Vollständige Nachverfolgbarkeit in der UI
- ✅ **Configurable Timeouts** - Anpassbare Timeout und Retry-Einstellungen
- ✅ **Rate Limiting** - Verhindert Spam (24h Cooldown pro Alert)

## 📋 Setup-Anleitung (Schritt für Schritt)

### 1. Migrationen ausführen

```bash
# Im Projekt-Root
cd supabase

# Migrations pushen
supabase db push
```

Oder via Supabase Dashboard:
- Gehe zu **SQL Editor**
- Führe die Migrationen aus:
  - `00021_webhook_delivery_system.sql`
  - `00022_setup_cron_jobs.sql`

### 2. Edge Functions deployen

```bash
# Deploy alle Functions
supabase functions deploy send-webhook
supabase functions deploy send-alerts
supabase functions deploy process-webhook-queue
```

### 3. Cron-Jobs einrichten (WICHTIG!)

Gehe zu: **Supabase Dashboard → Database → Cron Jobs**

#### Job 1: Alert Processing (alle 5 Minuten)
```
Name:     process-alerts
Schedule: */5 * * * *
Command:
SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-alerts',
    headers := jsonb_build_object(
        'Authorization', 
        'Bearer ' || current_setting('app.service_role')
    )
) as request_id;
```

#### Job 2: Webhook Queue Processing (jede Minute)
```
Name:     process-webhook-queue
Schedule: * * * * *
Command:
SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-webhook-queue',
    headers := jsonb_build_object(
        'Authorization', 
        'Bearer ' || current_setting('app.service_role')
    )
) as request_id;
```

#### Job 3: Certificate Scan (alle 6 Stunden)
```
Name:     scan-certificates
Schedule: 0 */6 * * *
Command:
SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scan-certificates',
    headers := jsonb_build_object(
        'Authorization', 
        'Bearer ' || current_setting('app.service_role')
    )
) as request_id;
```

#### Job 4: Cleanup (täglich um 3 Uhr)
```
Name:     cleanup-webhook-deliveries
Schedule: 0 3 * * *
Command:
SELECT cleanup_old_webhook_deliveries();
```

### 4. Umgebungsvariablen setzen (Supabase Dashboard)

Gehe zu: **Settings → API → Project Settings**

Füge folgende Secrets hinzu:

```bash
# Diese sind bereits vorhanden:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Optional: Für SMTP (Worker)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASSWORD=xxx
```

## 🎯 Nutzung über die UI

### Webhook konfigurieren

1. Gehe zu **Integrationen → Webhook**
2. Fülle die Felder aus:
   - **URL**: `https://your-api.com/webhook/alerts`
   - **Secret**: Klicke auf "Zufälliges Secret generieren"
   - **Timeout**: 5 Sekunden (Standard)
   - **Retry-Versuche**: 3 (Standard)
3. Klicke auf **"Test senden"** zum Testen
4. Klicke auf **"Webhook speichern"**

**Fertig!** 🎉 Das System beginnt automatisch mit dem Versand von Webhooks.

### Webhook-Logs überwachen

Gehe zu: **Webhook Logs**

Hier siehst du:
- ✅ Erfolgreiche Deliveries
- ❌ Fehlgeschlagene Deliveries
- 🔄 Laufende Retries
- ⏳ Pending Deliveries
- 📊 Success Rate & Statistiken

## 🔒 Sicherheit

### Webhook-Signatur verifizieren (Server-Seite)

**Node.js Beispiel:**
```javascript
const crypto = require('crypto');

app.post('/webhook/alerts', (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-signature-timestamp'];
    const secret = process.env.WEBHOOK_SECRET;
    
    // Berechne erwartete Signatur
    const payload = JSON.stringify(req.body);
    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    
    // Vergleiche Signaturen
    const receivedSig = signature.replace('sha256=', '');
    
    if (expectedSig !== receivedSig) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Signatur ist gültig - verarbeite Webhook
    const { event, certificate, severity } = req.body;
    
    console.log(`🔔 Alert: ${certificate.subject_cn} expires in ${certificate.days_left} days`);
    
    res.status(200).json({ success: true });
});
```

**Python Beispiel:**
```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = 'your-secret-here'

@app.route('/webhook/alerts', methods=['POST'])
def webhook_handler():
    signature = request.headers.get('X-Webhook-Signature', '')
    payload = request.get_data(as_text=True)
    
    # Berechne erwartete Signatur
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Vergleiche Signaturen
    received_sig = signature.replace('sha256=', '')
    
    if not hmac.compare_digest(expected_sig, received_sig):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Signatur ist gültig - verarbeite Webhook
    data = request.json
    print(f"🔔 Alert: {data['certificate']['subject_cn']} expires in {data['certificate']['days_left']} days")
    
    return jsonify({'success': True})
```

## 📊 Webhook Payload Format

```json
{
  "event": "certificate.expiring",
  "tenant_id": "uuid",
  "certificate": {
    "id": "uuid",
    "subject_cn": "example.com",
    "issuer": "Let's Encrypt",
    "expires_at": "2025-12-31T23:59:59Z",
    "days_left": 14,
    "fingerprint": "sha256:abcd..."
  },
  "severity": "warning",
  "alert_level": "warning",
  "alert_id": "uuid",
  "first_triggered_at": "2025-10-18T10:00:00Z",
  "timestamp": "2025-10-18T12:00:00Z"
}
```

### Headers
```
Content-Type: application/json
User-Agent: Zertifikat-Waechter/1.0
X-Webhook-Event: certificate.expiring
X-Webhook-Signature: sha256=<hmac_hex>
X-Webhook-Signature-Timestamp: 2025-10-18T12:00:00Z
X-Webhook-Attempt: 1
```

## 🔄 Retry-Logik

Das System nutzt **Exponential Backoff**:

| Versuch | Wartezeit |
|---------|-----------|
| 1       | Sofort    |
| 2       | 2 Minuten |
| 3       | 4 Minuten |
| 4+      | 8+ Minuten|

**Max. Versuche**: Konfigurierbar (Standard: 3)

Nach allen Versuchen wird der Webhook als `failed` markiert.

## 🧪 Lokales Testen

### Test-Webhook-Server starten

```bash
# Dependencies installieren
npm install express body-parser

# Server starten
node test-webhook-server.js
```

Server läuft auf: `http://localhost:3333/webhook`

### In der UI testen

1. Gehe zu **Integrationen → Webhook**
2. URL: `http://localhost:3333/webhook`
3. Secret: `test-secret-12345` (optional)
4. Klicke auf **"Test senden"**
5. Prüfe die Konsole des Test-Servers

## 📈 Monitoring

### Metriken

Die Webhook-Logs zeigen:
- **Total Deliveries**: Gesamtanzahl
- **Success Rate**: Prozentsatz erfolgreicher Deliveries
- **Failed**: Anzahl fehlgeschlagener Deliveries
- **Retrying**: Aktuell laufende Retries

### Alerts bei Problemen

Wenn > 50% der Webhooks fehlschlagen:
1. Prüfe die **Webhook-Logs**
2. Validiere die **Webhook-URL**
3. Teste die **Signatur-Verifizierung**
4. Prüfe **Firewall-Regeln**

## 🛠️ Troubleshooting

### Problem: Webhooks werden nicht versendet

**Lösung:**
1. Prüfe ob Cron-Job `process-webhook-queue` läuft:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-webhook-queue';
   ```
2. Prüfe Edge Function Logs in Supabase Dashboard
3. Prüfe `webhook_deliveries` Tabelle:
   ```sql
   SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT 10;
   ```

### Problem: Alle Webhooks schlagen fehl

**Lösung:**
1. Teste Webhook-URL manuell mit `curl`:
   ```bash
   curl -X POST https://your-webhook-url \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
2. Prüfe Firewall-Regeln
3. Validiere SSL-Zertifikat der Webhook-URL

### Problem: Signatur-Validierung schlägt fehl

**Lösung:**
1. Stelle sicher, dass das gleiche Secret verwendet wird
2. Payload muss **exakt** wie empfangen verwendet werden
3. Keine JSON-Umformatierung vor Signatur-Prüfung!

## 📚 Weitere Ressourcen

- **Webhook Best Practices**: https://webhooks.fyi/best-practices/
- **HMAC Signature Guide**: https://www.okta.com/identity-101/hmac/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **pg_cron Documentation**: https://github.com/citusdata/pg_cron

## ✅ Checkliste für Produktion

- [ ] Migrationen ausgeführt (00021, 00022)
- [ ] Edge Functions deployed (send-webhook, send-alerts, process-webhook-queue)
- [ ] Cron-Jobs eingerichtet (4 Jobs)
- [ ] Webhook in UI konfiguriert und getestet
- [ ] Webhook-Server implementiert mit Signatur-Validierung
- [ ] Monitoring & Logs geprüft
- [ ] Firewall-Regeln konfiguriert (falls erforderlich)
- [ ] Rate Limits geprüft (Supabase Plan)
- [ ] Backup-Strategie definiert
- [ ] Alerting bei Webhook-Fehlern eingerichtet

---

**Support:** Bei Problemen prüfe die Webhook-Logs in der UI oder die Supabase Edge Function Logs im Dashboard.

**Happy Webhook Monitoring! 🚀🔔**

