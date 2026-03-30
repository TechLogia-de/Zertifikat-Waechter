import { Router, Response } from 'express';
import { z } from 'zod';
import { MCPRequest } from '../types/index.js';
import { SupabaseService } from '../services/supabase.js';

const router = Router();
const supabase = new SupabaseService();

// SSE-Clients verwalten - bounded to prevent memory exhaustion
const MAX_SSE_CLIENTS = 100;
const sseClients = new Map<string, Response>();

// Zod schemas for alerts endpoints
const alertTriggerSchema = z.object({
  type: z.enum(['CERT_EXPIRES_SOON', 'CERT_EXPIRED', 'ANOMALY_DETECTED', 'SCAN_FAILED', 'CERT_RENEWED']).optional().default('CERT_EXPIRES_SOON'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
  host: z.string().min(1).max(253).optional().default('test.example.com'),
  message: z.string().min(1).max(1000).optional().default('Test-Alert'),
  metadata: z.record(z.unknown()).optional().default({}),
});

// SSE Stream für Alerts
router.get('/stream', async (req: MCPRequest, res: Response) => {
  if (!req.tenantId) {
    return res.status(403).json({
      error: 'no_tenant',
      message: 'Tenant erforderlich',
    });
  }
  
  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  
  // Prevent unbounded SSE client growth
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    return res.status(503).json({
      error: 'service_unavailable',
      message: 'Maximale Anzahl an SSE-Verbindungen erreicht',
    });
  }

  const clientId = `${req.tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sseClients.set(clientId, res);

  console.log(`SSE Client verbunden: ${clientId} (Tenant: ${req.tenantId})`);

  // Initial message - don't leak internal clientId to response
  res.write(`event: connected\ndata: ${JSON.stringify({
    tenantId: req.tenantId,
    timestamp: new Date().toISOString()
  })}\n\n`);
  
  // Keepalive alle 15 Sekunden
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(`event: keepalive\ndata: ${JSON.stringify({ 
        timestamp: new Date().toISOString() 
      })}\n\n`);
    } catch (error) {
      clearInterval(keepaliveInterval);
      sseClients.delete(clientId);
    }
  }, 15000);
  
  // Client-Disconnect behandeln
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    sseClients.delete(clientId);
    console.log(`SSE Client getrennt: ${clientId}`);
  });
  
  req.on('error', () => {
    clearInterval(keepaliveInterval);
    sseClients.delete(clientId);
  });
});

// Alert an alle verbundenen Clients senden
export function broadcastAlert(tenantId: string, event: any) {
  let sent = 0;
  
  for (const [clientId, res] of sseClients.entries()) {
    if (clientId.startsWith(tenantId + '-')) {
      try {
        res.write(`event: alert\ndata: ${JSON.stringify(event)}\n\n`);
        sent++;
      } catch (error) {
        console.error(`Fehler beim Senden an Client ${clientId}:`, error);
        sseClients.delete(clientId);
      }
    }
  }
  
  console.log(`Alert gesendet an ${sent} Client(s) von Tenant ${tenantId}`);
}

// Manuelle Alert-Trigger (für Testing)
router.post('/trigger', async (req: MCPRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({
        error: 'no_tenant',
        message: 'Tenant erforderlich',
      });
    }

    const params = alertTriggerSchema.parse(req.body);

    const event = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: params.type,
      severity: params.severity,
      host: params.host,
      message: params.message,
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    broadcastAlert(req.tenantId, event);

    // In DB loggen
    await supabase.logEvent(req.tenantId, 'mcp.alert.triggered', event);

    const clientCount = Array.from(sseClients.keys()).filter(k => k.startsWith(req.tenantId + '-')).length;

    res.json({
      success: true,
      message: 'Alert getriggert',
      event,
      clients: clientCount,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: `Validierungsfehler: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      });
    }
    console.error('alert trigger error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Alert konnte nicht getriggert werden',
    });
  }
});

// Aktuelle Clients auflisten - only show count, not internal IDs
router.get('/clients', async (req: MCPRequest, res: Response) => {
  if (!req.tenantId) {
    return res.status(403).json({
      error: 'no_tenant',
      message: 'Tenant erforderlich',
    });
  }

  const clientCount = Array.from(sseClients.keys())
    .filter(k => k.startsWith(req.tenantId + '-')).length;

  res.json({
    success: true,
    tenantId: req.tenantId,
    count: clientCount,
  });
});

// Letzte Alerts abrufen
router.get('/recent', async (req: MCPRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({
        error: 'no_tenant',
        message: 'Tenant erforderlich',
      });
    }

    // Validate and bound the limit parameter
    const rawLimit = parseInt(req.query.limit as string || '50', 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 200);
    const alerts = await supabase.getRecentAlerts(req.tenantId, limit);

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error: any) {
    console.error('recent alerts error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Alerts konnten nicht geladen werden',
    });
  }
});

export default router;
export { sseClients };

