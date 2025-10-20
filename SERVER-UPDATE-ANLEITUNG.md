# 🔧 SERVER UPDATE - MFA-Fix

## ⚠️ PROBLEM ERKANNT

**Server läuft mit ALTEM Build:**
```
❌ Server: index-BKGOJAYJ.js (ALT - ohne Challenge-Fix)
✅ Lokal:  index-BEAKwQG1.js (NEU - mit Challenge-Fix)
```

**Grund:** Server hat entweder vor dem Git-Push gebaut oder hat gecachte Version.

---

## 🚀 LÖSUNG: Auf Server neu bauen

### Option A: Automatisches Skript (Linux/Mac)

```bash
# 1. SSH zum Server
ssh user@cert-watcher.de

# 2. Zum Projekt-Verzeichnis
cd /var/www/cert-watcher.de/

# 3. Skript ausführbar machen
chmod +x SERVER-NEU-BAUEN.sh

# 4. Skript ausführen
./SERVER-NEU-BAUEN.sh

# 5. Dist ins Web-Root kopieren
sudo cp -r frontend/dist/* /var/www/html/

# 6. Nginx neu laden
sudo systemctl reload nginx
```

### Option B: Manuelle Schritte (Linux/Mac)

```bash
# 1. SSH zum Server
ssh user@cert-watcher.de

# 2. Zum Projekt wechseln
cd /var/www/cert-watcher.de/

# 3. Git Pull (holt den neuesten Code mit Challenge-Fix)
git pull origin main

# 4. Zu Frontend
cd frontend

# 5. Cache löschen (WICHTIG!)
rm -rf node_modules/.vite dist

# 6. Dependencies installieren
npm install

# 7. NEU BAUEN
npm run build

# 8. Prüfe Build-Datei
ls -lh dist/assets/index-*.js
# Sollte zeigen: index-BEAKwQG1.js (oder neuerer Hash)

# 9. Dist ins Web-Root kopieren
cd ..
sudo cp -r frontend/dist/* /var/www/html/

# 10. Nginx neu laden
sudo systemctl reload nginx

# 11. Alte Dateien löschen (optional)
sudo rm /var/www/html/assets/index-BKGOJAYJ.js
```

### Option C: Windows Server (PowerShell)

```powershell
# 1. RDP oder PowerShell Remoting zum Server

# 2. Zum Projekt wechseln
cd C:\inetpub\wwwroot\cert-watcher.de\

# 3. Git Pull
git pull origin main

# 4. Zu Frontend
cd frontend

# 5. Cache löschen
Remove-Item -Recurse -Force node_modules\.vite, dist

# 6. npm install
npm install

# 7. NEU BAUEN
npm run build

# 8. Dist kopieren
Copy-Item -Recurse -Force dist\* C:\inetpub\wwwroot\

# 9. IIS neu laden
iisreset
```

---

## ✅ Nach dem Update

### 1. Überprüfen ob neuer Build läuft

**Browser öffnen:** https://cert-watcher.de/

**F12 drücken → Network Tab → Reload**

Suche nach:
```
✅ index-BEAKwQG1.js  (oder neuerer Hash) ← SOLLTE GELADEN WERDEN
❌ index-BKGOJAYJ.js                       ← SOLLTE NICHT MEHR DA SEIN
```

### 2. Browser-Cache leeren

**WICHTIG:** Sonst lädt Browser alte Version!

```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

Oder **Inkognito-Modus** verwenden.

### 3. MFA neu testen

#### Schritt A: Alte Faktoren löschen

**Supabase Dashboard:**
1. https://supabase.com/dashboard/project/ethwkzwsxkhcexibuvwp
2. **Authentication** → **Users**
3. Dein User → **Factors** Tab
4. Lösche Faktor `93b1fd12-04f5-4b73-a22a-bc3837345890`
5. Speichern

#### Schritt B: MFA neu aktivieren

1. **Einstellungen** öffnen
2. **"MFA (TOTP) aktivieren"** klicken
3. QR-Code wird angezeigt

**Erwartete Console-Logs:**
```javascript
✅ 📱 TOTP URI korrigiert: {
  original: "otpauth://totp/Zertifikat-Wächter:j.ruiz@techlogia.de...",
  corrected: "otpauth://totp/Zertifikat-Wächter:j.ruiz@techlogia.de...",
  issuer: "Zertifikat-Wächter"
}

