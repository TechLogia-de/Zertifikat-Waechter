@echo off
echo ============================================================
echo   Zertifikat-Waechter - VOLLSTART
echo ============================================================
echo.
echo Starte Worker API und Frontend...
echo.
echo [1/2] Worker API startet in neuem Fenster...
start "Worker API" cmd /k "cd worker && python api.py"
timeout /t 3 /nobreak >nul

echo [2/2] Frontend startet in neuem Fenster...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo   BEIDE SERVICES GESTARTET!
echo ============================================================
echo.
echo   Worker API:  http://localhost:5000
echo   Frontend:    http://localhost:5173
echo.
echo Warte 5 Sekunden, dann oeffne ich den Browser...
timeout /t 5 /nobreak >nul

start http://localhost:5173

echo.
echo Fertig! Browser sollte sich oeffnen.
echo.
echo Druecke eine Taste um dieses Fenster zu schliessen...
pause >nul

