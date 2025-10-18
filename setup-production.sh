#!/bin/bash

##############################################
# Zertifikat-Wächter - Vollautomatisches Setup
##############################################

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${CYAN}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🛡️  Zertifikat-Wächter                                  ║
║   Vollautomatisches Produktions-Setup                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

# Prüfe Root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Bitte als root ausführen: sudo ./setup-production.sh${NC}"
    exit 1
fi

# Variablen
APP_DIR="/opt/zertifikat-waechter"
CURRENT_DIR=$(pwd)

echo -e "${GREEN}Willkommen beim automatischen Setup!${NC}"
echo -e "${YELLOW}Ich werde dich durch alle Schritte führen.${NC}"
echo ""
echo "Drücke Ctrl+C zum Abbrechen"
echo ""
read -p "Drücke Enter zum Starten..." 

# =====================================================
# SCHRITT 1: Daten abfragen
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 1: Konfigurationsdaten${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Domain
echo -e "${YELLOW}🌐 Domain-Konfiguration${NC}"
echo ""
read -p "Domain (ohne www): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="cert-watcher.de"
    echo -e "${YELLOW}→ Verwende Standard: $DOMAIN${NC}"
fi

# E-Mail für Let's Encrypt
echo ""
read -p "Deine E-Mail (für SSL-Zertifikate): " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    echo -e "${RED}❌ E-Mail ist erforderlich!${NC}"
    exit 1
fi

# Supabase
echo ""
echo -e "${YELLOW}🗄️  Supabase-Konfiguration${NC}"
echo "   (Hole diese Werte von: https://supabase.com/dashboard)"
echo ""
read -p "Supabase URL (https://xxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Alle Supabase-Felder sind erforderlich!${NC}"
    exit 1
fi

# SMTP
echo ""
echo -e "${YELLOW}📧 SMTP-Konfiguration (für E-Mail-Alerts)${NC}"
echo ""
read -p "SMTP Host (z.B. smtp.gmail.com): " SMTP_HOST
read -p "SMTP Port (Standard 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}
read -p "SMTP User/E-Mail: " SMTP_USER
read -sp "SMTP Passwort: " SMTP_PASSWORD
echo ""
read -p "Absender-E-Mail (From): " SMTP_FROM

if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASSWORD" ] || [ -z "$SMTP_FROM" ]; then
    echo -e "${YELLOW}⚠️  SMTP-Konfiguration übersprungen (kann später in .env.production hinzugefügt werden)${NC}"
    SMTP_ENABLED=false
else
    SMTP_ENABLED=true
fi

# Worker-Konfiguration
echo ""
echo -e "${YELLOW}⚙️  Worker-Konfiguration${NC}"
echo ""
read -p "Anzahl Worker-Prozesse (Standard 4): " WORKER_COUNT
WORKER_COUNT=${WORKER_COUNT:-4}

# Zusammenfassung
clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Zusammenfassung${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Domain:${NC}             $DOMAIN"
echo -e "${GREEN}Admin E-Mail:${NC}       $ADMIN_EMAIL"
echo -e "${GREEN}Supabase URL:${NC}       $SUPABASE_URL"
echo -e "${GREEN}SMTP Host:${NC}          ${SMTP_HOST:-'(nicht konfiguriert)'}"
echo -e "${GREEN}Worker Prozesse:${NC}    $WORKER_COUNT"
echo ""
echo -e "${YELLOW}Installation wird nach /opt/zertifikat-waechter erfolgen${NC}"
echo ""
read -p "Alles korrekt? Fortfahren? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Abgebrochen.${NC}"
    exit 0
fi

# =====================================================
# SCHRITT 2: System vorbereiten
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 2: System vorbereiten${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}[1/3] System Update...${NC}"
apt update -qq
apt upgrade -y -qq

echo -e "${YELLOW}[2/3] Installiere Dependencies...${NC}"
apt install -y -qq nginx python3 python3-pip python3-venv nodejs npm git curl certbot python3-certbot-nginx

echo -e "${YELLOW}[3/3] Prüfe Node.js Version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Installiere Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

echo -e "${GREEN}✅ System bereit${NC}"
sleep 1

# =====================================================
# SCHRITT 3: Projekt laden
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 3: Projekt laden${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$CURRENT_DIR/deploy-ubuntu.sh" ] && [ -d "$CURRENT_DIR/frontend" ]; then
    echo -e "${GREEN}✅ Script läuft im Projekt-Verzeichnis${NC}"
    
    if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
        echo -e "${YELLOW}Kopiere nach $APP_DIR...${NC}"
        mkdir -p /opt
        cp -r "$CURRENT_DIR" "$APP_DIR"
        cd $APP_DIR
    fi
else
    if [ -d "$APP_DIR" ]; then
        echo -e "${YELLOW}Projekt existiert. Aktualisiere...${NC}"
        cd $APP_DIR
        git pull
    else
        echo -e "${YELLOW}Clone von GitHub...${NC}"
        cd /opt
        git clone https://github.com/TechLogia-de/Zertifikat-Waechter.git zertifikat-waechter
        cd $APP_DIR
    fi
fi

echo -e "${GREEN}✅ Projekt bereit in: $APP_DIR${NC}"
sleep 1

# =====================================================
# SCHRITT 4: Environment-Datei erstellen
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 4: Erstelle .env.production${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Secret Key generieren
SECRET_KEY=$(openssl rand -hex 32)

cat > $APP_DIR/.env.production <<ENVEOF
# =====================================================
# Zertifikat-Wächter - Production Environment
# Automatisch generiert: $(date)
# =====================================================

# Supabase Configuration
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# SMTP Configuration
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASSWORD
SMTP_FROM=$SMTP_FROM

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=$SECRET_KEY

# Worker Configuration
WORKER_HOST=127.0.0.1
WORKER_PORT=5000
WORKER_WORKERS=$WORKER_COUNT

# Security
ALLOWED_ORIGINS=https://$DOMAIN

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/zertifikat-waechter/worker.log
ENVEOF

chmod 600 $APP_DIR/.env.production
chown www-data:www-data $APP_DIR/.env.production

echo -e "${GREEN}✅ .env.production erstellt${NC}"
sleep 1

# =====================================================
# SCHRITT 5: Frontend bauen
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 5: Baue Frontend${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

cd $APP_DIR/frontend

# Erstelle .env für Frontend-Build (WICHTIG!)
echo -e "${YELLOW}Erstelle Frontend .env...${NC}"
cat > .env <<FRONTENDENVEOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
FRONTENDENVEOF

echo -e "${YELLOW}Installing npm packages...${NC}"
npm install --silent --no-progress > /dev/null 2>&1
echo -e "${YELLOW}Building React app...${NC}"
npm run build

echo -e "${GREEN}✅ Frontend gebaut (mit Supabase-Config)${NC}"
sleep 1

# =====================================================
# SCHRITT 6: Worker einrichten
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 6: Worker einrichten${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

cd $APP_DIR/worker

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Erstelle Python Virtual Environment...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate
echo -e "${YELLOW}Installing Python packages...${NC}"
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo -e "${GREEN}✅ Worker bereit${NC}"
sleep 1

# =====================================================
# SCHRITT 7: Nginx konfigurieren
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 7: Nginx konfigurieren${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

mkdir -p /var/www/certbot
mkdir -p /var/log/zertifikat-waechter

cat > /etc/nginx/sites-available/zertifikat-waechter <<'NGINXEOF'
# Zertifikat-Wächter Nginx Configuration

# Rate Limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/s;

upstream worker_api {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    # Let's Encrypt Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Frontend (React Build)
    root /opt/zertifikat-waechter/frontend/dist;
    index index.html;

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
        limit_req zone=general_limit burst=20 nodelay;
    }

    # Worker API Proxy
    location /api/ {
        limit_req zone=api_limit burst=5 nodelay;
        
        proxy_pass http://worker_api/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health Check (nicht rate-limited)
    location /api/health {
        proxy_pass http://worker_api/health;
        access_log off;
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Logs
    access_log /var/log/nginx/zertifikat-waechter-access.log;
    error_log /var/log/nginx/zertifikat-waechter-error.log;
}
NGINXEOF

# Ersetze Domain-Placeholder
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/zertifikat-waechter

# Aktiviere Site
ln -sf /etc/nginx/sites-available/zertifikat-waechter /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t

echo -e "${GREEN}✅ Nginx konfiguriert${NC}"
sleep 1

# =====================================================
# SCHRITT 8: Systemd Services
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 8: Systemd Services${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

cat > /etc/systemd/system/zertifikat-waechter-worker.service <<SERVICEEOF
[Unit]
Description=Zertifikat-Wächter Worker API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/worker
Environment="PATH=$APP_DIR/worker/venv/bin"
EnvironmentFile=$APP_DIR/.env.production
ExecStart=$APP_DIR/worker/venv/bin/python api.py

# Restart Policy
Restart=always
RestartSec=10

# Limits
LimitNOFILE=65536

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zw-worker

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable zertifikat-waechter-worker
systemctl enable nginx

echo -e "${GREEN}✅ Services konfiguriert${NC}"
sleep 1

# =====================================================
# SCHRITT 9: DNS prüfen
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 9: DNS-Prüfung${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Prüfe DNS für $DOMAIN...${NC}"
echo ""

DNS_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | tail -n1 | awk '{print $2}')
SERVER_IP=$(curl -s ifconfig.me)

echo "DNS zeigt auf:    $DNS_IP"
echo "Server-IP ist:    $SERVER_IP"
echo ""

if [ "$DNS_IP" = "$SERVER_IP" ]; then
    echo -e "${GREEN}✅ DNS korrekt konfiguriert!${NC}"
    DNS_OK=true
else
    echo -e "${RED}⚠️  DNS stimmt nicht überein!${NC}"
    echo ""
    echo "Bitte konfiguriere deinen DNS A-Record:"
    echo "  Typ:  A"
    echo "  Name: @"
    echo "  Wert: $SERVER_IP"
    echo ""
    read -p "DNS später konfigurieren und SSL überspringen? (y/n): " SKIP_SSL
    if [ "$SKIP_SSL" = "y" ] || [ "$SKIP_SSL" = "Y" ]; then
        DNS_OK=false
    else
        echo -e "${RED}Abgebrochen. Bitte DNS konfigurieren und neu starten.${NC}"
        exit 1
    fi
fi

sleep 1

# =====================================================
# SCHRITT 10: SSL-Zertifikat installieren
# =====================================================

if [ "$DNS_OK" = true ]; then
    clear
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  SCHRITT 10: SSL-Zertifikat installieren${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${YELLOW}Installiere Let's Encrypt SSL-Zertifikat...${NC}"
    echo ""

    certbot --nginx \
        -d $DOMAIN \
        -d www.$DOMAIN \
        --non-interactive \
        --agree-tos \
        --email $ADMIN_EMAIL \
        --redirect

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL-Zertifikat erfolgreich installiert!${NC}"
        echo -e "${GREEN}   Auto-Renewal wurde eingerichtet.${NC}"
        SSL_INSTALLED=true
    else
        echo -e "${RED}❌ SSL-Installation fehlgeschlagen${NC}"
        echo -e "${YELLOW}   App läuft trotzdem auf HTTP${NC}"
        SSL_INSTALLED=false
    fi
else
    echo -e "${YELLOW}⚠️  SSL-Installation übersprungen (DNS nicht bereit)${NC}"
    echo -e "${YELLOW}   Du kannst SSL später installieren mit:${NC}"
    echo -e "${YELLOW}   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN${NC}"
    SSL_INSTALLED=false
fi

sleep 2

# =====================================================
# SCHRITT 11: Services starten
# =====================================================

clear
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SCHRITT 11: Services starten${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Starte Worker...${NC}"
systemctl start zertifikat-waechter-worker
sleep 2

if systemctl is-active --quiet zertifikat-waechter-worker; then
    echo -e "${GREEN}✅ Worker läuft${NC}"
else
    echo -e "${RED}❌ Worker konnte nicht gestartet werden${NC}"
    journalctl -u zertifikat-waechter-worker -n 20 --no-pager
fi

echo -e "${YELLOW}Starte Nginx...${NC}"
systemctl restart nginx

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx läuft${NC}"
else
    echo -e "${RED}❌ Nginx konnte nicht gestartet werden${NC}"
fi

sleep 1

# =====================================================
# FERTIG!
# =====================================================

clear
echo -e "${GREEN}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎉 INSTALLATION ERFOLGREICH ABGESCHLOSSEN! 🎉           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

if [ "$SSL_INSTALLED" = true ]; then
    APP_URL="https://$DOMAIN"
    echo -e "${GREEN}✅ Deine App läuft jetzt auf: ${CYAN}$APP_URL${NC}"
else
    APP_URL="http://$DOMAIN"
    echo -e "${YELLOW}⚠️  Deine App läuft auf: ${CYAN}$APP_URL${NC}"
    echo -e "${YELLOW}   (Ohne SSL - DNS konfigurieren und certbot ausführen für HTTPS)${NC}"
fi

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  📊 Service Status${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""

systemctl status zertifikat-waechter-worker --no-pager -l | head -n 5
echo ""
systemctl status nginx --no-pager -l | head -n 5

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  🔧 Nützliche Befehle${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Services status:"
echo -e "    ${CYAN}systemctl status zertifikat-waechter-worker${NC}"
echo -e "    ${CYAN}systemctl status nginx${NC}"
echo ""
echo "  Logs anschauen:"
echo -e "    ${CYAN}journalctl -u zertifikat-waechter-worker -f${NC}"
echo -e "    ${CYAN}tail -f /var/log/nginx/zertifikat-waechter-access.log${NC}"
echo ""
echo "  Services neu starten:"
echo -e "    ${CYAN}systemctl restart zertifikat-waechter-worker${NC}"
echo -e "    ${CYAN}systemctl restart nginx${NC}"
echo ""
if [ "$SSL_INSTALLED" != true ]; then
    echo "  SSL nachträglich installieren:"
    echo -e "    ${CYAN}certbot --nginx -d $DOMAIN -d www.$DOMAIN${NC}"
    echo ""
fi
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  📋 WICHTIG: Supabase Cron-Jobs einrichten!${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Gehe zu: Supabase Dashboard → Database → Cron Jobs"
echo "  2. Erstelle 4 Jobs (siehe QUICK-START-CERT-WATCHER.md)"
echo "     • process-alerts (*/5 * * * *)"
echo "     • process-webhook-queue (* * * * *)"
echo "     • scan-certificates (0 */6 * * *)"
echo "     • cleanup-webhook-deliveries (0 3 * * *)"
echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}🚀 Öffne jetzt im Browser: ${CYAN}$APP_URL${NC}"
echo ""
echo -e "${GREEN}Happy Monitoring! 🛡️${NC}"
echo ""

