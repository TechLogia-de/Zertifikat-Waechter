# 🚀 JETZT DEPLOYEN - MFA-Fix

## ✅ Was wurde behoben?

### Problem 1: "challenge ID not found" ❌ → ✅ BEHOBEN
**Vorher:** Fehler beim Code-Verifizieren  
**Jetzt:** Challenge wird korrekt erstellt vor verify()

### Problem 2: "localhost" in Microsoft Authenticator ❌ → ✅ BEHOBEN
**Vorher:** App zeigt "localhost" an  
**Jetzt:** App zeigt "Zertifikat-Wächter" an

---

## 📦 Neuer Build bereit

**Neue Dateien in `frontend/dist/`:**
```
✓ dist/index.html
✓ dist/assets/index-Sl_1BS45.css
✓ dist/assets/index-BEAKwQG1.js  ← NEU!
```

**Alte Datei (läuft noch auf Server):**
```
✗ assets/index-BtA_hHzo.js  ← MUSS ERSETZT WERDEN
```

---

## 🔧 DEPLOYMENT - OPTION A: Server hat Git-Pull

Falls dein Server automatisch von Git zieht:

```bash
# SSH zu Server:
ssh user@cert-watcher.de

# Zu Projekt-Verzeichnis:
cd /var/www/cert-watcher.de/

# Git Pull:
git pull

# Frontend neu bauen:
cd frontend
npm install
npm run build

# Dist-Ordner ins Web-Root kopieren:
sudo cp -r dist/* /var/www/html/
# ODER (je nach Setup):
sudo cp -r dist/* ../

# Nginx Cache leeren:
sudo systemctl reload nginx

# Fertig!
```

---

## 🔧 DEPLOYMENT - OPTION B: Manueller Upload

### Schritt 1: Alte Dateien auf Server löschen

Via FTP/SFTP:
```
Server: cert-watcher.de
Verzeichnis: /var/www/html/ (oder /var/www/cert-watcher.de/)

Lösche:
- assets/index-BtA_hHzo.js
- assets/*.css (alte CSS-Dateien)
```

### Schritt 2: Neue Dateien hochladen

**Von deinem PC:**
```
Lokales Verzeichnis: 
C:\Users\NGJARUIZ\...\Zertifikat-Wächter\frontend\dist\

Hochladen auf Server:
/var/www/html/

Dateien:
✓ index.html (ÜBERSCHREIBEN)
✓ assets/index-Sl_1BS45.css (NEU)
✓ assets/index-BEAKwQG1.js (NEU)
```

### Schritt 3: Server-Cache leeren

```bash
ssh user@cert-watcher.de
sudo systemctl reload nginx
```

---

## 🔧 DEPLOYMENT - OPTION C: Via SCP (Terminal)

Von deinem lokalen Rechner:

```powershell
# Windows PowerShell:
cd "C:\Users\NGJARUIZ\OneDrive - GASAG\Redirected\Desktop\Jaciel Antonio Acea Ruiz\Zertifikat-Wächter"

# Upload dist/ Ordner:
scp -r frontend\dist\* user@cert-watcher.de:/var/www/html/
```

Dann auf Server Cache leeren:
```bash
ssh user@cert-watcher.de
sudo systemctl reload nginx
```

---

## ✅ NACH DEM DEPLOYMENT

### 1. Browser-Cache leeren
**WICHTIG:** Sonst lädt der Browser die alte Datei!

- **Strg + Shift + R** (Hard Reload)
- Oder **Inkognito-Modus** verwenden

### 2. Überprüfen ob neue Version läuft

Öffne https://cert-watcher.de/

**Drücke F12** → **Network** Tab → **Reload**

Suche nach:
```
✓ index-BEAKwQG1.js  ← NEUE VERSION (sollte geladen werden)
✗ index-BtA_hHzo.js  ← ALTE VERSION (sollte NICHT mehr da sein)
```

Falls die alte Version noch lädt:
- Browser-Cache leeren (Ctrl+Shift+R)
- Server-Cache prüfen

---

## 🧪 MFA JETZT TESTEN

### Schritt 1: Alte MFA-Faktoren löschen

