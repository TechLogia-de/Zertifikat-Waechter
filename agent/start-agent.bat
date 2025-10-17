@echo off
REM Zertifikat-Wächter Agent - Quick Start Script für Windows

echo ======================================
echo  Zertifikat-Wächter Agent Setup
echo ======================================
echo.

REM Check if .env exists
if not exist .env (
    echo [WARNUNG] Keine .env Datei gefunden!
    echo Erstelle .env aus .env.example...
    copy .env.example .env
    echo.
    echo [OK] .env erstellt!
    echo.
    echo [WICHTIG] Bearbeite jetzt die .env Datei mit deinen Credentials:
    echo    - SUPABASE_URL
    echo    - SUPABASE_SERVICE_ROLE_KEY
    echo    - SCAN_TARGETS
    echo.
    echo Danach führe dieses Script erneut aus:
    echo    start-agent.bat
    pause
    exit /b 1
)

echo [OK] Configuration gefunden!
echo.
echo Starte Agent...
echo.

REM Build Docker Image
echo [BUILD] Building Docker Image...
docker build -t certwatcher-agent:latest .

if errorlevel 1 (
    echo.
    echo [FEHLER] Docker Build fehlgeschlagen!
    pause
    exit /b 1
)

echo.
echo [START] Starting Agent...
docker run -d ^
  --name certwatcher-agent ^
  --env-file .env ^
  -p 8080:8080 ^
  --restart unless-stopped ^
  certwatcher-agent:latest

if errorlevel 1 (
    echo.
    echo [FEHLER] Agent konnte nicht gestartet werden!
    echo Prüfe ob Docker läuft: docker ps
    pause
    exit /b 1
)

echo.
echo ======================================
echo  Agent erfolgreich gestartet!
echo ======================================
echo.
echo Logs anschauen:
echo    docker logs -f certwatcher-agent
echo.
echo Health Check:
echo    curl http://localhost:8080/healthz
echo.
echo Agent stoppen:
echo    docker stop certwatcher-agent
echo    docker rm certwatcher-agent
echo.
echo [OK] Fertig! Der Agent scannt jetzt im Hintergrund.
echo.
pause

