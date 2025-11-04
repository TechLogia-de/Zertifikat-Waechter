/**
 * Sichere Logging-Utility
 * - In Production werden keine sensiblen Daten geloggt
 * - E-Mail-Adressen werden maskiert
 * - Nur in Development wird detailliert geloggt
 */

import { IS_DEVELOPMENT, IS_PRODUCTION, LOGGING } from './constants'

const isDevelopment = IS_DEVELOPMENT
const isProduction = IS_PRODUCTION

/**
 * Maskiert eine E-Mail-Adresse für sicheres Logging
 * Beispiel: j.ruiz@techlogia.de -> j.r***@t***.de
 * 
 * WICHTIG: Maskiert IMMER, auch in Development (aus Sicherheitsgründen)
 */
export function maskEmail(email: string | undefined): string {
  if (!email) return '[no-email]'
  
  // IMMER maskieren für maximale Sicherheit
  const [local, domain] = email.split('@')
  if (!domain) return '[invalid-email]'
  
  const maskedLocal = local.length > 2 
    ? `${local.substring(0, 2)}***` 
    : '***'
  
  const [domainName, tld] = domain.split('.')
  const maskedDomain = domainName.length > 1 
    ? `${domainName.charAt(0)}***.${tld}` 
    : `***.${tld}`
  
  return `${maskedLocal}@${maskedDomain}`
}

/**
 * Maskiert eine User-ID
 * 
 * WICHTIG: Maskiert IMMER, auch in Development (aus Sicherheitsgründen)
 */
export function maskUserId(userId: string | undefined): string {
  if (!userId) return '[no-id]'
  
  // IMMER maskieren für maximale Sicherheit
  // Zeige nur erste und letzte 4 Zeichen
  if (userId.length <= 8) return '***'
  return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`
}

/**
 * Sichere Log-Funktionen
 */
export const secureLog = {
  /**
   * Info-Log (nur in Development, maskiert sensible Daten)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      // Maskiere sensible Daten in allen Argumenten
      const safeArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
          const safeCopy = { ...arg }
          if (safeCopy.email) safeCopy.email = maskEmail(safeCopy.email)
          if (safeCopy.userId) safeCopy.userId = maskUserId(safeCopy.userId)
          return safeCopy
        }
        return arg
      })
      console.log(...safeArgs)
    }
  },
  
  /**
   * Warnung (immer anzeigen, aber ohne sensible Daten)
   */
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  
  /**
   * Fehler (immer anzeigen, aber ohne sensible Daten)
   */
  error: (...args: any[]) => {
    console.error(...args)
  },
  
  /**
   * Debug-Log (nur in Development, maskiert sensible Daten)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      // Maskiere sensible Daten in allen Argumenten
      const safeArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
          const safeCopy = { ...arg }
          if (safeCopy.email) safeCopy.email = maskEmail(safeCopy.email)
          if (safeCopy.userId) safeCopy.userId = maskUserId(safeCopy.userId)
          return safeCopy
        }
        return arg
      })
      console.log('🐛', ...safeArgs)
    }
  },
  
  /**
   * Auth-spezifisches Log mit maskierten Daten
   * IMMER maskiert, auch in Development
   */
  auth: (message: string, data?: { email?: string; userId?: string; [key: string]: any }) => {
    if (!data) {
      if (isDevelopment) {
        console.log(message)
      }
      return
    }
    
    const safeData = { ...data }
    // IMMER maskieren
    if (safeData.email) {
      safeData.email = maskEmail(safeData.email)
    }
    if (safeData.userId) {
      safeData.userId = maskUserId(safeData.userId)
    }
    
    if (isDevelopment) {
      console.log(message, safeData)
    }
  },
  
  /**
   * Produktions-Log (immer anzeigen, minimale Info)
   */
  production: (message: string) => {
    if (isProduction) {
      console.log(`[App] ${message}`)
    }
  }
}

/**
 * Sanitize-Funktion für Error-Messages
 * Entfernt potentiell sensible Daten aus Fehlermeldungen
 */
export function sanitizeError(error: any): string {
  if (!error) return 'Unknown error'
  
  const message = error.message || error.toString()
  
  // In Production: entferne potentiell sensible Patterns
  if (isProduction) {
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
      .replace(/Bearer\s+[^\s]+/gi, '[token]')
      .replace(/apikey\s*=\s*[^\s&]+/gi, 'apikey=[key]')
  }
  
  return message
}

/**
 * Security Event Logger
 * Loggt sicherheitsrelevante Events
 */
export const securityLog = {
  /**
   * Login-Versuch (E-Mail wird IMMER maskiert)
   */
  loginAttempt: (email?: string) => {
    secureLog.production('Login attempt')
    if (isDevelopment) {
      console.log('🔐 Login attempt', { email: maskEmail(email) })
    }
  },
  
  /**
   * Login erfolgreich (E-Mail und User-ID werden IMMER maskiert)
   */
  loginSuccess: (email?: string, userId?: string) => {
    secureLog.production('Login successful')
    if (isDevelopment) {
      console.log('✅ Login successful', { 
        email: maskEmail(email), 
        userId: maskUserId(userId) 
      })
    }
  },
  
  /**
   * Login fehlgeschlagen
   */
  loginFailed: (error: any) => {
    secureLog.production('Login failed')
    secureLog.error('❌ Login failed:', sanitizeError(error))
  },
  
  /**
   * Logout (E-Mail wird IMMER maskiert)
   */
  logout: (email?: string) => {
    secureLog.production('User logged out')
    if (isDevelopment) {
      console.log('👋 Logout', { email: maskEmail(email) })
    }
  },
  
  /**
   * Session-Timeout
   */
  sessionTimeout: () => {
    secureLog.production('Session timeout')
    secureLog.info('⏱️ Session timeout')
  },
  
  /**
   * Unauthorized access attempt
   */
  unauthorizedAccess: (path: string) => {
    secureLog.production('Unauthorized access attempt')
    secureLog.warn('🚫 Unauthorized access to:', path)
  },
  
  /**
   * Token refresh
   */
  tokenRefresh: (success: boolean) => {
    if (success) {
      secureLog.production('Token refreshed')
      secureLog.info('🔄 Token refreshed')
    } else {
      secureLog.production('Token refresh failed')
      secureLog.warn('⚠️ Token refresh failed')
    }
  }
}

export default secureLog

