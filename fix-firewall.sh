#!/bin/bash

##############################################
# Firewall-Konfiguration für Zertifikat-Wächter
##############################################

echo "🔥 Konfiguriere Firewall..."
echo ""

# UFW aktivieren (falls nicht aktiv)
if ! ufw status | grep -q "Status: active"; then
    echo "Aktiviere UFW Firewall..."
    ufw --force enable
fi

# SSH erlauben (WICHTIG!)
echo "✅ Erlaube SSH (Port 22)..."
ufw allow 22/tcp

# HTTP erlauben (Port 80)
echo "✅ Erlaube HTTP (Port 80)..."
ufw allow 80/tcp

# HTTPS erlauben (Port 443)
echo "✅ Erlaube HTTPS (Port 443)..."
ufw allow 443/tcp

# Status anzeigen
echo ""
echo "════════════════════════════════════════"
echo "Firewall Status:"
echo "════════════════════════════════════════"
ufw status numbered

echo ""
echo "✅ Firewall konfiguriert!"
echo ""
echo "Offene Ports:"
echo "  • Port 22  (SSH)"
echo "  • Port 80  (HTTP)"
echo "  • Port 443 (HTTPS)"
echo ""
echo "Teste jetzt: https://cert-watcher.de"

