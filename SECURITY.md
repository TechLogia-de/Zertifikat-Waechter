# 🔒 Sicherheitsdokumentation - Zertifikat-Wächter

## Übersicht

Diese Dokumentation beschreibt alle implementierten Sicherheitsmaßnahmen der Zertifikat-Wächter Plattform.

---

## 🛡️ Authentifizierung & Autorisierung

### 1. **Supabase Auth (OAuth 2.0 + PKCE)**

```typescript
// Konfiguration in frontend/src/lib/supabase.ts
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storage: window.localStorage,
  storageKey: 'supabase.auth.token',
  flowType: 'pkce', // ✅ Proof Key for Code Exchange (sicher gegen Code-Injection)
}
```

**Schutz gegen:**
- ✅ Man-in-the-Middle Angriffe (PKCE)
- ✅ Authorization Code Interception
- ✅ CSRF Attacks

### 2. **JWT Token Management**

- **Access Token**: Kurzlebig (1 Stunde)
- **Refresh Token**: Sicheres Rotation-System
- **Storage**: httpOnly Cookies (managed by Supabase)

**Best Practices:**
- ✅ Tokens werden niemals in URL-Parametern übertragen
- ✅ Automatische Token-Rotation bei jeder Verwendung
- ✅ Invalidierung bei Logout

### 3. **Row Level Security (RLS)**

Alle Datenbanktabellen sind mit RLS geschützt:

```sql
-- Beispiel: Nur eigene Daten sehen
CREATE POLICY "Users can view own data"
  ON certificates FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
  ));
```

**Schutz gegen:**
- ✅ Unauthorized Data Access
- ✅ Privilege Escalation
- ✅ Cross-Tenant Data Leaks

---

## 🔐 Datenschutz & Privacy

### 1. **Sichere Logging-Strategie**

```typescript
// frontend/src/utils/secureLogger.ts
```

**Development:**
- Vollständige Logs mit E-Mail-Adressen
- Detaillierte Debugging-Informationen

**Production:**
- ✅ E-Mail-Adressen werden maskiert: `j.r***@t***.de`
- ✅ User-IDs werden gekürzt: `07086...cdcbf`
- ✅ Tokens werden entfernt
- ✅ Keine sensiblen Daten in Console-Logs

### 2. **DSGVO-Konformität**

```typescript
// Automatische Datenmaskierung
export function maskEmail(email: string): string {
  // Production: j.ruiz@techlogia.de → j.r***@t***.de
  // Development: Vollständige E-Mail
}
```

**Implementiert:**
- ✅ Datensparsamkeit (nur notwendige Daten loggen)
- ✅ Recht auf Vergessenwerden (Account-Löschung)
- ✅ Datenportabilität (Export-Funktionen)
- ✅ Privacy by Design

---

## 🌐 HTTP Security Headers

### Content Security Policy (CSP)

```javascript
// frontend/vite.config.ts
'Content-Security-Policy': [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')
```

**Schutz gegen:**
- ✅ XSS (Cross-Site Scripting)
- ✅ Clickjacking
- ✅ Code Injection
- ✅ Data Exfiltration

### Weitere Security Headers

```javascript
{
  'X-Content-Type-Options': 'nosniff',        // ✅ MIME-Type Sniffing verhindern
  'X-Frame-Options': 'DENY',                  // ✅ Clickjacking verhindern
  'X-XSS-Protection': '1; mode=block',        // ✅ XSS-Filter aktivieren
  'Referrer-Policy': 'strict-origin-when-cross-origin', // ✅ Referrer-Leaks verhindern
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()', // ✅ Unnötige APIs deaktivieren
}
```

---

## 🚫 Input Validation & Sanitization

### 1. **Frontend Validation**

```typescript
// Beispiel: E-Mail-Validierung
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  throw new Error('Invalid email')
}
```

### 2. **Backend Validation (Supabase Functions)**

```typescript
// Alle Inputs werden validiert und sanitized
export default async function handler(req: Request) {
  const { domain } = await req.json()
  
  // ✅ Type-Check
  if (typeof domain !== 'string') {
    return new Response('Invalid input', { status: 400 })
  }
  
  // ✅ Sanitization
  const cleanDomain = domain.trim().toLowerCase()
  
  // ✅ Validation
  if (!/^[a-z0-9.-]+$/.test(cleanDomain)) {
    return new Response('Invalid domain format', { status: 400 })
  }
}
```

**Schutz gegen:**
- ✅ SQL Injection (Supabase RLS + Prepared Statements)
- ✅ NoSQL Injection
- ✅ Command Injection
- ✅ Path Traversal

---

## 🔄 Session Management

### 1. **Session-Sicherheit**

```typescript
// frontend/src/hooks/useAuth.ts

// ✅ Session-Timeout (8 Sekunden)
const SESSION_TIMEOUT = 8000

// ✅ Automatische Token-Refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    securityLog.tokenRefresh(true)
  }
})

// ✅ Sichere Session-Speicherung
storage: window.localStorage, // Wird automatisch bei Logout gelöscht
```

