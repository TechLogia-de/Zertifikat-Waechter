#!/bin/bash

##############################################
# Zertifikat-Wächter - Start All (Development)
##############################################

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🛡️  Zertifikat-Wächter - Starte alle Services          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verzeichnisse
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd "$SCRIPT_DIR"

# Log-Dateien
FRONTEND_LOG="logs/frontend.log"
WORKER_LOG="logs/worker.log"
WEBHOOK_LOG="logs/webhook-server.log"

# Erstelle logs Verzeichnis
mkdir -p logs

echo -e "${YELLOW}🚀 Starte Services...${NC}"
echo ""

# 1. Frontend starten
echo -e "${YELLOW}[1/3] Starte Frontend (Vite)...${NC}"
cd frontend
npm run dev > "../$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
echo -e "${GREEN}✅ Frontend gestartet (PID: $FRONTEND_PID)${NC}"
cd ..

# Warte kurz
sleep 2

# 2. Worker API starten
echo -e "${YELLOW}[2/3] Starte Worker API...${NC}"
cd worker

# Aktiviere venv falls vorhanden
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python api.py > "../$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > ../logs/worker.pid
echo -e "${GREEN}✅ Worker API gestartet (PID: $WORKER_PID)${NC}"
cd ..

# Warte kurz
sleep 2

# 3. Test-Webhook-Server starten
echo -e "${YELLOW}[3/3] Starte Test-Webhook-Server...${NC}"
node test-webhook-server.js > "$WEBHOOK_LOG" 2>&1 &
WEBHOOK_PID=$!
echo $WEBHOOK_PID > logs/webhook-server.pid
echo -e "${GREEN}✅ Test-Webhook-Server gestartet (PID: $WEBHOOK_PID)${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   ✅ Alle Services erfolgreich gestartet!                 ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Services:${NC}"
echo ""
echo "  🌐 Frontend:         http://localhost:5173"
echo "  🔧 Worker API:       http://localhost:5000"
echo "  📬 Webhook-Server:   http://localhost:3333/webhook"
echo ""
echo -e "${YELLOW}📋 PIDs:${NC}"
echo "  Frontend: $FRONTEND_PID"
echo "  Worker:   $WORKER_PID"
echo "  Webhook:  $WEBHOOK_PID"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo "  tail -f $FRONTEND_LOG"
echo "  tail -f $WORKER_LOG"
echo "  tail -f $WEBHOOK_LOG"
echo ""
echo -e "${YELLOW}🛑 Services stoppen:${NC}"
echo "  ./STOP-ALL-LINUX.sh"
echo ""
echo "  Oder manuell:"
echo "  kill $FRONTEND_PID $WORKER_PID $WEBHOOK_PID"
echo ""
echo -e "${GREEN}Happy Development! 🚀${NC}"

