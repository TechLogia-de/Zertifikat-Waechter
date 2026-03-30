import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDateTime, formatDate, formatRelativeTime } from '../dateUtils'

describe('formatDateTime', () => {
  it('formats an ISO date string to German datetime string', () => {
    // March 1, 2026, 14:30 UTC
    const result = formatDateTime('2026-03-01T14:30:00Z')

    // Should contain the date parts in German format (dd.mm.yyyy)
    expect(result).toContain('01.03.2026')
    // Should contain time component
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('returns "Nie" for null input', () => {
    const result = formatDateTime(null)
    expect(result).toBe('Nie')
  })
})

describe('formatDate', () => {
  it('formats an ISO string to German date string', () => {
    // Use a midday time to avoid timezone date-shift issues
    const result = formatDate('2026-01-05T12:00:00Z')
    expect(result).toBe('05.01.2026')
  })

  it('formats another ISO string to German date string', () => {
    const result = formatDate('2026-12-25T12:00:00Z')
    expect(result).toBe('25.12.2026')
  })

  it('returns "Nie" for null input', () => {
    const result = formatDate(null)
    expect(result).toBe('Nie')
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Gerade eben" for very recent times', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:10Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('Gerade eben')
  })

  it('returns seconds for times under 1 minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:45Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('vor 45 Sek')
  })

  it('returns minutes for times under 1 hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:15:00Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('vor 15 Min')
  })

  it('returns hours for times under 1 day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T15:00:00Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('vor 3 Std')
  })

  it('returns singular day for 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('vor 1 Tag')
  })

  it('returns plural days for multiple days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    expect(result).toBe('vor 3 Tagen')
  })

  it('falls back to formatted date for times older than 7 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'))

    const result = formatRelativeTime('2026-03-30T12:00:00Z')
    // Should fall back to formatDate which returns German date format
    expect(result).toBe('30.03.2026')
  })
})
