# 🚀 Ubuntu Server Deployment - Komplettanleitung

## 📋 Überblick

Diese Anleitung zeigt dir, wie du **Zertifikat-Wächter** auf einem Ubuntu 20.04/22.04 Server deployest.

### Was wird installiert?

- ✅ **Nginx** - Webserver & Reverse Proxy
- ✅ **Python Worker** - Backend API (Port 5000)
- ✅ **React Frontend** - SPA Build (via Nginx)
- ✅ **Let's Encrypt SSL** - Automatische HTTPS-Zertifikate
- ✅ **Systemd Services** - Automatischer Start beim Booten

## 🎯 Voraussetzungen

### Server Requirements

- Ubuntu 20.04 LTS oder 22.04 LTS
- Mindestens 2 GB RAM
- 20 GB freier Speicher
- Root-Zugriff
- Öffentliche IP-Adresse
- Domain mit DNS-Eintrag (A-Record zu deiner Server-IP)

### Was du brauchst

1. **Supabase Project** (erstellt auf https://supabase.com)
2. **Domain** (z.B. `certwatch.your-domain.com`)
3. **SSH-Zugang** zu deinem Ubuntu Server

## 📝 Deployment-Schritte

### Schritt 1: Projekt auf den Server kopieren

```bash
# Auf deinem lokalen Rechner:
# Projekt als ZIP exportieren
cd "C:\Users\NGJARUIZ\OneDrive - GASAG\Redirected\Desktop\Jaciel Antonio Acea Ruiz"
tar -czf zertifikat-waechter.tar.gz Zertifikat-Wächter/

# Auf den Server kopieren (via SCP)
scp zertifikat-waechter.tar.gz root@your-server-ip:/tmp/

# Oder via Git (wenn in einem Repo):
# git clone https://github.com/yourusername/zertifikat-waechter.git
```

### Schritt 2: Auf dem Server einloggen

```bash
ssh root@your-server-ip
```

### Schritt 3: Projekt entpacken

```bash
cd /opt
tar -xzf /tmp/zertifikat-waechter.tar.gz
mv Zertifikat-Wächter zertifikat-waechter
cd zertifikat-waechter
```

### Schritt 4: Deploy-Script ausführbar machen

```bash
chmod +x deploy-ubuntu.sh
chmod +x start-production.sh
```

### Schritt 5: Domain in Config anpassen

```bash
# Öffne deploy-ubuntu.sh und ändere die Domain
nano deploy-ubuntu.sh

# Ändere diese Zeile (ca. Zeile 23):
DOMAIN="your-domain.com"  # ← Deine Domain eintragen!

# Speichern: Ctrl+O, Enter, Ctrl+X
```

### Schritt 6: Deploy-Script ausführen

```bash
sudo ./deploy-ubuntu.sh
```

Das Script wird:
- System updaten
- Dependencies installieren (Nginx, Python, Node.js)
- Frontend bauen
- Worker einrichten
- Nginx konfigurieren
- Systemd Services erstellen

**Dauer: ca. 5-10 Minuten**

### Schritt 7: Environment Variables konfigurieren

```bash
# Kopiere Template
cp .env.production.example .env.production

# Bearbeite die Datei
nano .env.production
```

Fülle aus:
```bash
# Supabase (von supabase.com Dashboard)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# SMTP (z.B. Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@your-domain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=alerts@your-domain.com

# Security
SECRET_KEY=$(openssl rand -hex 32)
```

**Speichern**: Ctrl+O, Enter, Ctrl+X

### Schritt 8: DNS-Eintrag prüfen

Stelle sicher, dass deine Domain auf die Server-IP zeigt:

```bash
# Prüfe DNS
nslookup your-domain.com

# Sollte deine Server-IP anzeigen
```

### Schritt 9: SSL-Zertifikat installieren

```bash
# Let's Encrypt SSL-Zertifikat holen
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Folge den Anweisungen:
# 1. E-Mail eingeben
# 2. Terms akzeptieren
# 3. Redirect zu HTTPS: Ja
```

**Hinweis**: DNS muss bereits funktionieren!

### Schritt 10: Services starten

```bash
# Starte alle Services
sudo ./start-production.sh

# Oder manuell:
sudo systemctl start zertifikat-waechter-worker
sudo systemctl start nginx
```

### Schritt 11: Funktionstest

```bash
# Worker API Test
curl http://localhost:5000/health

# Sollte antworten: {"status": "ok"}

# Nginx Test
curl -I https://your-domain.com

# Sollte 200 OK zurückgeben
```

### Schritt 12: Im Browser öffnen

Öffne: `https://your-domain.com`

Du solltest das Login sehen! 🎉

## 🔄 Supabase Cron-Jobs einrichten

**WICHTIG**: Siehe `WEBHOOK-PRODUKTION-SETUP.md` → Abschnitt "Cron-Jobs einrichten"

Im Supabase Dashboard:
1. Gehe zu **Database → Cron Jobs**
2. Erstelle die 4 Jobs (Alert Processing, Webhook Queue, Certificate Scan, Cleanup)

## 📊 Monitoring & Logs

### Service Status prüfen

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

### Health Checks

```bash
# Worker Health
curl http://localhost:5000/health

# Frontend Health
curl -I https://your-domain.com
```

## 🔧 Wartung

### Services neu starten

```bash
# Worker neu starten
sudo systemctl restart zertifikat-waechter-worker

# Nginx neu starten
sudo systemctl restart nginx

# Alle neu starten
sudo ./start-production.sh
```

### Code-Updates deployen

```bash
cd /opt/zertifikat-waechter

# Code aktualisieren (via Git)
git pull

# Frontend neu bauen
cd frontend
npm install
npm run build

# Worker neu starten
sudo systemctl restart zertifikat-waechter-worker

# Nginx neu laden
sudo systemctl reload nginx
```

### Logs rotieren

Logs werden automatisch rotiert. Config prüfen:
```bash
cat /etc/logrotate.d/zertifikat-waechter
```

### Backup erstellen

```bash
# Datenbank (Supabase macht automatische Backups)
# Environment Variables sichern
sudo cp /opt/zertifikat-waechter/.env.production /backup/

# Optional: Ganzes Projekt
sudo tar -czf /backup/zertifikat-waechter-$(date +%Y%m%d).tar.gz /opt/zertifikat-waechter
```

## 🛡️ Sicherheit

### Firewall einrichten

```bash
# UFW aktivieren
sudo ufw enable

# Erlaube SSH
sudo ufw allow 22/tcp

# Erlaube HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Status prüfen
sudo ufw status
```

### Fail2Ban installieren (DDoS-Schutz)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### SSL-Zertifikat Auto-Renewal testen

```bash
# Test ob Renewal funktioniert
sudo certbot renew --dry-run

# Certbot erneuert automatisch alle 60 Tage
```

## 🚨 Troubleshooting

### Problem: Worker startet nicht

```bash
# Logs prüfen
sudo journalctl -u zertifikat-waechter-worker -n 50

# Häufige Ursachen:
# 1. Python-Fehler → Prüfe requirements.txt
# 2. Port belegt → sudo netstat -tulpn | grep 5000
# 3. Environment fehlt → Prüfe .env.production
```

### Problem: Nginx 502 Bad Gateway

```bash
# Prüfe ob Worker läuft
sudo systemctl status zertifikat-waechter-worker

# Prüfe Worker direkt
curl http://localhost:5000/health

# Nginx Logs
sudo tail -f /var/log/nginx/zertifikat-waechter-error.log
```

### Problem: Frontend zeigt nur weißen Bildschirm

```bash
# Prüfe ob Build existiert
ls -la /opt/zertifikat-waechter/frontend/dist/

# Falls nicht: Neu bauen
cd /opt/zertifikat-waechter/frontend
npm run build

# Browser-Cache leeren (Strg+F5)
```

### Problem: SSL-Zertifikat Fehler

```bash
# Zertifikat erneuern
sudo certbot renew --force-renewal

# Nginx neu starten
sudo systemctl restart nginx
```

## 📈 Performance-Optimierung

### Worker mit Gunicorn (statt Flask dev server)

```bash
# Installiere Gunicorn
cd /opt/zertifikat-waechter/worker
source venv/bin/activate
pip install gunicorn

# Ändere systemd service
sudo nano /etc/systemd/system/zertifikat-waechter-worker.service

# Ändere ExecStart zu:
ExecStart=/opt/zertifikat-waechter/worker/venv/bin/gunicorn \
    --bind 127.0.0.1:5000 \
    --workers 4 \
    --timeout 60 \
    --access-logfile /var/log/zertifikat-waechter/gunicorn-access.log \
    --error-logfile /var/log/zertifikat-waechter/gunicorn-error.log \
    api:app

# Service neu laden
sudo systemctl daemon-reload
sudo systemctl restart zertifikat-waechter-worker
```

### Nginx Caching aktivieren

```bash
# In /etc/nginx/sites-available/zertifikat-waechter hinzufügen:
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

# In location /api/ block:
proxy_cache api_cache;
proxy_cache_valid 200 5m;
proxy_cache_use_stale error timeout invalid_header updating;
```

## ✅ Checkliste Deployment

- [ ] Ubuntu Server bereit (min. 2GB RAM)
- [ ] Domain registriert und DNS konfiguriert
- [ ] Supabase Projekt erstellt
- [ ] Projekt auf Server kopiert
- [ ] `deploy-ubuntu.sh` ausgeführt
- [ ] `.env.production` konfiguriert
- [ ] SSL-Zertifikat installiert (`certbot`)
- [ ] Services gestartet
- [ ] Supabase Cron-Jobs eingerichtet
- [ ] Firewall konfiguriert (`ufw`)
- [ ] Funktionstest durchgeführt
- [ ] Backup-Strategie definiert
- [ ] Monitoring eingerichtet

## 🎉 Fertig!

Deine SaaS-Anwendung läuft jetzt produktiv auf Ubuntu!

**Support**: Bei Problemen prüfe die Logs oder öffne ein Issue.

**Happy Monitoring! 🛡️🚀**

