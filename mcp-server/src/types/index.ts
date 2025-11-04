import { Request } from 'express';

export interface MCPRequest extends Request {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  apiKey?: string;
}

export interface CertificateInfo {
  subject: {
    CN?: string;
    O?: string;
    OU?: string;
    C?: string;
  };
  issuer: {
    CN?: string;
    O?: string;
    C?: string;
  };
  validFrom: string;
  validTo: string;
  fingerprint256: string;
  serialNumber: string;
  subjectAltNames?: string[];
}

export interface CertificateChain {
  leaf: CertificateInfo;
  intermediates: CertificateInfo[];
  root?: CertificateInfo;
}

export interface ScanResult {
  host: string;
  port: number;
  success: boolean;
  timestamp: string;
  certificate?: CertificateInfo;
  chain?: CertificateChain;
  error?: string;
  tlsVersion?: string;
  cipherSuite?: string;
}

export interface ExpiryCheckResult {
  host: string;
  expiresAt: string;
  daysLeft: number;
  severity: 'ok' | 'medium' | 'high' | 'critical';
  status: 'valid' | 'expiring_soon' | 'expired';
}

export interface AnomalyCheckResult {
  host: string;
  anomalies: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation?: string;
  }[];
  score: number;
  status: 'safe' | 'suspicious' | 'dangerous';
}

export interface DomainRegistration {
  id: string;
  name: string;
  port: number;
  tags: string[];
  status: 'active' | 'paused' | 'error';
  lastScanned?: string;
  nextScan?: string;
}

export interface AlertEvent {
  id: string;
  type: 'CERT_EXPIRES_SOON' | 'CERT_EXPIRED' | 'ANOMALY_DETECTED' | 'SCAN_FAILED' | 'CERT_RENEWED';
  severity: 'low' | 'medium' | 'high' | 'critical';
  host: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ContextState {
  lastHost?: string;
  lastScan?: ScanResult;
  lastChain?: CertificateChain;
  sessionStart: string;
  requestCount: number;
}

