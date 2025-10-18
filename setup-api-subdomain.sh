#!/bin/bash

##############################################
# API-Subdomain Setup für api.cert-watcher.de
##############################################

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🌐 Setup API-Subdomain: api.cert-watcher.de            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Prüfe Root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Bitte als root ausführen: sudo ./setup-api-subdomain.sh"
    exit 1
fi

# Entferne kaputten Symlink falls vorhanden
rm -f /etc/nginx/sites-enabled/api-cert-watcher

# Erstelle Nginx-Config für API-Subdomain
echo -e "${YELLOW}Erstelle Nginx-Config für api.cert-watcher.de...${NC}"

cat > /etc/nginx/sites-available/api-cert-watcher <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api.cert-watcher.de;

    # Let's Encrypt Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # Alle API-Requests an Worker weiterleiten
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS Headers (für externe API-Nutzung)
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-API-Key" always;
        
        # Preflight Request
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
EOF

# Symlink erstellen
ln -sf /etc/nginx/sites-available/api-cert-watcher /etc/nginx/sites-enabled/

# Nginx Config testen
echo -e "${YELLOW}Teste Nginx-Config...${NC}"
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx-Config fehlerhaft!"
    exit 1
fi

# Nginx neu laden
systemctl reload nginx

echo -e "${GREEN}✅ Nginx-Config erstellt${NC}"
echo ""

# DNS prüfen
echo -e "${YELLOW}Prüfe DNS für api.cert-watcher.de...${NC}"
DNS_IP=$(nslookup api.cert-watcher.de | grep -A1 "Name:" | tail -n1 | awk '{print $2}' || echo "")
SERVER_IP=$(curl -s ifconfig.me)

echo "DNS zeigt auf:    $DNS_IP"
echo "Server-IP ist:    $SERVER_IP"
echo ""

if [ "$DNS_IP" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  DNS noch nicht konfiguriert!${NC}"
    echo ""
    echo "Bitte erstelle einen A-Record:"
    echo "  Typ:  A"
    echo "  Name: api"
    echo "  Wert: $SERVER_IP"
    echo ""
    read -p "DNS konfiguriert? Fortfahren mit SSL? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Setup pausiert. Führe das Script erneut aus nach DNS-Konfiguration."
        exit 0
    fi
fi

# SSL-Zertifikat installieren
echo -e "${YELLOW}Installiere SSL-Zertifikat für api.cert-watcher.de...${NC}"
certbot --nginx -d api.cert-watcher.de --non-interactive --agree-tos --email admin@cert-watcher.de --redirect

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSL-Zertifikat erfolgreich installiert!${NC}"
else
    echo -e "${YELLOW}⚠️  SSL-Installation fehlgeschlagen (DNS noch nicht bereit?)${NC}"
    echo "   Du kannst SSL später installieren mit:"
    echo "   sudo certbot --nginx -d api.cert-watcher.de"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   ✅ API-Subdomain Setup abgeschlossen!                   ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}API läuft jetzt auf:${NC}"
echo ""
if [ -f "/etc/letsencrypt/live/api.cert-watcher.de/fullchain.pem" ]; then
    echo "  🌐 https://api.cert-watcher.de"
else
    echo "  🌐 http://api.cert-watcher.de (ohne SSL)"
fi
echo ""
echo -e "${YELLOW}Teste mit:${NC}"
echo "  curl https://api.cert-watcher.de/health"
echo ""

