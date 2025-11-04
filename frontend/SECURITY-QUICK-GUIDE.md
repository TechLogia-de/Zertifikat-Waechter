# 🔒 Security Quick Guide

## ✅ Sichere Code-Beispiele

### 1. Logging (WICHTIG!)

```typescript
// ❌ FALSCH - E-Mail-Adresse direkt geloggt
console.log('User logged in:', user.email)

// ✅ RICHTIG - Verwende secureLog
import { secureLog, securityLog } from '@/utils/secureLogger'

securityLog.loginSuccess(user.email, user.id)
// Production Output: "Login successful" (Email maskiert)
// Development Output: "✅ Login successful" {email: "j.ruiz@techlogia.de"}
```

### 2. Auth-Events

```typescript
// ✅ Verwende die security logger
import { securityLog } from '@/utils/secureLogger'

// Login
securityLog.loginAttempt(email)
securityLog.loginSuccess(email, userId)
securityLog.loginFailed(error)

// Logout
securityLog.logout(email)

// Session
securityLog.sessionTimeout()
securityLog.tokenRefresh(success)

// Unauthorized Access
securityLog.unauthorizedAccess(path)
```

### 3. Error Handling

```typescript
import { sanitizeError } from '@/utils/secureLogger'

try {
  await someOperation()
} catch (error) {
  // ✅ Sanitize errors before logging
  secureLog.error('Operation failed:', sanitizeError(error))
}
```

### 4. Input Validation

```typescript
import { VALIDATION } from '@/utils/constants'

// Email
if (!VALIDATION.EMAIL.test(email)) {
  throw new Error('Invalid email format')
}

// Domain
if (!VALIDATION.DOMAIN.test(domain)) {
  throw new Error('Invalid domain format')
}

// Port
if (!VALIDATION.PORT.test(port)) {
  throw new Error('Invalid port')
}
```

## 🚫 Was Sie NIEMALS tun sollten

### ❌ 1. Sensible Daten direkt loggen

```typescript
// NIEMALS!
console.log(user)
console.log(session.access_token)
console.log(apiKey)
```

### ❌ 2. Tokens in URLs

```typescript
// NIEMALS!
fetch(`/api/data?token=${accessToken}`)

// ✅ Richtig:
fetch('/api/data', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
```

### ❌ 3. Passwörter speichern

```typescript
// NIEMALS selbst hashen oder speichern!
localStorage.setItem('password', password)
const hashed = md5(password)

// ✅ Richtig: Supabase Auth nutzen
await supabase.auth.signUp({ email, password })
```

### ❌ 4. XSS-anfälliger Code

```typescript
// NIEMALS!
element.innerHTML = userInput

// ✅ Richtig:
element.textContent = userInput
// oder React (escaped automatisch):
<div>{userInput}</div>
```

## 🔐 Production Checklist

### Vor jedem Deployment:

- [ ] Alle `console.log()` durch `secureLog` ersetzt
- [ ] Keine Secrets in `.env` committed
- [ ] `npm audit` durchgeführt
- [ ] CSP-Headers konfiguriert
- [ ] RLS-Policies getestet
- [ ] Input-Validation implementiert
- [ ] Error-Handling mit Sanitization
- [ ] HTTPS enforced
- [ ] Security-Headers gesetzt

## 📊 Environment-spezifisches Verhalten

### Development (`npm run dev`)
- ✅ Vollständige Logs mit E-Mails
- ✅ Detailliertes Debugging
- ✅ Stack Traces
- ✅ Console-Warnings

### Production (`npm run build`)
- ✅ E-Mails maskiert: `j.r***@t***.de`
- ✅ User-IDs gekürzt: `0708...cdcbf`
- ✅ Minimale Logs
- ✅ Keine sensiblen Daten

## 🛡️ Bereits implementierte Sicherheit

### Automatisch geschützt durch:
- ✅ OAuth 2.0 + PKCE
- ✅ Row Level Security (RLS)
- ✅ JWT Token-basierte Auth
- ✅ Automatische Token-Rotation
- ✅ CSP Headers
- ✅ XSS-Schutz
- ✅ CSRF-Schutz
- ✅ Clickjacking-Schutz
- ✅ SQL Injection Prevention (Supabase)
- ✅ Rate Limiting (Supabase)

## 📱 Import-Übersicht

```typescript
// Logging
import { secureLog, securityLog, maskEmail, maskUserId, sanitizeError } from '@/utils/secureLogger'

// Constants
import { IS_DEVELOPMENT, IS_PRODUCTION, SECURITY, VALIDATION } from '@/utils/constants'

// Supabase (bereits sicher konfiguriert)
import { supabase } from '@/lib/supabase'
```

## 🔄 Testing

```bash
# Development
npm run dev

# Test Console-Output:
# - E-Mails vollständig sichtbar ✅
# - Detaillierte Logs ✅

# Production Build
npm run build
npm run preview

# Test Console-Output:
# - E-Mails maskiert ✅
# - Minimale Logs ✅
```

## 📞 Bei Sicherheitsproblemen

1. **Sofort melden** an: security@cert-watcher.de
2. **Nicht** öffentlich posten
3. Beschreibung + Reproduktion schicken
4. Patch wird priorisiert

---

**Hinweis:** Vollständige Dokumentation in `SECURITY.md`

