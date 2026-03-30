import tls from 'tls';
import dns from 'dns/promises';
import net from 'net';
import { ScanResult, CertificateInfo, CertificateChain, AnomalyCheckResult } from '../types/index.js';

// SSRF protection: block private, loopback, link-local, and metadata IPs
const BLOCKED_IP_RANGES = [
  /^127\./,                    // Loopback
  /^0\./,                      // Current network
  /^10\./,                     // RFC 1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918 Class B
  /^192\.168\./,               // RFC 1918 Class C
  /^169\.254\./,               // Link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGN (RFC 6598)
  /^::1$/,                     // IPv6 loopback
  /^fe80:/i,                   // IPv6 link-local
  /^fc00:/i,                   // IPv6 ULA
  /^fd/i,                      // IPv6 ULA
  /^ff/i,                      // IPv6 multicast
  /^::$/,                      // IPv6 unspecified
  /^::ffff:127\./,             // IPv4-mapped loopback
  /^::ffff:10\./,              // IPv4-mapped private
  /^::ffff:192\.168\./,        // IPv4-mapped private
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./, // IPv4-mapped private
];

function isBlockedIP(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(pattern => pattern.test(ip));
}

// Validate hostname format (domain or IP)
const VALID_HOST_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;

function isValidHost(host: string): boolean {
  // Allow valid IPs
  if (net.isIP(host)) return true;
  // Allow valid hostnames
  if (host.length > 253) return false;
  return VALID_HOST_REGEX.test(host);
}

export class CertificateScanner {

  // Resolve host and check for SSRF before connecting
  private async validateHost(host: string): Promise<void> {
    if (!isValidHost(host)) {
      throw new Error('Ungültiger Hostname');
    }

    // If it's a direct IP, check immediately
    if (net.isIP(host)) {
      if (isBlockedIP(host)) {
        throw new Error('Zugriff auf interne/private Adressen ist nicht erlaubt');
      }
      return;
    }

    // Resolve DNS and check all resolved IPs
    try {
      const addresses = await dns.resolve4(host).catch(() => [] as string[]);
      const addresses6 = await dns.resolve6(host).catch(() => [] as string[]);
      const allAddresses = [...addresses, ...addresses6];

      if (allAddresses.length === 0) {
        throw new Error('Hostname konnte nicht aufgelöst werden');
      }

      for (const ip of allAddresses) {
        if (isBlockedIP(ip)) {
          throw new Error('Zugriff auf interne/private Adressen ist nicht erlaubt');
        }
      }
    } catch (err: any) {
      if (err.message.includes('interne/private') || err.message.includes('aufgelöst')) {
        throw err;
      }
      throw new Error('DNS-Auflösung fehlgeschlagen');
    }
  }

  async scanHost(host: string, port: number = 443, timeoutMs: number = 5000): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // SSRF protection: validate host before connecting
      await this.validateHost(host);

      const socket = await this.connectTLS(host, port, timeoutMs);
      const peerCert = socket.getPeerCertificate(true);
      
      if (!peerCert || Object.keys(peerCert).length === 0) {
        socket.destroy();
        return {
          host,
          port,
          success: false,
          timestamp: new Date().toISOString(),
          error: 'Kein Zertifikat empfangen',
        };
      }
      
      const certificate = this.parseCertificate(peerCert);
      const chain = this.parseChain(peerCert);
      const tlsVersion = socket.getProtocol() ?? undefined;
      const cipherSuite = socket.getCipher()?.name ?? undefined;
      
      socket.destroy();
      
