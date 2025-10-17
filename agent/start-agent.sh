#!/bin/bash

# Zertifikat-Wächter Agent - Quick Start Script

set -e

echo "🚀 Zertifikat-Wächter Agent Setup"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Keine .env Datei gefunden!"
    echo "Erstelle .env aus .env.example..."
    cp .env.example .env
    echo ""
    echo "✅ .env erstellt!"
    echo ""
    echo "⚠️  WICHTIG: Bearbeite jetzt die .env Datei mit deinen Credentials:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - SCAN_TARGETS"
    echo ""
    echo "Danach führe dieses Script erneut aus:"
    echo "   ./start-agent.sh"
    exit 1
fi

# Load .env
source .env

# Check required variables
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "your-supabase-url-here" ]; then
    echo "❌ FEHLER: SUPABASE_URL nicht konfiguriert!"
    echo "Bearbeite .env und setze SUPABASE_URL"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ "$SUPABASE_SERVICE_ROLE_KEY" = "your-service-role-key-here" ]; then
    echo "❌ FEHLER: SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert!"
    echo "Bearbeite .env und setze SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "✅ Configuration valid!"
echo ""
echo "📋 Settings:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Scan Targets: ${SCAN_TARGETS:-localhost}"
echo "   Scan Ports: ${SCAN_PORTS:-443,8443,636}"
echo "   Scan Interval: ${SCAN_INTERVAL:-3600}s"
echo ""

# Ask for confirmation
read -p "Agent mit diesen Einstellungen starten? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Abgebrochen."
    exit 1
fi

echo ""
echo "🔨 Building Docker Image..."
docker build -t certwatcher-agent:latest .

echo ""
echo "🚀 Starting Agent..."
docker run -d \
  --name certwatcher-agent \
  --env-file .env \
  -p 8080:8080 \
  --restart unless-stopped \
  certwatcher-agent:latest

echo ""
echo "✅ Agent gestartet!"
echo ""
echo "📊 Logs anschauen:"
echo "   docker logs -f certwatcher-agent"
echo ""
echo "🔍 Health Check:"
echo "   curl http://localhost:8080/healthz"
echo ""
echo "🛑 Agent stoppen:"
echo "   docker stop certwatcher-agent"
echo "   docker rm certwatcher-agent"
echo ""
echo "🎉 Fertig! Der Agent scannt jetzt im Hintergrund."

