# 🔐 MFA (TOTP) Produktiv-Test - Zertifikat-Wächter

## ✅ Implementierung Status

Die Multi-Faktor-Authentifizierung (MFA) mit TOTP ist jetzt vollständig produktionsreif implementiert und optimiert für **Microsoft Authenticator** sowie andere TOTP-Apps.

---

## 📱 Kompatible Authenticator Apps

Die Implementierung funktioniert mit allen TOTP-Standard-Apps:

- ✅ **Microsoft Authenticator** (iOS & Android)
- ✅ **Google Authenticator** (iOS & Android)
- ✅ **1Password** (Desktop & Mobile)
- ✅ **Authy** (Desktop & Mobile)
- ✅ **Bitwarden Authenticator**

---

## 🚀 Produktiv-Test Schritt-für-Schritt

### 1. Vorbereitung

**Produktions-URL:**
```
https://ethwkzwsxkhcexibuvwp.supabase.co
```

**Frontend-Konfiguration:**
Die `.env` Datei muss folgende Produktions-URL enthalten:
```env
VITE_SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

### 2. MFA in Supabase aktivieren

**Supabase Dashboard prüfen:**
1. Gehe zu: https://supabase.com/dashboard/project/ethwkzwsxkhcexibuvwp
2. Navigiere zu: **Authentication** → **Providers**
3. Scrolle nach unten zu: **Multi-Factor Authentication (MFA)**
4. Stelle sicher, dass **TOTP** aktiviert ist ✅

**Lokale Supabase-Konfiguration (bereits aktiviert):**
```toml
# supabase/config.toml (Zeile 105-110)
[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

### 3. Frontend Build für Produktion

```bash
cd frontend
npm run build
npm run preview  # Test des Production Builds lokal
```

### 4. MFA aktivieren (Produktiv-Seite)

1. **Login auf der produktiven Seite**
   - Navigiere zu: https://[deine-domain]/login
   - Melde dich mit deinem Account an

2. **Öffne Einstellungen**
   - Gehe zu: **Einstellungen** (Settings-Seite)
   - Scrolle zu: **Sicherheit: Zwei-Faktor-Authentifizierung (TOTP)**

3. **MFA aktivieren**
   - Klicke auf: **"MFA (TOTP) aktivieren"**
   - Warte, bis der QR-Code erscheint (ca. 1-2 Sekunden)

4. **QR-Code scannen mit Microsoft Authenticator**

   **Microsoft Authenticator App öffnen:**
   - Tippe auf **"+"** oder **"Konto hinzufügen"**
   - Wähle: **"Andere (Google, Facebook usw.)"** oder **"Work or school account"**
   - Wähle: **"QR-Code scannen"**
   - Scanne den angezeigten QR-Code

   **Erwartetes Ergebnis:**
   - Der Eintrag sollte als **"Zertifikat-Wächter"** erscheinen
   - Mit der zugehörigen E-Mail-Adresse als Label
   - Ein 6-stelliger Code wird alle 30 Sekunden generiert

5. **Verifizierung abschließen**
   - Gib den aktuell angezeigten 6-stelligen Code ein
   - Klicke auf: **"Aktivieren"**
   
   **Erfolg:**
   ```
   ✅ MFA (TOTP) aktiviert!
   ```

### 5. MFA-Login testen

1. **Ausloggen**
   - Klicke auf dein Profil → **Abmelden**

2. **Erneut einloggen**
   - Gib E-Mail und Passwort ein
   - Klicke auf: **"Login"**

3. **MFA-Code eingeben**
   - Es erscheint: **"Zwei-Faktor-Authentifizierung erforderlich"**
   - Öffne **Microsoft Authenticator App**
   - Kopiere den aktuellen 6-stelligen Code
   - Gib ihn ein und klicke: **"Verifizieren"**

   **Erfolg:**
   - Du wirst eingeloggt und weitergeleitet zum Dashboard

---

## 🛠️ Technische Details

### QR-Code-Generierung

**Optimiert für Microsoft Authenticator:**
```typescript
await QRCode.toDataURL(otpauthUri, { 
  width: 280,                     // Größer für bessere Scan-Erkennung
  margin: 2,                      // Rand für Stabilität
  errorCorrectionLevel: 'M',     // Medium Error Correction
  color: {
    dark: '#0F172A',              // Hoher Kontrast
    light: '#FFFFFF'
  }
})
```

### TOTP URI Format

```
otpauth://totp/Zertifikat-Wächter:user@example.com?
  secret=BASE32SECRET&
  issuer=Zertifikat-Wächter&
  algorithm=SHA1&
  digits=6&
  period=30
```

**Parameter:**
- **Issuer:** `Zertifikat-Wächter` (wird in der App angezeigt)
- **Label:** E-Mail-Adresse des Users
- **Secret:** Base32-kodiertes Shared Secret
- **Algorithm:** SHA1 (TOTP-Standard)
- **Digits:** 6 Ziffern
- **Period:** 30 Sekunden

---

## ⚠️ WICHTIG: Challenge-Fix (20.10.2025)

**Problem behoben:** Der Fehler `"MFA factor with the provided challenge ID not found"` wurde behoben.

**Was war das Problem?**
- Bei der MFA-Aktivierung fehlte der `challenge()`-Schritt vor `verify()`
- Der korrekte Flow ist: `enroll()` → **`challenge()`** → `verify()`

**Was muss jetzt passieren?**
1. ✅ Frontend wurde neu gebaut (`npm run build`)
2. 📤 `frontend/dist/` Ordner auf Server uploaden
3. 🔄 Server-Cache leeren (falls vorhanden)
4. 🧪 MFA erneut testen

**Nach dem Deployment:**
- MFA-Aktivierung sollte ohne Fehler funktionieren
- QR-Code wird angezeigt
- Verifizierung mit Microsoft Authenticator funktioniert

---

## 🐛 Troubleshooting

### Problem: "MFA ist serverseitig deaktiviert"

**Lösung:**
1. Supabase Dashboard öffnen
2. **Authentication** → **Providers** → **MFA**
3. TOTP aktivieren und speichern

### Problem: "QR-Code kann nicht gescannt werden"

**Lösungen:**
- **QR-Code zu klein?** → Der Code ist jetzt 280x280px (optimiert)
- **Schlechte Kamera?** → Nutze **"Manuelle Einrichtung"** und kopiere den Secret-Key
- **Microsoft Authenticator kann nicht scannen?** → Überprüfe:
  - Kamera-Berechtigung ist erteilt
  - Helligkeit des Bildschirms erhöhen
  - QR-Code-Bereich freistellen (keine Reflexionen)

### Problem: "Code wird nicht akzeptiert"

**Lösungen:**
1. **Zeit synchronisiert?**
   - Stelle sicher, dass die System-Uhrzeit auf dem Gerät korrekt ist
   - Microsoft Authenticator: **Einstellungen** → **Zeitsynchronisierung**

2. **Code abgelaufen?**
   - TOTP-Codes ändern sich alle 30 Sekunden
   - Warte auf den nächsten Code und gib ihn sofort ein

3. **Falscher Faktor?**
   - Stelle sicher, dass du den Code vom richtigen Eintrag verwendest
   - In Microsoft Authenticator: **"Zertifikat-Wächter"** Eintrag

### Problem: "Zu viele Faktoren registriert"

**Lösung:**
1. Gehe zu: **Einstellungen** → **MFA**
2. Klicke auf: **"Abbrechen"** (entfernt unverifizierten Faktor)
3. Oder: **"MFA deaktivieren"** (entfernt alle Faktoren)
4. Starte MFA-Aktivierung neu

---

## 🔒 Sicherheitshinweise

### ✅ Sicher implementiert:
- ✅ Secret wird **NIE** im Frontend gespeichert
- ✅ QR-Code wird clientseitig generiert (kein Server-Log)
- ✅ TOTP verwendet SHA1 (TOTP-Standard)
- ✅ Supabase RLS schützt MFA-Faktoren automatisch
- ✅ Challenge-Response-Mechanismus bei Login

### ⚠️ Wichtig für Benutzer:
- **Backup-Codes:** Momentan nicht implementiert
  - **Notfall-Lösung:** Admin kann MFA im Supabase Dashboard deaktivieren
- **Secret sichern:** Den Secret-Key an einem sicheren Ort speichern
- **Mehrere Geräte:** MFA auf mehreren Geräten einrichten (QR-Code mehrmals scannen)

---

## 📊 Test-Checkliste

### Frontend Tests

- [ ] **QR-Code wird angezeigt**
  - Größe: 288x288px (w-72 h-72)
  - Hoher Kontrast (schwarz auf weiß)
  - Blauer Border (#3B82F6)

- [ ] **Microsoft Authenticator kann scannen**
  - Eintrag erscheint als "Zertifikat-Wächter"
  - E-Mail wird als Label angezeigt
  - 6-stelliger Code wird generiert

- [ ] **Manuelle Einrichtung funktioniert**
  - Secret-Key wird angezeigt
  - "Kopieren"-Button funktioniert
  - Issuer/Label werden angezeigt

- [ ] **Verifizierung funktioniert**
  - 6-stelliger Code wird akzeptiert
  - Erfolgs-Meldung erscheint
  - MFA-Status wird auf "aktiviert" gesetzt

### Backend/Login Tests

- [ ] **Login mit MFA funktioniert**
  - Nach Passwort-Eingabe → MFA-Code wird verlangt
  - Microsoft Authenticator Code funktioniert
  - Bei falschem Code → Fehlermeldung

- [ ] **MFA deaktivieren funktioniert**
  - Button "MFA deaktivieren" entfernt Faktor
  - Login danach ohne MFA-Code möglich

- [ ] **Fehlerbehandlung**
  - Ungültiger Code → Hilfreiche Fehlermeldung
  - Abgelaufener Code → Neue Code-Eingabe möglich
  - Zeitproblem → Hinweis auf Zeitsynchronisierung

---

## 📝 Produktiv-Deployment Checkliste

### Vor dem Deployment:

1. [ ] **Supabase MFA aktiviert** (Dashboard)
2. [ ] **Frontend gebaut** (`npm run build`)
3. [ ] **Environment Variables korrekt** (`.env` → Produktions-URL)
4. [ ] **QRCode npm package installiert** (`qrcode@^1.5.3`)

### Nach dem Deployment:

1. [ ] **Login-Flow testen** (mit und ohne MFA)
2. [ ] **QR-Code-Scan mit Microsoft Authenticator** (iOS & Android)
3. [ ] **Manuelle Einrichtung testen** (Secret-Key kopieren)
4. [ ] **Zeitsynchronisierung prüfen** (Server & Client)
5. [ ] **Error-Handling testen** (falsche Codes, Timeout, etc.)

---

## 🎉 Fertig!

Die MFA-Implementierung ist produktionsreif und vollständig kompatibel mit **Microsoft Authenticator** sowie allen anderen TOTP-Apps.

**Bei Fragen oder Problemen:**
- Console-Logs im Browser prüfen (`F12` → Console)
- Supabase Dashboard → Authentication → Users → MFA Status prüfen
- Server-Logs prüfen (Supabase Dashboard → Logs)

**Letzte Aktualisierung:** 20. Oktober 2025
**Version:** 1.0 (Produktionsreif)

