#!/bin/bash
# Agent Rebuild Script - Für lokale Entwicklung und Testing

set -e

echo "🔧 Rebuilding Zertifikat-Wächter Agent..."

# Change to agent directory
cd "$(dirname "$0")"

# Stop running agent if exists
echo "⏸️  Stopping running agent..."
docker stop certwatcher-agent-test 2>/dev/null || true
docker rm certwatcher-agent-test 2>/dev/null || true

# Build new image
echo "🏗️  Building new Docker image..."
docker build -t certwatcher/agent:latest .

echo "✅ Agent rebuilt successfully!"
echo ""
echo "📝 Nächste Schritte:"
echo "1. Starte den Agent mit:"
echo "   ./start-agent.sh"
echo ""
echo "2. Oder mit Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "3. Logs anschauen:"
echo "   docker logs -f certwatcher-agent-test"


