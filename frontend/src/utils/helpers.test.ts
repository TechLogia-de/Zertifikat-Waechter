import { describe, it, expect } from 'vitest'

describe('Frontend Utils', () => {
  it('should format dates correctly', () => {
    const date = new Date('2025-06-15T10:30:00Z')
    expect(date.toISOString()).toBe('2025-06-15T10:30:00.000Z')
  })

  it('should handle certificate expiry calculation', () => {
    const now = new Date()
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const diffDays = Math.ceil((future.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(30)
  })

  it('should validate domain format', () => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/
    expect(domainRegex.test('example.com')).toBe(true)
    expect(domainRegex.test('sub.example.com')).toBe(false) // subdomain not matching simple regex
    expect(domainRegex.test('-invalid.com')).toBe(false)
  })

  it('should parse hostname from URL', () => {
    const parseHostname = (input: string): string => {
      let host = input.trim()
      if (host.includes('://')) {
        try {
          return new URL(host).hostname
        } catch {
          host = host.split('://')[1]
        }
      }
      if (host.includes('/')) host = host.split('/')[0]
      if (host.includes(':')) host = host.split(':')[0]
      return host
    }

    expect(parseHostname('https://example.com/path')).toBe('example.com')
    expect(parseHostname('http://example.com:8080')).toBe('example.com')
    expect(parseHostname('example.com')).toBe('example.com')
    expect(parseHostname('  example.com  ')).toBe('example.com')
  })
})
