@echo off
echo ========================================
echo  SMTP Worker API Server
echo ========================================
echo.

cd worker

if not exist venv (
    echo [INFO] Erstelle Python venv...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install flask flask-cors python-dotenv
) else (
    call venv\Scripts\activate.bat
)

echo.
echo [INFO] Starte API auf http://localhost:5000
echo [INFO] Frontend kann jetzt ECHTE E-Mails senden!
echo.
echo Druecke Ctrl+C zum Beenden
echo.

python api.py

