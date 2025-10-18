#!/bin/bash

##############################################
# Zertifikat-Wächter - Production Start Script
##############################################

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🛡️  Zertifikat-Wächter - Produktions-Start             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Prüfe ob als root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Bitte als root ausführen: sudo ./start-production.sh${NC}"
    exit 1
fi

# Services starten
echo -e "${YELLOW}Starte Services...${NC}"
echo ""

echo -e "${BLUE}[1/2] Starte Worker API...${NC}"
systemctl start zertifikat-waechter-worker
sleep 2

if systemctl is-active --quiet zertifikat-waechter-worker; then
    echo -e "${GREEN}✅ Worker API läuft${NC}"
else
    echo -e "${RED}❌ Worker API konnte nicht gestartet werden${NC}"
    journalctl -u zertifikat-waechter-worker -n 20 --no-pager
    exit 1
fi

echo -e "${BLUE}[2/2] Starte Nginx...${NC}"
systemctl start nginx
sleep 1

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx läuft${NC}"
else
    echo -e "${RED}❌ Nginx konnte nicht gestartet werden${NC}"
    nginx -t
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   ✅ Alle Services erfolgreich gestartet!                 ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Status anzeigen
echo -e "${YELLOW}📊 Service Status:${NC}"
echo ""
systemctl status zertifikat-waechter-worker --no-pager -l | head -n 10
echo ""
systemctl status nginx --no-pager -l | head -n 10
echo ""

echo -e "${YELLOW}📋 Nützliche Befehle:${NC}"
echo ""
echo "  Status prüfen:"
echo "    systemctl status zertifikat-waechter-worker"
echo "    systemctl status nginx"
echo ""
echo "  Logs anschauen:"
echo "    journalctl -u zertifikat-waechter-worker -f"
echo "    tail -f /var/log/nginx/zertifikat-waechter-access.log"
echo ""
echo "  Services stoppen:"
echo "    systemctl stop zertifikat-waechter-worker"
echo "    systemctl stop nginx"
echo ""
echo "  Services neustarten:"
echo "    systemctl restart zertifikat-waechter-worker"
echo "    systemctl restart nginx"
echo ""
echo -e "${GREEN}App läuft jetzt auf: https://cert-watcher.de${NC}"
echo ""

