@echo off
REM Agent Rebuild Script - Für lokale Entwicklung und Testing (Windows)

echo 🔧 Rebuilding Zertifikat-Wächter Agent...

REM Change to agent directory
cd /d "%~dp0"

REM Stop running agent if exists
echo ⏸️  Stopping running agent...
docker stop certwatcher-agent-test 2>nul
docker rm certwatcher-agent-test 2>nul

REM Build new image
echo 🏗️  Building new Docker image...
docker build -t certwatcher/agent:latest .

echo ✅ Agent rebuilt successfully!
echo.
echo 📝 Nächste Schritte:
echo 1. Starte den Agent mit:
echo    start-agent.bat
echo.
echo 2. Oder mit Docker Compose:
echo    docker-compose up -d
echo.
echo 3. Logs anschauen:
echo    docker logs -f certwatcher-agent-test

pause


