// Standardized date/time formatting utilities with German locale.
// Accepts both Date objects and ISO date strings.
// These can be adopted incrementally across the codebase.

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date
}

/**
 * Full datetime format: "01.03.2026, 14:30"
 */
export function formatDateTime(date: string | Date): string {
  const d = toDate(date)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Date-only format: "01.03.2026"
 */
export function formatDate(date: string | Date): string {
  const d = toDate(date)
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * German relative time: "vor 5 Min", "vor 2 Std", "vor 3 Tagen", etc.
 * Falls back to formatted date for anything older than 7 days.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = toDate(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 30) return 'Gerade eben'
  if (diffSec < 60) return `vor ${diffSec} Sek`
  if (diffMin < 60) return `vor ${diffMin} Min`
  if (diffHour < 24) return `vor ${diffHour} Std`
  if (diffDay < 7) return `vor ${diffDay} Tag${diffDay !== 1 ? 'en' : ''}`

  // Older than 7 days: show the formatted date
  return formatDate(d)
}
