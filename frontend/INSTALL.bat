@echo off
echo ========================================
echo  Frontend Dependencies Installation
echo ========================================
echo.

echo [INFO] Loesche alte Installation...
if exist node_modules (
    rmdir /s /q node_modules
    echo [OK] node_modules geloescht
)

if exist package-lock.json (
    del package-lock.json
    echo [OK] package-lock.json geloescht
)

echo.
echo [INFO] Installiere npm packages...
echo        Dies kann einige Minuten dauern...
echo.

call npm install

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Installation erfolgreich!
    echo.
    echo Starte jetzt den Dev Server mit:
    echo     npm run dev
    echo.
    echo Oder druecke eine Taste um zu starten...
    pause >nul
    npm run dev
) else (
    echo [ERROR] Installation fehlgeschlagen!
    echo.
    echo Pruefe:
    echo - Node.js installiert? node --version
    echo - Internet Verbindung OK?
    echo.
    pause
)

