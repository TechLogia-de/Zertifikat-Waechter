#!/bin/bash

##############################################
# Zertifikat-Wächter - Stop All Services
##############################################

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🛑 Zertifikat-Wächter - Stoppe alle Services            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verzeichnisse
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd "$SCRIPT_DIR"

# PID-Dateien
PID_FILES=("logs/frontend.pid" "logs/worker.pid" "logs/webhook-server.pid")
SERVICES=("Frontend" "Worker API" "Webhook-Server")

STOPPED=0

for i in ${!PID_FILES[@]}; do
    PID_FILE="${PID_FILES[$i]}"
    SERVICE="${SERVICES[$i]}"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stoppe $SERVICE (PID: $PID)...${NC}"
            kill $PID 2>/dev/null
            sleep 1
            
            # Force kill falls noch läuft
            if ps -p $PID > /dev/null 2>&1; then
                kill -9 $PID 2>/dev/null
            fi
            
            echo -e "${GREEN}✅ $SERVICE gestoppt${NC}"
            STOPPED=$((STOPPED + 1))
        else
            echo -e "${YELLOW}⚠️  $SERVICE läuft nicht (PID: $PID)${NC}"
        fi
        
        rm -f "$PID_FILE"
    else
        echo -e "${YELLOW}⚠️  Keine PID-Datei für $SERVICE gefunden${NC}"
    fi
done

# Prüfe auch nach Namen falls PIDs fehlen
echo ""
echo -e "${YELLOW}Prüfe auf laufende Prozesse...${NC}"

# Vite/Frontend
VITE_PID=$(pgrep -f "vite" | head -n 1)
if [ ! -z "$VITE_PID" ]; then
    echo -e "${YELLOW}Stoppe Vite-Prozess (PID: $VITE_PID)...${NC}"
    kill $VITE_PID 2>/dev/null
    STOPPED=$((STOPPED + 1))
fi

# Python Worker
PYTHON_PID=$(pgrep -f "api.py" | head -n 1)
if [ ! -z "$PYTHON_PID" ]; then
    echo -e "${YELLOW}Stoppe Python Worker (PID: $PYTHON_PID)...${NC}"
    kill $PYTHON_PID 2>/dev/null
    STOPPED=$((STOPPED + 1))
fi

# Node Webhook Server
NODE_PID=$(pgrep -f "test-webhook-server.js" | head -n 1)
if [ ! -z "$NODE_PID" ]; then
    echo -e "${YELLOW}Stoppe Webhook-Server (PID: $NODE_PID)...${NC}"
    kill $NODE_PID 2>/dev/null
    STOPPED=$((STOPPED + 1))
fi

echo ""
if [ $STOPPED -gt 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║   ✅ Alle Services gestoppt! ($STOPPED Services)                 ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}⚠️  Keine laufenden Services gefunden${NC}"
fi

echo ""

