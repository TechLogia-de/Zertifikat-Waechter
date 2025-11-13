#!/bin/bash
# Deploy releases page to server
# Dieses Skript deployed die Release-Seite auf deinen Server

set -e

echo "🚀 Deploying Zertifikat-Wächter Agent Release Page..."

# Konfiguration
RELEASE_PAGE="releases/index.html"
SERVER_USER="root"
SERVER_HOST="cert-watcher.de"
SERVER_PATH="/var/www/releases.cert-watcher.de/html"

# Prüfen ob Release-Seite existiert
if [ ! -f "$RELEASE_PAGE" ]; then
    echo "❌ Release-Seite nicht gefunden: $RELEASE_PAGE"
    exit 1
fi

echo "📦 Kopiere Release-Seite zum Server..."
scp "$RELEASE_PAGE" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/index.html"

echo "✅ Release-Seite deployed!"
echo "🌐 Verfügbar unter: https://releases.cert-watcher.de/"

# Optional: Docker Image bauen und taggen
read -p "Möchtest du auch das Docker-Image bauen und pushen? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🐳 Baue Docker Image..."
    
    # Version aus Agent README auslesen oder manuell setzen
    VERSION="1.0.0"
    
    cd agent
    
    # Multi-Architecture Build
    echo "🔨 Baue für AMD64 und ARM64..."
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t certwatcher/agent:latest \
        -t certwatcher/agent:v$VERSION \
        --push \
        .
    
    echo "✅ Docker Image gepusht!"
    echo "📦 Image: certwatcher/agent:latest"
    echo "📦 Image: certwatcher/agent:v$VERSION"
    
    cd ..
fi

echo ""
echo "✨ Deployment abgeschlossen!"

