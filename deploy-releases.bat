@echo off
REM Deploy releases page to server
REM Dieses Skript deployed die Release-Seite auf deinen Server

echo.
echo ========================================
echo   Zertifikat-Waechter Release Deploy
echo ========================================
echo.

set RELEASE_PAGE=releases\index.html
set SERVER_USER=root
set SERVER_HOST=cert-watcher.de
set SERVER_PATH=/var/www/releases.cert-watcher.de/html

REM Pruefen ob Release-Seite existiert
if not exist "%RELEASE_PAGE%" (
    echo [ERROR] Release-Seite nicht gefunden: %RELEASE_PAGE%
    exit /b 1
)

echo [1/2] Kopiere Release-Seite zum Server...
scp "%RELEASE_PAGE%" "%SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%/index.html"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   DEPLOYMENT ERFOLGREICH!
    echo ========================================
    echo.
    echo   URL: https://releases.cert-watcher.de/
    echo.
) else (
    echo.
    echo [ERROR] Deployment fehlgeschlagen!
    exit /b 1
)

pause

