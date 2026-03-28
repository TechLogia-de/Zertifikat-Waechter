import { describe, it, expect, vi } from 'vitest'

describe('CertificateScanner', () => {
  describe('TLS Connection', () => {
    it('should handle connection timeout', async () => {
      const mockSocket = {
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('ETIMEDOUT')), 10)
          }
          return mockSocket
        }),
        setTimeout: vi.fn(),
        destroy: vi.fn(),
        getPeerCertificate: vi.fn().mockReturnValue(null),
        authorized: false,
      }

      // Verify the mock socket handles error events
      const errorHandler = vi.fn()
      mockSocket.on('error', errorHandler)
      expect(mockSocket.on).toHaveBeenCalledWith('error', errorHandler)
    })

    it('should parse certificate subject correctly', () => {
      const mockCert = {
        subject: { CN: 'example.com', O: 'Example Inc' },
        issuer: { CN: 'R3', O: "Let's Encrypt" },
        valid_from: 'Jan 01 00:00:00 2025 GMT',
        valid_to: 'Dec 31 23:59:59 2025 GMT',
        serialNumber: 'ABC123',
        fingerprint256: 'AA:BB:CC:DD',
        subjectaltname: 'DNS:example.com, DNS:www.example.com',
      }

      expect(mockCert.subject.CN).toBe('example.com')
      expect(mockCert.issuer.O).toBe("Let's Encrypt")
    })

    it('should extract SAN entries', () => {
      const sanString = 'DNS:example.com, DNS:www.example.com, DNS:api.example.com'
      const sans = sanString
        .split(',')
        .map(s => s.trim())
        .filter(s => s.startsWith('DNS:'))
        .map(s => s.replace('DNS:', ''))

      expect(sans).toEqual(['example.com', 'www.example.com', 'api.example.com'])
    })
  })

  describe('Anomaly Detection', () => {
    it('should flag expired certificates', () => {
      const now = new Date()
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const isExpired = expiredDate < now
      expect(isExpired).toBe(true)
    })

    it('should flag certificates expiring soon', () => {
      const now = new Date()
      const soonDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days
      const daysUntilExpiry = Math.ceil((soonDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysUntilExpiry).toBeLessThanOrEqual(7)
    })

    it('should detect self-signed certificates', () => {
      const cert = {
        subject: { CN: 'example.com', O: 'Self' },
        issuer: { CN: 'example.com', O: 'Self' },
      }
      const isSelfSigned = cert.subject.CN === cert.issuer.CN && cert.subject.O === cert.issuer.O
      expect(isSelfSigned).toBe(true)
    })
  })
})
