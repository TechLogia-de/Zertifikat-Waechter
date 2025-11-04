# 🔐 Google Login Setup für Zertifikat-Wächter

Diese Anleitung zeigt dir, wie du Google OAuth Login für deinen Zertifikat-Wächter aktivierst.

## 📋 Übersicht

Mit Google Login können sich Benutzer mit ihrem Google-Account anmelden, ohne ein separates Passwort erstellen zu müssen. Das System erstellt automatisch einen Tenant für neue Google-User.

## 🚀 Schritt 1: Google Cloud Console Setup

### 1.1 Projekt erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Notiere dir die **Project ID**

### 1.2 OAuth Consent Screen konfigurieren

1. Navigiere zu **APIs & Services** → **OAuth consent screen**
2. Wähle **External** (für öffentliche Nutzung) oder **Internal** (nur für deine Organisation)
3. Fülle die Pflichtfelder aus:
   - **App name**: `Zertifikat-Wächter`
   - **User support email**: Deine E-Mail
   - **Developer contact**: Deine E-Mail
4. Klicke auf **Save and Continue**

### 1.3 OAuth Client erstellen

1. Gehe zu **APIs & Services** → **Credentials**
2. Klicke auf **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Wähle **Web application**
4. Konfiguriere:
   - **Name**: `Zertifikat-Wächter Web Client`
   - **Authorized JavaScript origins**:
     ```
     https://your-supabase-project.supabase.co
     http://localhost:54321
     ```
   - **Authorized redirect URIs**:
     ```
     https://your-supabase-project.supabase.co/auth/v1/callback
     http://localhost:54321/auth/v1/callback
     ```
5. Klicke auf **Create**
6. Notiere dir:
   - ✅ **Client ID** (sieht aus wie: `123456789-abc123xyz.apps.googleusercontent.com`)
   - ✅ **Client Secret** (sieht aus wie: `GOCSPX-abcd1234efgh5678`)

## ⚙️ Schritt 2: Supabase Konfiguration

### 2.1 In der Supabase Dashboard

1. Gehe zu deinem [Supabase Dashboard](https://app.supabase.com)
2. Wähle dein Projekt aus
3. Navigiere zu **Authentication** → **Providers**
4. Finde **Google** in der Liste
5. Aktiviere den Toggle
6. Füge deine Credentials ein:
   - **Client ID**: Dein Google Client ID
   - **Client Secret**: Dein Google Client Secret
7. **Authorized Client IDs** kannst du leer lassen
8. Klicke auf **Save**

### 2.2 Redirect URLs prüfen

In **Authentication** → **URL Configuration** sollten folgende URLs konfiguriert sein:

- **Site URL**: `https://deine-domain.de` oder `http://localhost:5173` für Entwicklung
- **Redirect URLs**:
  ```
  https://deine-domain.de
  http://localhost:5173
  ```

## 🔧 Schritt 3: Frontend Konfiguration (bereits erledigt)

Das Frontend ist bereits konfiguriert! Du musst nichts mehr tun. Der Google Login Button erscheint automatisch auf der Login-Seite.

### Was passiert automatisch?

1. ✅ **Google Login Button** wird auf der Login-Seite angezeigt
2. ✅ **OAuth Flow** wird von Supabase verwaltet
3. ✅ **Tenant Auto-Creation**: Wenn sich ein User über Google anmeldet und noch keinen Tenant hat, wird automatisch einer erstellt mit dem Namen: `[email]@[domain] Organisation`
4. ✅ **Membership**: User wird automatisch als `owner` des Tenants eingetragen
5. ✅ **Default Policy**: Standard-Benachrichtigungsrichtlinie wird erstellt

## 🧪 Schritt 4: Testen

### Lokal testen

1. Starte das Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Öffne [http://localhost:5173](http://localhost:5173)

3. Klicke auf **"Mit Google anmelden"**

4. Du wirst zu Google weitergeleitet → wähle deinen Account

5. Nach erfolgreicher Anmeldung wirst du zum Dashboard weitergeleitet

### Produktion testen

1. Stelle sicher, dass deine Domain in den Google OAuth Redirect URIs eingetragen ist

2. Deploy deine App

3. Teste den Login auf deiner Produktions-Domain

## 🔒 Sicherheit

### Was ist sicher?

✅ **Client ID ist öffentlich**: Kann im Frontend-Code stehen (wird automatisch von Supabase gehandhabt)

✅ **Supabase verwaltet Secrets**: Das Client Secret wird nur auf Supabase gespeichert, nie im Frontend

✅ **RLS Policies**: Row Level Security schützt Tenant-Daten automatisch

✅ **PKCE Flow**: Supabase nutzt PKCE für zusätzliche Sicherheit

### Best Practices

🔐 **Secrets Management**:
- Client Secret nur in Supabase Dashboard eingeben
- Nie Client Secret ins Git committen
- Nie Client Secret im Frontend-Code verwenden

🔐 **Redirect URIs**:
- Nur vertrauenswürdige Domains eintragen
- Wildcard-Domains vermeiden
- HTTP nur für localhost erlauben

## 🐛 Troubleshooting

### Problem: "Redirect URI mismatch"

**Lösung**:
1. Prüfe, ob die Redirect URI in Google OAuth Client exakt mit der Supabase URL übereinstimmt
2. Format: `https://[project-ref].supabase.co/auth/v1/callback`
3. Keine trailing slashes!

### Problem: "Access blocked: This app's request is invalid"

**Lösung**:
1. Prüfe OAuth Consent Screen Konfiguration
2. Stelle sicher, dass User support email und Developer contact ausgefüllt sind
3. Speichere die Änderungen

### Problem: User wird eingeloggt, aber hat keinen Tenant

**Lösung**:
1. Prüfe Browser Console auf Fehler
2. Prüfe Supabase RLS Policies für `tenants` und `memberships` Tabellen
3. Stelle sicher, dass der User Schreibrechte hat

### Problem: "Invalid client" Error

**Lösung**:
1. Client ID und Client Secret in Supabase Dashboard überprüfen
2. Neu eingeben und speichern
3. Cache leeren und erneut testen

## 📊 Monitoring

### Supabase Logs

In **Authentication** → **Logs** kannst du alle Login-Versuche sehen:
- Erfolgreiche Google Logins
- Fehlgeschlagene Versuche
- Token Refreshs

### Browser Console

Für Debugging öffne die Browser DevTools:
```javascript
// Aktuelle Session prüfen
const { data: { session } } = await supabase.auth.getSession()
console.log(session)

// User Metadaten
console.log(session?.user)
```

## 🎯 Zusammenfassung

### Was haben wir erreicht?

✅ Google OAuth Client in Google Cloud Console erstellt

✅ Supabase mit Google OAuth konfiguriert

✅ Frontend zeigt Google Login Button

✅ Automatische Tenant-Erstellung für neue Google-User

✅ Nahtlose Integration in bestehende Auth-Flow

### Nächste Schritte

- [ ] Weitere OAuth Provider hinzufügen (GitHub, Microsoft, etc.)
- [ ] Custom OAuth Scopes konfigurieren
- [ ] Branding im Google OAuth Screen anpassen
- [ ] Analytics für OAuth Logins einrichten

## 📚 Weiterführende Ressourcen

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)

---

**Bei Fragen oder Problemen**: Erstelle ein Issue auf GitHub oder kontaktiere den Support.

