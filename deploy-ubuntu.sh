#!/bin/bash

##############################################
# Zertifikat-Wächter - Ubuntu Deployment Script
##############################################

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🛡️  Zertifikat-Wächter Deployment für Ubuntu           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variablen
APP_DIR="/opt/zertifikat-waechter"
FRONTEND_DIR="$APP_DIR/frontend"
WORKER_DIR="$APP_DIR/worker"
VENV_DIR="$WORKER_DIR/venv"
USER="www-data"
DOMAIN="cert-watcher.de"

echo -e "${YELLOW}[1/9] Prüfe Voraussetzungen...${NC}"
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Bitte als root ausführen: sudo ./deploy-ubuntu.sh${NC}"
    exit 1
fi

# System Update
echo -e "${YELLOW}[2/9] System Update...${NC}"
apt update
apt upgrade -y

# Dependencies installieren
echo -e "${YELLOW}[3/9] Installiere Dependencies...${NC}"
apt install -y \
    nginx \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    git \
    curl \
    certbot \
    python3-certbot-nginx

# Node.js auf neueste LTS Version updaten (falls nötig)
echo -e "${YELLOW}[4/9] Prüfe Node.js Version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Installiere Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# App-Verzeichnis vorbereiten
echo -e "${YELLOW}[5/9] Prüfe Projekt-Verzeichnis...${NC}"

# Prüfe ob Script bereits im Projekt-Verzeichnis ausgeführt wird
CURRENT_DIR=$(pwd)
if [ -f "$CURRENT_DIR/deploy-ubuntu.sh" ] && [ -d "$CURRENT_DIR/frontend" ]; then
    echo -e "${GREEN}✅ Script wird im Projekt-Verzeichnis ausgeführt${NC}"
    
    # Wenn nicht in /opt, dann kopieren/verschieben
    if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
        echo -e "${YELLOW}Kopiere Projekt nach $APP_DIR...${NC}"
        mkdir -p /opt
        cp -r "$CURRENT_DIR" "$APP_DIR"
        cd $APP_DIR
    fi
    
    # Aktualisiere von Git falls möglich
    if [ -d ".git" ]; then
        echo -e "${YELLOW}Aktualisiere von Git...${NC}"
        git pull || echo -e "${YELLOW}Git pull fehlgeschlagen, nutze lokale Version${NC}"
    fi
else
    # Script wird NICHT im Projekt ausgeführt
    if [ -d "$APP_DIR" ]; then
        echo -e "${YELLOW}Projekt existiert bereits in $APP_DIR. Aktualisiere...${NC}"
        cd $APP_DIR
        git pull
    else
        echo -e "${YELLOW}Clone Projekt von GitHub...${NC}"
        cd /opt
        git clone https://github.com/TechLogia-de/Zertifikat-Waechter.git zertifikat-waechter
        cd $APP_DIR
    fi
fi

echo -e "${GREEN}✅ Projekt bereit in: $APP_DIR${NC}"

# Frontend bauen
echo -e "${YELLOW}[6/9] Baue Frontend...${NC}"
cd $FRONTEND_DIR
npm install
npm run build

echo -e "${GREEN}✅ Frontend gebaut in: $FRONTEND_DIR/dist${NC}"

# Worker einrichten
echo -e "${YELLOW}[7/10] Richte Worker ein...${NC}"
cd $WORKER_DIR

# Python Virtual Environment
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv $VENV_DIR
fi

source $VENV_DIR/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo -e "${GREEN}✅ Worker eingerichtet${NC}"

# Nginx konfigurieren
echo -e "${YELLOW}[8/10] Konfiguriere Nginx...${NC}"
cat > /etc/nginx/sites-available/zertifikat-waechter <<'EOF'
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
    server_name $DOMAIN www.$DOMAIN;

    # Let's Encrypt Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect zu HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Zertifikate (werden von certbot erstellt)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # SSL Configuration (Modern)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
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
EOF

# Nginx Site aktivieren
ln -sf /etc/nginx/sites-available/zertifikat-waechter /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx Config testen
nginx -t

# Systemd Services erstellen
echo -e "${YELLOW}[9/10] Erstelle Systemd Services...${NC}"

# Worker Service
cat > /etc/systemd/system/zertifikat-waechter-worker.service <<EOF
[Unit]
Description=Zertifikat-Wächter Worker API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$WORKER_DIR
Environment="PATH=$VENV_DIR/bin"
EnvironmentFile=$APP_DIR/.env.production
ExecStart=$VENV_DIR/bin/python api.py

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
EOF

# Services aktivieren
systemctl daemon-reload
systemctl enable zertifikat-waechter-worker
systemctl enable nginx

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   ✅ Installation erfolgreich abgeschlossen!              ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Nächste Schritte:${NC}"
echo ""
echo "1. Environment Variables konfigurieren:"
echo "   nano $APP_DIR/.env.production"
echo ""
echo "2. DNS prüfen (A-Record muss auf Server-IP zeigen):"
echo "   nslookup $DOMAIN"
echo ""
echo "3. SSL-Zertifikat installieren:"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "4. Services starten:"
echo "   systemctl start zertifikat-waechter-worker"
echo "   systemctl restart nginx"
echo ""
echo "5. Status prüfen:"
echo "   systemctl status zertifikat-waechter-worker"
echo "   systemctl status nginx"
echo ""
echo "6. App öffnen:"
echo "   https://$DOMAIN"
echo ""
echo "7. Logs anschauen:"
echo "   journalctl -u zertifikat-waechter-worker -f"
echo "   tail -f /var/log/nginx/zertifikat-waechter-error.log"
echo ""
echo -e "${GREEN}Happy Monitoring! 🛡️${NC}"