✅ 📱 TOTP QR-Code generiert: {
  issuer: "Zertifikat-Wächter",
  label: "j.ruiz@techlogia.de",
  secret_length: 32
}
```

#### Schritt C: Microsoft Authenticator scannen

- QR-Code scannen
- Eintrag sollte sein: **"Zertifikat-Wächter"**
- Label: **"j.ruiz@techlogia.de"**

#### Schritt D: Code eingeben

- 6-stelligen Code aus App eingeben
- **"Aktivieren"** klicken

**Erwartetes Ergebnis:**
```
✅ MFA (TOTP) aktiviert!
```

**KEINE Fehler mehr:**
```
❌ "MFA factor with the provided challenge ID not found"
```

**Erwartete Console-Logs:**
```javascript
✅ MFA erfolgreich aktiviert für Faktor: 93b1fd12-...
```

---

## 🐛 Debugging wenn es noch nicht klappt

### Check 1: Richtiger Build läuft?

**F12 → Network → index-*.js**

```
✅ Sollte sein: index-BEAKwQG1.js
❌ Wenn noch:   index-BKGOJAYJ.js → Server Cache nicht geleert!
```

**Fix:**
```bash
# Browser-Cache
Ctrl + Shift + R

# Server-Cache
sudo systemctl reload nginx

# Cloudflare (falls verwendet)
Cloudflare Dashboard → Purge Everything
```

### Check 2: Challenge-Code wird ausgeführt?

**Console öffnen → MFA aktivieren**

**SOLLTE erscheinen:**
```javascript
// Keine Fehler beim Challenge-Schritt
// Nur beim Verify-Schritt sollte es funktionieren
```

**SOLLTE NICHT erscheinen:**
```javascript
❌ Failed to verify MFA: AuthApiError: MFA factor with the provided challenge ID not found
```

### Check 3: Git Commit richtig?

**Auf Server:**
```bash
cd /var/www/cert-watcher.de/
git log -1 --oneline

# Sollte zeigen:
# 1d3fab3 fix: MFA challenge-Schritt und localhost-Ersetzung in TOTP URI
```

Wenn nicht:
```bash
git pull origin main
# Dann neu bauen!
```

### Check 4: Source-Code prüfen

**Auf Server:**
```bash
cd /var/www/cert-watcher.de/frontend/src/pages/
grep -A 5 "WICHTIG: Erst Challenge erstellen" Settings.tsx
```

**Sollte zeigen:**
```typescript
// WICHTIG: Erst Challenge erstellen, dann verifizieren!
// Ohne Challenge schlägt verify() fehl mit "challenge ID not found"
const { error: challengeError } = await (supabase.auth as any).mfa.challenge({ 
  factorId: factorIdToUse 
})
if (challengeError) throw challengeError
```

Wenn nicht vorhanden → `git pull` fehlt!

---

## 📊 Checkliste

Server-Update:
- [ ] **SSH zum Server**
- [ ] **Git Pull** (`git pull origin main`)
- [ ] **Cache löschen** (`rm -rf node_modules/.vite dist`)
- [ ] **npm install**
- [ ] **npm run build**
- [ ] **Dist ins Web-Root kopieren**
- [ ] **Nginx/Apache neu laden**

Verifikation:
- [ ] **Browser-Cache geleert** (Ctrl+Shift+R)
- [ ] **Richtiger Build läuft** (index-BEAKwQG1.js)
- [ ] **Alte MFA-Faktoren gelöscht** (Supabase Dashboard)

Test:
- [ ] **MFA aktivieren** funktioniert
- [ ] **"Zertifikat-Wächter"** in Microsoft Authenticator
- [ ] **Code-Verifizierung erfolgreich** (kein Challenge-Fehler)
- [ ] **"✅ MFA (TOTP) aktiviert!" Meldung**
- [ ] **Login mit MFA funktioniert**

---

## 🎯 Erwartetes Ergebnis

Nach erfolgreichem Update:

✅ Server läuft mit `index-BEAKwQG1.js` (oder neuerer)  
✅ Challenge wird vor verify() erstellt  
✅ Kein "challenge ID not found" Fehler mehr  
✅ "Zertifikat-Wächter" in Microsoft Authenticator  
✅ MFA-Aktivierung funktioniert  
✅ Login mit MFA funktioniert  

---

**Wichtig:** Falls du keinen SSH-Zugang hast, musst du den `frontend/dist/` Ordner manuell per FTP hochladen. Stelle sicher, dass du den **AKTUELLEN** Build hochlädst (`index-BEAKwQG1.js`).

**Update-Datum:** 20. Oktober 2025  
**Git-Commit:** `1d3fab3`  
**Ziel-Build:** `index-BEAKwQG1.js`

