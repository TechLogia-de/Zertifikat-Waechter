import { Router, Response } from 'express';
import { MCPRequest } from '../types/index.js';
import { CertificateScanner } from '../services/scanner.js';
import { SupabaseService } from '../services/supabase.js';
import { saveToContext, getFromContext } from '../middleware/context.js';
import { z } from 'zod';

const router = Router();
const scanner = new CertificateScanner();
const supabase = new SupabaseService();

// Validierungs-Schemas
const certScanSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(443),
  timeoutMs: z.number().int().min(1000).max(30000).optional().default(5000),
});

const certChainSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(443),
});

const certExpirySchema = z.object({
  host: z.string().min(1),
  warnDays: z.number().int().min(1).max(365).optional().default(30),
});

const anomalyScanSchema = z.object({
  host: z.string().min(1),
});

const domainRegisterSchema = z.object({
  name: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(443),
  tags: z.array(z.string()).optional().default([]),
});

const domainListSchema = z.object({
  filter: z.enum(['all', 'expiring', 'expired', 'valid']).optional().default('all'),
  limit: z.number().int().min(1).max(500).optional().default(100),
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
    console.error('cert.scan error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Scan fehlgeschlagen',
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
    console.error('cert.chain error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Chain-Abruf fehlgeschlagen',
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
    console.error('cert.expiry error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Expiry-Check fehlgeschlagen',
    });
  }
});

// Tool: security.anomalyScan
router.post('/security.anomalyScan', async (req: MCPRequest, res: Response) => {
  try {
    const params = anomalyScanSchema.parse(req.body);
    
    const result = await scanner.checkAnomaly(params.host);
    
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
    console.error('security.anomalyScan error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Anomaly-Scan fehlgeschlagen',
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
    console.error('domains.register error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Domain-Registrierung fehlgeschlagen',
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
    console.error('domains.list error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Domain-Liste konnte nicht geladen werden',
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
    
    const { format = 'json' } = req.body;
    
    const domains = await supabase.listDomains(req.tenantId, 'all', 1000);
    
    const report = {
      generatedAt: new Date().toISOString(),
      tenantId: req.tenantId,
      summary: {
        total: domains.length,
        active: domains.filter(d => d.status === 'active').length,
        errors: domains.filter(d => d.status === 'error').length,
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
      // CSV-Format
      const csv = [
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
    console.error('compliance.report error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Report-Generierung fehlgeschlagen',
    });
  }
});

export default router;

