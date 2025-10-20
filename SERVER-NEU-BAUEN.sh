#!/bin/bash

# Server-seitiger Neu-Build für MFA-Fix
# Führe dieses Skript auf dem Server aus!

echo "🚀 MFA-Fix: Server-seitiger Neu-Build"
echo "======================================"
echo ""

# 1. Git Pull
echo "📥 1/5: Git Pull..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "❌ Git pull fehlgeschlagen!"
    exit 1
fi
echo "✅ Git pull erfolgreich"
echo ""

# 2. Frontend-Verzeichnis
echo "📂 2/5: Wechsle zu frontend/..."
cd frontend
echo "✅ In frontend/"
echo ""

# 3. Node Modules & Cache löschen
echo "🧹 3/5: Lösche Cache..."
rm -rf node_modules/.vite dist
echo "✅ Cache gelöscht"
echo ""

# 4. Dependencies installieren
echo "📦 4/5: npm install..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install fehlgeschlagen!"
    exit 1
fi
echo "✅ npm install erfolgreich"
echo ""

# 5. Build
echo "🔨 5/5: npm run build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build fehlgeschlagen!"
    exit 1
fi
echo "✅ Build erfolgreich"
echo ""

# Build-Info anzeigen
echo "📊 Build-Info:"
ls -lh dist/assets/index-*.js | tail -1
echo ""

echo "🎉 Fertig! Jetzt dist/ ins Web-Root kopieren:"
echo ""
echo "   sudo cp -r dist/* /var/www/html/"
echo "   sudo systemctl reload nginx"
echo ""