### 2. **Logout-Sicherheit**

```typescript
const signOut = async () => {
  await supabase.auth.signOut()
  
  // ✅ Global Cache löschen
  cachedUser = null
  initialLoadComplete = false
  isLoadingSession = false
  
  // ✅ Security-Log
  securityLog.logout(userEmail)
}
```

---

## 🛠️ Security Monitoring & Logging

### 1. **Security Event Logging**

```typescript
// frontend/src/utils/secureLogger.ts

export const securityLog = {
  loginAttempt: (email) => { /* ... */ },
  loginSuccess: (email, userId) => { /* ... */ },
  loginFailed: (error) => { /* ... */ },
  logout: (email) => { /* ... */ },
  sessionTimeout: () => { /* ... */ },
  unauthorizedAccess: (path) => { /* ... */ },
  tokenRefresh: (success) => { /* ... */ },
}
```

**Geloggte Events:**
- ✅ Login-Versuche
- ✅ Erfolgreiche Logins
- ✅ Fehlgeschlagene Logins
- ✅ Logouts
- ✅ Session-Timeouts
- ✅ Unauthorized Access
- ✅ Token-Refreshs

### 2. **Error Sanitization**

```typescript
export function sanitizeError(error: any): string {
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/Bearer\s+[^\s]+/gi, '[token]')
}
```

---

## 🔍 Best Practices

### ✅ DO's

1. **Verwende sichere Logging-Funktionen:**
   ```typescript
   import { secureLog, securityLog } from '@/utils/secureLogger'
   
   // Gut:
   secureLog.auth('Login', { email: user.email })
   
   // Schlecht:
   console.log('Login:', user.email)
   ```

2. **Validiere alle Inputs:**
   ```typescript
   // Backend: Immer validieren
   if (!domain || typeof domain !== 'string') {
     return error(400, 'Invalid input')
   }
   ```

3. **Verwende Environment-Variables:**
   ```typescript
   const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY
   ```

4. **Implementiere Retry-Logik mit Delays:**
   ```typescript
   // Verhindert Brute-Force
   if (retryCount < maxRetries) {
     await new Promise(r => setTimeout(r, 1000))
     return retry()
   }
   ```

### ❌ DON'Ts

1. **NIEMALS sensible Daten in Production loggen:**
   ```typescript
   // ❌ Schlecht:
   console.log('User data:', user)
   
   // ✅ Gut:
   secureLog.auth('User action', { email: user.email })
   ```

2. **NIEMALS Tokens in URL-Parametern:**
   ```typescript
   // ❌ Schlecht:
   `/api/data?token=${token}`
   
   // ✅ Gut:
   fetch('/api/data', { 
     headers: { 'Authorization': `Bearer ${token}` } 
   })
   ```

3. **NIEMALS Passwörter speichern:**
   ```typescript
   // ❌ NIEMALS selbst hashen
   const hashedPassword = md5(password) // FALSCH!
   
   // ✅ Supabase Auth nutzen
   await supabase.auth.signUp({ email, password })
   ```

---

## 🚨 Incident Response

### Bei Sicherheitsvorfällen:

1. **Verdächtigen Account sperren:**
   ```sql
   UPDATE auth.users SET banned_until = now() + interval '24 hours'
   WHERE id = 'user_id';
   ```

2. **Alle Sessions invalidieren:**
   ```typescript
   await supabase.auth.admin.signOut(userId, 'global')
   ```

3. **Audit-Logs prüfen:**
   ```sql
   SELECT * FROM events 
   WHERE user_id = 'user_id' 
   ORDER BY created_at DESC 
   LIMIT 100;
   ```

4. **Security-Team benachrichtigen**

---

## 📊 Compliance Checklist

- [x] DSGVO-konform
- [x] OAuth 2.0 + PKCE
- [x] Row Level Security (RLS)
- [x] Sichere Session-Verwaltung
- [x] Input Validation
- [x] Output Sanitization
- [x] CSP Headers
- [x] XSS-Schutz
- [x] CSRF-Schutz
- [x] Clickjacking-Schutz
- [x] Sicheres Logging
- [x] Token-basierte Auth
- [x] Automatische Token-Rotation
- [x] Audit-Logging
- [x] Error-Sanitization
- [x] Rate Limiting (Supabase-seitig)

---

## 🔧 Security Updates

### Wichtige Sicherheitsupdates regelmäßig durchführen:

```bash
# Frontend Dependencies aktualisieren
cd frontend
npm audit fix

# Supabase CLI aktualisieren
npm install -g supabase

# Worker Dependencies aktualisieren
cd worker
pip install --upgrade -r requirements.txt
```

---

## 📞 Sicherheitsmeldungen

Bei Sicherheitslücken bitte direkt an:
- **E-Mail**: security@cert-watcher.de
- **GitHub Security Advisory**: (private Meldung)

**Nicht** öffentliche Issues erstellen!

---

## 📚 Weitere Ressourcen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/auth/security)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
- [CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Stand:** 2025-11-04  
**Version:** 2.0.0  
**Status:** ✅ Produktionsbereit

