import { Router, Response } from 'express';
import { ZodError } from 'zod';
import { MCPRequest } from '../types/index.js';
import { CertificateScanner } from '../services/scanner.js';
import { SupabaseService } from '../services/supabase.js';
import { saveToContext, getFromContext } from '../middleware/context.js';
import { z } from 'zod';
import { config } from '../config/index.js';

// Safe error message helper - hide internal details in production
function safeErrorMessage(error: any, fallback: string): string {
  if (error instanceof ZodError) {
    return `Validierungsfehler: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
  }
  if (config.nodeEnv === 'development') {
    return error?.message || fallback;
  }
  return fallback;
}

const router = Router();
const scanner = new CertificateScanner();
const supabase = new SupabaseService();

// Host validation: valid hostname or IP address
const hostSchema = z.string()
  .min(1)
  .max(253)
  .regex(
    /^(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)$/,
    'Ungültiger Hostname oder IP-Adresse'
  );

// Domain name validation (no raw IPs for domain registration)
const domainNameSchema = z.string()
  .min(1)
  .max(253)
  .regex(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    'Ungültiger Domainname'
  );

// Tag validation: alphanumeric + basic punctuation, bounded length
const tagSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9\-_.:]+$/);

// Validierungs-Schemas
const certScanSchema = z.object({
  host: hostSchema,
  port: z.number().int().min(1).max(65535).optional().default(443),
  timeoutMs: z.number().int().min(1000).max(30000).optional().default(5000),
});

const certChainSchema = z.object({
  host: hostSchema,
  port: z.number().int().min(1).max(65535).optional().default(443),
});

const certExpirySchema = z.object({
  host: hostSchema,
  warnDays: z.number().int().min(1).max(365).optional().default(30),
});

const anomalyScanSchema = z.object({
  host: hostSchema,
  port: z.number().int().min(1).max(65535).optional().default(443),
});

const domainRegisterSchema = z.object({
  name: domainNameSchema,
  port: z.number().int().min(1).max(65535).optional().default(443),
  tags: z.array(tagSchema).max(20).optional().default([]),
});

const domainListSchema = z.object({
  filter: z.enum(['all', 'expiring', 'expired', 'valid']).optional().default('all'),
  limit: z.number().int().min(1).max(500).optional().default(100),
});

const complianceReportSchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
});

// Tool: cert.scan
router.post('/cert.scan', async (req: MCPRequest, res: Response) => {
  try {
    const params = certScanSchema.parse(req.body);
    
    const result = await scanner.scanHost(params.host, params.port, params.timeoutMs);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'scan_failed',
        message: result.error,
        result,
      });
    }
    
    // In Context speichern für spätere Verwendung
    if (req.sessionId && result.certificate) {
      await saveToContext(req.sessionId, {
        lastHost: params.host,
        lastScan: JSON.stringify(result),
        lastChain: result.chain ? JSON.stringify(result.chain) : '',
      });
    }
    
    // In Datenbank speichern
    if (req.tenantId && result.certificate && result.chain) {
      await supabase.saveScanResult(
        req.tenantId,
        params.host,
        params.port,
        result.certificate,
        result.chain
      );
    }
    
    // Event loggen
    if (req.tenantId) {
      await supabase.logEvent(req.tenantId, 'mcp.cert.scan', {
        host: params.host,
        port: params.port,
        success: true,
      });
    }
    
    res.json({
      tool: 'cert.scan',
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('cert.scan error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Scan fehlgeschlagen'),
    });
  }
});

// Tool: cert.chain
router.post('/cert.chain', async (req: MCPRequest, res: Response) => {
  try {
    const params = certChainSchema.parse(req.body);
    
    const result = await scanner.scanHost(params.host, params.port);
    
    if (!result.success || !result.chain) {
      return res.status(400).json({
        error: 'chain_unavailable',
        message: result.error || 'Zertifikatskette konnte nicht abgerufen werden',
      });
    }
    
    res.json({
      tool: 'cert.chain',
      success: true,
      data: {
        host: params.host,
        chain: result.chain,
        chainLength: [
          result.chain.leaf,
          ...result.chain.intermediates,
          result.chain.root,
        ].filter(Boolean).length,
        isComplete: !!result.chain.root,
      },
    });
  } catch (error: any) {
    console.error('cert.chain error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Chain-Abruf fehlgeschlagen'),
    });
  }
});

// Tool: cert.expiry
router.post('/cert.expiry', async (req: MCPRequest, res: Response) => {
  try {
    const params = certExpirySchema.parse(req.body);
    
    // Versuche aus Context zu laden
    let chain = null;
    if (req.sessionId) {
      const cachedChain = await getFromContext(req.sessionId, 'lastChain');
      const cachedHost = await getFromContext(req.sessionId, 'lastHost');
      
      if (cachedChain && cachedHost === params.host) {
        chain = JSON.parse(cachedChain);
      }
    }
    
    // Wenn nicht im Context, neu scannen
    if (!chain) {
      const scanResult = await scanner.scanHost(params.host);
      
      if (!scanResult.success || !scanResult.chain) {
        return res.status(400).json({
          error: 'scan_failed',
          message: scanResult.error || 'Zertifikat konnte nicht gelesen werden',
        });
      }
      
      chain = scanResult.chain;
    }
    
    const leaf = chain.leaf;
    const expiresAt = new Date(leaf.validTo);
    const now = Date.now();
    const daysLeft = Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
    
    let severity: 'ok' | 'medium' | 'high' | 'critical';
    let status: 'valid' | 'expiring_soon' | 'expired';
    
    if (daysLeft <= 0) {
      severity = 'critical';
      status = 'expired';
    } else if (daysLeft <= 7) {
      severity = 'critical';
      status = 'expiring_soon';
    } else if (daysLeft <= params.warnDays) {
      severity = 'high';
      status = 'expiring_soon';
    } else if (daysLeft <= params.warnDays * 2) {
      severity = 'medium';
      status = 'valid';
    } else {
      severity = 'ok';
      status = 'valid';
    }
    
    res.json({
      tool: 'cert.expiry',
      success: true,
      data: {
        host: params.host,
        expiresAt: expiresAt.toISOString(),
        daysLeft,
        severity,
        status,
        certificate: {
          subject: leaf.subject.CN,
          issuer: leaf.issuer.CN,
          fingerprint: leaf.fingerprint256,
        },
      },
    });
  } catch (error: any) {
    console.error('cert.expiry error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Expiry-Check fehlgeschlagen'),
    });
  }
});

// Tool: security.anomalyScan
router.post('/security.anomalyScan', async (req: MCPRequest, res: Response) => {
  try {
    const params = anomalyScanSchema.parse(req.body);
    
    const result = await scanner.checkAnomaly(params.host, params.port);
    
    // Event loggen falls kritische Anomalien gefunden
    if (req.tenantId && result.anomalies.some(a => a.severity === 'critical' || a.severity === 'high')) {
      await supabase.logEvent(req.tenantId, 'mcp.security.anomaly_detected', {
        host: params.host,
        anomalies: result.anomalies,
        score: result.score,
      });
    }
    
    res.json({
      tool: 'security.anomalyScan',
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('security.anomalyScan error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Anomaly-Scan fehlgeschlagen'),
    });
  }
});

// Tool: domains.register
router.post('/domains.register', async (req: MCPRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({
        error: 'no_tenant',
        message: 'Tenant erforderlich',
      });
    }
    
    const params = domainRegisterSchema.parse(req.body);
    
    const domain = await supabase.registerDomain(
      req.tenantId,
      params.name,
      params.port,
      params.tags
    );
    
    await supabase.logEvent(req.tenantId, 'mcp.domain.registered', {
      domain: params.name,
      port: params.port,
      tags: params.tags,
    });
    
    res.json({
      tool: 'domains.register',
      success: true,
      data: domain,
    });
  } catch (error: any) {
    console.error('domains.register error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Domain-Registrierung fehlgeschlagen'),
    });
  }
});

// Tool: domains.list
router.post('/domains.list', async (req: MCPRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({
        error: 'no_tenant',
        message: 'Tenant erforderlich',
      });
    }
    
    const params = domainListSchema.parse(req.body);
    
    const domains = await supabase.listDomains(
      req.tenantId,
      params.filter,
      params.limit
    );
    
    res.json({
      tool: 'domains.list',
      success: true,
      data: {
        domains,
        count: domains.length,
        filter: params.filter,
      },
    });
  } catch (error: any) {
    console.error('domains.list error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Domain-Liste konnte nicht geladen werden'),
    });
  }
});

// Tool: compliance.report
router.post('/compliance.report', async (req: MCPRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({
        error: 'no_tenant',
        message: 'Tenant erforderlich',
      });
    }
    
    const { format } = complianceReportSchema.parse(req.body);

    // Fetch domains, certificate stats, and alert stats in parallel
    const [domains, certStats, alertStats] = await Promise.all([
      supabase.listDomains(req.tenantId, 'all', 1000),
      supabase.getCertificateStats(req.tenantId),
      supabase.getAlertStats(req.tenantId),
    ]);

    // Calculate compliance score based on certificate health
    // Start at 100, deduct for issues
    let complianceScore = 100;
    if (certStats.total > 0) {
      const expiredPenalty = (certStats.expired / certStats.total) * 50;
      const expiringPenalty = (certStats.expiring / certStats.total) * 20;
      complianceScore = Math.max(0, Math.round(complianceScore - expiredPenalty - expiringPenalty));
    }

    // Determine compliance grade
    let complianceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (complianceScore >= 90) complianceGrade = 'A';
    else if (complianceScore >= 75) complianceGrade = 'B';
    else if (complianceScore >= 60) complianceGrade = 'C';
    else if (complianceScore >= 40) complianceGrade = 'D';
    else complianceGrade = 'F';

    const report = {
      generatedAt: new Date().toISOString(),
      tenantId: req.tenantId,
      complianceScore,
      complianceGrade,
      summary: {
        domains: {
          total: domains.length,
          active: domains.filter(d => d.status === 'active').length,
          errors: domains.filter(d => d.status === 'error').length,
        },
        certificates: certStats,
        alerts: alertStats,
      },
      domains: domains.map(d => ({
        name: d.name,
        port: d.port,
        status: d.status,
        lastScanned: d.lastScanned,
        tags: d.tags,
      })),
    };

    if (format === 'csv') {
      // CSV format with summary header
      const csv = [
        `# Compliance Report - Score: ${complianceScore}/100 (${complianceGrade})`,
        `# Generated: ${report.generatedAt}`,
        `# Certificates - Total: ${certStats.total}, Valid: ${certStats.valid}, Expiring: ${certStats.expiring}, Expired: ${certStats.expired}`,
        `# Alerts - Total: ${alertStats.total}, Critical: ${alertStats.critical}, High: ${alertStats.high}`,
        '',
        'Name,Port,Status,Last Scanned,Tags',
        ...report.domains.map(d =>
          `${d.name},${d.port},${d.status},${d.lastScanned || 'N/A'},"${d.tags.join(';')}"`
        ),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.csv');
      return res.send(csv);
    }

    res.json({
      tool: 'compliance.report',
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('compliance.report error:', error instanceof Error ? error.message : error);
    const status = error instanceof ZodError ? 400 : 500;
    res.status(status).json({
      error: error instanceof ZodError ? 'validation_error' : 'internal_error',
      message: safeErrorMessage(error, 'Report-Generierung fehlgeschlagen'),
    });
  }
});

export default router;

