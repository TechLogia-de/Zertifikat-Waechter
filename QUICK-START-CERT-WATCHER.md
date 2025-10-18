# 🚀 Quick Start - cert-watcher.de Deployment

## ✅ Voraussetzungen

- ✅ Ubuntu 20.04/22.04 Server
- ✅ Root-Zugriff
- ✅ Domain: **cert-watcher.de** (bereits registriert)
- ✅ Server-IP-Adresse notiert

## 📋 Deployment in 4 Schritten

### Schritt 1: DNS konfigurieren

In deinem Domain-Provider (z.B. Strato, Hetzner, Cloudflare):

```
Typ:  A
Name: @
Wert: <DEINE-SERVER-IP>
TTL:  300

Typ:  A  
Name: www
Wert: <DEINE-SERVER-IP>
TTL:  300
```

**Warten:** 5-30 Minuten bis DNS propagiert ist

**Prüfen:**
```bash
nslookup cert-watcher.de
# Sollte deine Server-IP anzeigen
```

### Schritt 2: Projekt auf Server laden & Deploy starten

**Auf dem Server:**
```bash
# Projekt klonen
cd /opt
git clone https://github.com/TechLogia-de/Zertifikat-Waechter.git zertifikat-waechter
cd zertifikat-waechter

# Scripts ausführbar machen
chmod +x deploy-ubuntu.sh
chmod +x start-production.sh

# Deploy direkt starten
sudo ./deploy-ubuntu.sh
```

**Das Script erkennt automatisch:**
- ✅ Wird im Projekt-Verzeichnis ausgeführt → Nutzt aktuelles Verzeichnis
- ✅ Projekt ist bereits in `/opt/zertifikat-waechter` → Aktualisiert es
- ✅ Projekt existiert nicht → Klont von GitHub

**Das Script installiert:**
- ✅ Nginx Webserver
- ✅ Python 3 & Dependencies
- ✅ Node.js 20 LTS
- ✅ Frontend Build
- ✅ Worker Setup
- ✅ Systemd Services

**Dauer:** ca. 5-10 Minuten

### Schritt 3: Environment Variables

```bash
# Kopiere Template
cp .env.production.example .env.production

# Bearbeiten
nano .env.production
```

**Wichtige Werte eintragen:**

```bash
# === Supabase (von https://supabase.com Dashboard) ===
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# === SMTP (z.B. Gmail) ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@cert-watcher.de
SMTP_PASSWORD=<APP-PASSWORD>
SMTP_FROM=alerts@cert-watcher.de

# === Security ===
SECRET_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://cert-watcher.de

# === Worker ===
WORKER_HOST=127.0.0.1
WORKER_PORT=5000
WORKER_WORKERS=4

# === Logging ===
LOG_LEVEL=INFO
```

**Speichern:** Ctrl+O, Enter, Ctrl+X

### Schritt 4: SSL & Services starten

```bash
# Prüfe DNS (muss funktionieren!)
nslookup cert-watcher.de

# SSL-Zertifikat installieren
sudo certbot --nginx -d cert-watcher.de -d www.cert-watcher.de

# Folge den Anweisungen:
# 1. E-Mail eingeben
# 2. Terms akzeptieren  
# 3. Redirect zu HTTPS: Ja (empfohlen)

# Services starten
sudo ./start-production.sh
```

### ✅ Fertig!

Öffne im Browser: **https://cert-watcher.de**

Du solltest den Login-Screen sehen! 🎉

## 🔐 Supabase Konfiguration

### Wichtig: RLS Policies & Cron-Jobs

1. **Migrationen in Supabase ausführen:**
   ```bash
   cd supabase
   
   # Supabase CLI installieren (falls nicht vorhanden)
   npm install -g supabase
   
   # Mit Projekt verbinden
   supabase link --project-ref <DEINE-PROJECT-REF>
   
   # Migrationen pushen
   supabase db push
   ```

2. **Cron-Jobs einrichten** (Supabase Dashboard):
   
   Gehe zu: **Database → Cron Jobs** und erstelle:

   **Job 1: Alert Processing (alle 5 Minuten)**
   ```
   Name: process-alerts
   Schedule: */5 * * * *
   Command: SELECT net.http_post(
       url := current_setting('app.supabase_url') || '/functions/v1/send-alerts',
       headers := jsonb_build_object(
           'Authorization', 
           'Bearer ' || current_setting('app.service_role')
       )
   ) as request_id;
   ```

   **Job 2: Webhook Queue (jede Minute)**
   ```
   Name: process-webhook-queue
   Schedule: * * * * *
   Command: SELECT net.http_post(
       url := current_setting('app.supabase_url') || '/functions/v1/process-webhook-queue',
       headers := jsonb_build_object(
           'Authorization',
           'Bearer ' || current_setting('app.service_role')
       )
   ) as request_id;
   ```

   **Job 3: Certificate Scan (alle 6 Stunden)**
   ```
   Name: scan-certificates
   Schedule: 0 */6 * * *
   Command: SELECT net.http_post(
       url := current_setting('app.supabase_url') || '/functions/v1/scan-certificates',
       headers := jsonb_build_object(
           'Authorization',
           'Bearer ' || current_setting('app.service_role')
       )
   ) as request_id;
   ```

   **Job 4: Cleanup (täglich 3 Uhr)**
   ```
   Name: cleanup-webhook-deliveries
   Schedule: 0 3 * * *
   Command: SELECT cleanup_old_webhook_deliveries();
   ```

