#!/bin/bash

# =====================================================
# System-SMTP Feature Migration Script
# =====================================================

echo "🛡️  Zertifikat-Wächter - System-SMTP Migration"
echo "=============================================="
echo ""

# Prüfe ob Supabase CLI installiert ist
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI nicht gefunden!"
    echo ""
    echo "Bitte führe die Migration manuell aus:"
    echo "1. Öffne Supabase Dashboard"
    echo "2. Gehe zu SQL Editor"
    echo "3. Kopiere Inhalt von supabase/migrations/00023_system_smtp_option.sql"
    echo "4. Führe aus"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI gefunden"
echo ""

# Prüfe ob wir im Projekt-Root sind
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Fehler: Bitte führe das Script im Projekt-Root aus!"
    exit 1
fi

echo "📁 Projekt-Root gefunden"
echo ""

# Migration ausführen
echo "🚀 Führe Migration aus..."
echo ""

if supabase db push; then
    echo ""
    echo "✅ Migration erfolgreich angewendet!"
    echo ""
    echo "📋 Nächste Schritte:"
    echo "1. Frontend neu bauen: cd frontend && npm run build"
    echo "2. Worker neu starten: cd worker && python api.py"
    echo "3. System-SMTP in worker/.env konfigurieren"
    echo ""
    echo "📖 Vollständige Dokumentation: SYSTEM-SMTP-FEATURE.md"
else
    echo ""
    echo "❌ Migration fehlgeschlagen!"
    echo ""
    echo "Manuelle Migration:"
    echo "1. Öffne Supabase Dashboard"
    echo "2. SQL Editor → New Query"
    echo "3. Führe aus:"
    echo ""
    cat supabase/migrations/00023_system_smtp_option.sql
    echo ""
fi

