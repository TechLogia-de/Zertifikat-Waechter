@echo off
REM =====================================================
REM System-SMTP Feature Migration Script (Windows)
REM =====================================================

echo.
echo 🛡️  Zertifikat-Wächter - System-SMTP Migration
echo ==============================================
echo.

REM Prüfe ob wir im Projekt-Root sind
if not exist "docker-compose.yml" (
    echo ❌ Fehler: Bitte führe das Script im Projekt-Root aus!
    pause
    exit /b 1
)

echo ✅ Projekt-Root gefunden
echo.

echo 📋 MANUELLE MIGRATION ERFORDERLICH
echo.
echo Da Supabase CLI auf Windows oft Probleme macht, bitte manuell:
echo.
echo 1. Öffne Supabase Dashboard: https://app.supabase.com
echo 2. Gehe zu deinem Projekt
echo 3. SQL Editor (linke Sidebar)
echo 4. New Query
echo 5. Kopiere den folgenden SQL-Code:
echo.
echo --------------------------------------------------------
type supabase\migrations\00023_system_smtp_option.sql
echo --------------------------------------------------------
echo.
echo 6. Führe die Query aus
echo 7. ✅ Fertig!
echo.
echo 📖 Vollständige Dokumentation: SYSTEM-SMTP-FEATURE.md
echo.

pause

