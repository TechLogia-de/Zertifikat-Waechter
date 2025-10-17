// Zentrale Datum/Zeit-Utilities für konsistente Formatierung
// Alle Zeiten in DB sind UTC, Frontend zeigt lokale Zeit

/**
 * Formatiert Datum + Zeit in deutscher Locale
 * @param dateString ISO 8601 String (UTC aus DB)
 * @returns "17.10.2025, 13:45:30" (lokale Zeit)
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'Nie'
  
  const date = new Date(dateString)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Formatiert nur Datum (ohne Zeit)
 * @param dateString ISO 8601 String
 * @returns "17.10.2025"
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Nie'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Formatiert nur Zeit
 * @param dateString ISO 8601 String
 * @returns "13:45:30"
 */
export function formatTime(dateString: string | null): string {
  if (!dateString) return '--:--:--'
  
  const date = new Date(dateString)
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Relative Zeit (vor X Minuten)
 * @param dateString ISO 8601 String
 * @returns "vor 5 Min" oder "Gerade eben"
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Noch nie'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 30) return 'Gerade eben'
  if (diffSec < 60) return `vor ${diffSec} Sek`
  if (diffMin < 60) return `vor ${diffMin} Min`
  if (diffHour < 24) return `vor ${diffHour} Std`
  if (diffDay < 7) return `vor ${diffDay} Tag${diffDay !== 1 ? 'en' : ''}`
  
  // Älter als 7 Tage → zeige Datum
  return formatDate(dateString)
}

/**
 * Tage bis Datum
 * @param dateString ISO 8601 String
 * @returns Anzahl Tage (negativ wenn abgelaufen)
 */
export function getDaysUntil(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Formatiert Tage bis Ablauf
 * @param dateString ISO 8601 String
 * @returns "in 45 Tagen" oder "Abgelaufen"
 */
export function formatDaysUntil(dateString: string): string {
  const days = getDaysUntil(dateString)
  
  if (days < 0) return `Abgelaufen (vor ${Math.abs(days)} Tagen)`
  if (days === 0) return 'Läuft heute ab!'
  if (days === 1) return 'Läuft morgen ab!'
  if (days < 30) return `in ${days} Tagen`
  
  const months = Math.floor(days / 30)
  if (months < 12) return `in ~${months} Monat${months !== 1 ? 'en' : ''}`
  
  const years = Math.floor(days / 365)
  return `in ~${years} Jahr${years !== 1 ? 'en' : ''}`
}

/**
 * Zeitstempel für Logs (mit Millisekunden)
 * @param dateString ISO 8601 String
 * @returns "13:45:30.123"
 */
export function formatLogTime(dateString: string): string {
  const date = new Date(dateString)
  const time = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${time}.${ms}`
}

/**
 * Prüft ob Datum in der Zukunft liegt
 */
export function isFuture(dateString: string): boolean {
  return new Date(dateString).getTime() > Date.now()
}

/**
 * Prüft ob Datum in der Vergangenheit liegt
 */
export function isPast(dateString: string): boolean {
  return new Date(dateString).getTime() < Date.now()
}

/**
 * Konvertiert lokale Zeit zu UTC (für API-Requests)
 */
export function toUTC(date: Date): string {
  return date.toISOString()
}

/**
 * Jetzt als UTC String
 */
export function nowUTC(): string {
  return new Date().toISOString()
}

