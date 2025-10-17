@echo off
REM ========================================
REM  BAUE AGENT DOCKER IMAGE - SOFORT!
REM ========================================

echo.
echo  ================================
echo   Agent Docker Image bauen
echo  ================================
echo.
echo  Dies dauert ca. 30-60 Sekunden...
echo.

REM Gehe ins Agent-Verzeichnis
cd agent

REM Baue Docker Image
echo [BAUE] Docker Image wird gebaut...
docker build -t ghcr.io/antonio-030/certwatcher-agent:latest .

if errorlevel 1 (
    echo.
    echo [FEHLER] Build fehlgeschlagen!
    echo.
    echo Moegliche Ursachen:
    echo  - Docker Desktop laeuft nicht
    echo  - Falsches Verzeichnis
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================
echo   BUILD ERFOLGREICH!
echo  ================================
echo.
echo Image verfuegbar:
echo   ghcr.io/antonio-030/certwatcher-agent:latest
echo.
echo NAECHSTE SCHRITTE:
echo.
echo 1. Gehe zur Connectors-Seite im Frontend
echo 2. Klicke "Neuen Agent erstellen"
echo 3. Gib Name und Scan-Targets ein
echo 4. Kopiere den Docker-Befehl
echo 5. Fuehre ihn aus!
echo.
echo ODER teste mit:
echo   docker run -d \
echo     --name test-agent \
echo     -e SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co \
echo     -e CONNECTOR_TOKEN=dein-token-aus-ui \
echo     -e SCAN_TARGETS=google.com \
echo     -e SCAN_PORTS=443 \
echo     -p 8080:8080 \
echo     ghcr.io/antonio-030/certwatcher-agent:latest
echo.
pause