**Supabase Dashboard:**
1. Gehe zu: https://supabase.com/dashboard/project/ethwkzwsxkhcexibuvwp
2. **Authentication** → **Users**
3. Klicke auf deinen User
4. **Factors** → Lösche alle alten TOTP-Faktoren
5. Speichern

**ODER in der App:**
- **Einstellungen** → **MFA deaktivieren** (falls aktiviert)
- **Abbrechen** klicken (falls Aktivierung läuft)

### Schritt 2: MFA neu aktivieren

1. **Einstellungen** öffnen
2. Scrolle zu **"Zwei-Faktor-Authentifizierung (TOTP)"**
3. Klicke **"MFA (TOTP) aktivieren"**
4. Warte auf QR-Code (1-2 Sekunden)

### Schritt 3: Mit Microsoft Authenticator scannen

**Öffne Microsoft Authenticator App:**
- Tippe auf **"+"**
- Wähle **"Andere (Google, Facebook usw.)"**
- **QR-Code scannen**

**Erwartetes Ergebnis:**
```
✅ Eintrag erscheint als: "Zertifikat-Wächter"
✅ Mit deiner E-Mail als Label
✅ KEIN "localhost" mehr!
```

### Schritt 4: Code eingeben

- Gib den 6-stelligen Code aus der App ein
- Klicke **"Aktivieren"**

**Erwartetes Ergebnis:**
```
✅ MFA (TOTP) aktiviert!
KEIN Fehler mehr!
```

### Schritt 5: Login testen

1. **Logout**
2. **Erneut einloggen**
3. Nach Passwort → MFA-Code wird verlangt
4. Code aus Microsoft Authenticator eingeben
5. ✅ **Login erfolgreich!**

---

## 🐛 Falls noch Fehler auftreten

### Browser Console öffnen (F12)

**Erwartete Logs (nach Fix):**
```javascript
✅ 📱 TOTP URI korrigiert: {
  original: "otpauth://totp/localhost:user@example.com?...",
  corrected: "otpauth://totp/Zertifikat-W%C3%A4chter:user@example.com?...",
  issuer: "Zertifikat-Wächter"
}

✅ 📱 TOTP QR-Code generiert: {
  issuer: "Zertifikat-Wächter",
  label: "user@example.com",
  secret_length: 32
}

✅ MFA erfolgreich aktiviert für Faktor: 42b2bbfa-f6c8-4fa2-9145-b7e90bb45773
```

**Diese Fehler sollten NICHT mehr erscheinen:**
```javascript
❌ Failed to verify MFA: AuthApiError: MFA factor with the provided challenge ID not found
❌ localhost in TOTP URI
```

---

## 📊 Checkliste

Vor dem Test:
- [ ] **Neuer Build deployed** (index-BEAKwQG1.js)
- [ ] **Server-Cache geleert** (nginx reload)
- [ ] **Browser-Cache geleert** (Ctrl+Shift+R)
- [ ] **Alte MFA-Faktoren gelöscht** (Supabase Dashboard)

Während des Tests:
- [ ] **QR-Code wird angezeigt**
- [ ] **"Zertifikat-Wächter" in Microsoft Authenticator** (nicht localhost)
- [ ] **Code-Verifizierung erfolgreich** (kein "challenge ID" Fehler)
- [ ] **"✅ MFA (TOTP) aktiviert!" Meldung**

Nach der Aktivierung:
- [ ] **Login mit MFA funktioniert**
- [ ] **Code aus Microsoft Authenticator wird akzeptiert**
- [ ] **Dashboard wird nach Login angezeigt**

---

## 🎉 SUCCESS!

Wenn alle Schritte funktionieren:
- ✅ MFA ist produktiv einsatzbereit
- ✅ Microsoft Authenticator zeigt korrekten Namen
- ✅ Keine "challenge ID not found" Fehler mehr
- ✅ Login funktioniert einwandfrei

---

**Deployment-Datum:** 20. Oktober 2025  
**Version:** 1.2 (Challenge-Fix + localhost-Ersetzung)  
**Git-Commit:** `1d3fab3`  
**Build-Datei:** `index-BEAKwQG1.js`