      return {
        host,
        port,
        success: true,
        timestamp: new Date().toISOString(),
        certificate,
        chain,
        tlsVersion,
        cipherSuite,
      };
    } catch (error: any) {
      return {
        host,
        port,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message || 'Scan fehlgeschlagen',
      };
    }
  }
  
  private async connectTLS(host: string, port: number, timeoutMs: number): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      });
      
      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        reject(new Error('Verbindungs-Timeout'));
      }, timeoutMs);
      
      socket.once('secureConnect', () => {
        clearTimeout(timeoutHandle);
        resolve(socket);
      });
      
      socket.once('error', (err) => {
        clearTimeout(timeoutHandle);
        socket.destroy();
        reject(err);
      });
    });
  }
  
  private parseCertificate(cert: any): CertificateInfo {
    return {
      subject: {
        CN: cert.subject?.CN,
        O: cert.subject?.O,
        OU: cert.subject?.OU,
        C: cert.subject?.C,
      },
      issuer: {
        CN: cert.issuer?.CN,
        O: cert.issuer?.O,
        C: cert.issuer?.C,
      },
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
      fingerprint256: cert.fingerprint256,
      serialNumber: cert.serialNumber,
      subjectAltNames: cert.subjectaltname?.split(', ').map((san: string) => san.replace('DNS:', '')),
    };
  }
  
  private parseChain(cert: any): CertificateChain {
    const chain: CertificateInfo[] = [];
    let current = cert;
    
    while (current && Object.keys(current).length > 0) {
      chain.push(this.parseCertificate(current));
      
      // Vermeidung von Endlosschleife bei selbst-signierten Zertifikaten
      if (current.issuerCertificate === current || !current.issuerCertificate) {
        break;
      }
      
      current = current.issuerCertificate;
    }
    
    return {
      leaf: chain[0],
      intermediates: chain.slice(1, -1),
      root: chain.length > 1 ? chain[chain.length - 1] : undefined,
    };
  }
  
  async checkAnomaly(host: string, port: number = 443): Promise<AnomalyCheckResult> {
    const scanResult = await this.scanHost(host, port);
    
    if (!scanResult.success || !scanResult.certificate) {
      return {
        host,
        anomalies: [{
          type: 'scan_failed',
          severity: 'high',
          description: 'TLS-Verbindung konnte nicht hergestellt werden',
          recommendation: 'Überprüfen Sie die Erreichbarkeit und Konfiguration des Servers',
        }],
        score: 0,
        status: 'dangerous',
      };
    }
    
    const anomalies = [];
    let score = 100;
    
    const cert = scanResult.certificate;
    const now = Date.now();
    const validFrom = new Date(cert.validFrom).getTime();
    const validTo = new Date(cert.validTo).getTime();
    const daysLeft = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
    
    // Zertifikat abgelaufen
    if (validTo < now) {
      anomalies.push({
        type: 'certificate_expired',
        severity: 'critical' as const,
        description: 'Zertifikat ist abgelaufen',
        recommendation: 'Zertifikat sofort erneuern',
      });
      score -= 50;
    }
    
    // Zertifikat läuft bald ab
    else if (daysLeft <= 30) {
      const severity = daysLeft <= 7 ? 'high' : 'medium';
      anomalies.push({
        type: 'certificate_expiring',
        severity: severity as 'high' | 'medium',
        description: `Zertifikat läuft in ${daysLeft} Tagen ab`,
        recommendation: 'Zertifikat zeitnah erneuern',
      });
      score -= daysLeft <= 7 ? 30 : 15;
    }
    
    // Zertifikat noch nicht gültig
    if (validFrom > now) {
      anomalies.push({
        type: 'certificate_not_yet_valid',
        severity: 'high' as const,
        description: 'Zertifikat ist noch nicht gültig',
        recommendation: 'Systemzeit prüfen oder Zertifikat austauschen',
      });
      score -= 40;
    }
    
    // Selbst-signiertes Zertifikat
    if (cert.issuer.CN === cert.subject.CN) {
      anomalies.push({
        type: 'self_signed',
        severity: 'medium' as const,
        description: 'Selbst-signiertes Zertifikat erkannt',
        recommendation: 'Für Produktion ein von CA signiertes Zertifikat verwenden',
      });
      score -= 20;
    }
    
    // Schwache TLS-Version
    if (scanResult.tlsVersion && ['TLSv1', 'TLSv1.1', 'SSLv3'].includes(scanResult.tlsVersion)) {
      anomalies.push({
        type: 'weak_tls_version',
        severity: 'high' as const,
        description: `Veraltete TLS-Version: ${scanResult.tlsVersion}`,
        recommendation: 'Mindestens TLSv1.2 verwenden, idealerweise TLSv1.3',
      });
      score -= 30;
    }
    
    // Hostname Mismatch (vereinfachte Prüfung)
    const sans = cert.subjectAltNames || [];
    const cn = cert.subject.CN || '';
    const hostnameMatch = sans.includes(host) || cn === host || 
                          sans.some(san => san.startsWith('*.') && host.endsWith(san.substring(1)));
    
    if (!hostnameMatch && sans.length > 0) {
      anomalies.push({
        type: 'hostname_mismatch',
        severity: 'high' as const,
        description: 'Hostname stimmt nicht mit Zertifikat überein',
        recommendation: 'Zertifikat für korrekten Hostname ausstellen',
      });
      score -= 35;
    }
    
    // Status ermitteln
    let status: 'safe' | 'suspicious' | 'dangerous';
    if (score >= 80) status = 'safe';
    else if (score >= 50) status = 'suspicious';
    else status = 'dangerous';
    
    return {
      host,
      anomalies,
      score: Math.max(0, score),
      status,
    };
  }
}