## 🔥 Firewall einrichten

```bash
# UFW aktivieren
sudo ufw enable

# SSH erlauben
sudo ufw allow 22/tcp

# HTTP/HTTPS erlauben
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Status prüfen
sudo ufw status
```

## 📊 Services verwalten

### Status prüfen
```bash
# Worker Status
sudo systemctl status zertifikat-waechter-worker

# Nginx Status
sudo systemctl status nginx
```

### Logs anschauen
```bash
# Worker Logs (Live)
sudo journalctl -u zertifikat-waechter-worker -f

# Nginx Access Log
sudo tail -f /var/log/nginx/zertifikat-waechter-access.log

# Nginx Error Log
sudo tail -f /var/log/nginx/zertifikat-waechter-error.log
```

### Services neu starten
```bash
# Worker neu starten
sudo systemctl restart zertifikat-waechter-worker

# Nginx neu starten
sudo systemctl restart nginx

# Oder alle auf einmal
sudo ./start-production.sh
```

## 🔄 Code-Updates deployen

```bash
cd /opt/zertifikat-waechter

# Neuesten Code pullen
git pull

# Frontend neu bauen
cd frontend
npm install
npm run build

# Worker neu starten
sudo systemctl restart zertifikat-waechter-worker

# Nginx neu laden (ohne Downtime)
sudo systemctl reload nginx
```

## 🆘 Troubleshooting

### Problem: DNS funktioniert nicht
```bash
# Prüfen
nslookup cert-watcher.de

# Wenn keine IP zurückkommt:
# → DNS noch nicht propagiert (warten)
# → DNS falsch konfiguriert (Provider prüfen)
```

### Problem: SSL-Zertifikat Fehler
```bash
# DNS muss ZUERST funktionieren!
# Dann erneut versuchen:
sudo certbot --nginx -d cert-watcher.de -d www.cert-watcher.de --force-renewal
```

### Problem: Worker startet nicht
```bash
# Logs prüfen
sudo journalctl -u zertifikat-waechter-worker -n 50

# Häufige Ursachen:
# → .env.production fehlt oder falsch
# → Python-Dependencies fehlen
# → Port 5000 bereits belegt
```

### Problem: 502 Bad Gateway
```bash
# Prüfe ob Worker läuft
sudo systemctl status zertifikat-waechter-worker

# Worker direkt testen
curl http://localhost:5000/health

# Sollte zurückgeben: {"status":"ok"}
```

## ✅ Checkliste

- [ ] Ubuntu Server bereit
- [ ] DNS A-Records konfiguriert für cert-watcher.de
- [ ] DNS propagiert (nslookup funktioniert)
- [ ] Projekt auf Server geklont
- [ ] deploy-ubuntu.sh ausgeführt
- [ ] .env.production konfiguriert
- [ ] Supabase Migrationen gepusht
- [ ] Supabase Cron-Jobs eingerichtet
- [ ] SSL-Zertifikat installiert (certbot)
- [ ] Services gestartet
- [ ] Firewall konfiguriert (ufw)
- [ ] Login in Browser funktioniert
- [ ] Erster User angelegt

## 🎉 Nächste Schritte

1. **Ersten User anlegen:**
   - Öffne https://cert-watcher.de
   - Klicke "Sign Up"
   - Bestätige E-Mail (Supabase Auth)

2. **Erste Domain scannen:**
   - Login
   - Dashboard → "Domain hinzufügen"
   - Gib Domain ein (z.B. google.com)
   - Scan starten

3. **Integrationen einrichten:**
   - Integrationen → SMTP konfigurieren
   - Integrationen → Webhook konfigurieren
   - Alert-Regeln definieren

4. **Backup-Strategie:**
   - Supabase macht automatische DB-Backups
   - .env.production sichern
   - Optional: Projekt-Backup

## 📚 Weitere Dokumentation

- Detaillierte Anleitung: `UBUNTU-DEPLOYMENT.md`
- Webhook-Setup: `WEBHOOK-PRODUKTION-SETUP.md`
- Architektur: `DEPLOYMENT-ÜBERSICHT.md`

## 🆘 Support

Bei Problemen:
1. Logs prüfen (siehe oben)
2. GitHub Issues: https://github.com/TechLogia-de/Zertifikat-Waechter/issues
3. Dokumentation durchlesen

---

**Viel Erfolg mit cert-watcher.de! 🛡️🚀**

*SSL/TLS Monitoring made easy*

