import { Router, Response } from 'express';
import { MCPRequest } from '../types/index.js';
import { SupabaseService } from '../services/supabase.js';

const router = Router();
const supabase = new SupabaseService();

// SSE-Clients verwalten
const sseClients = new Map<string, Response>();

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
  
  const clientId = `${req.tenantId}-${Date.now()}`;
  sseClients.set(clientId, res);
  
  console.log(`SSE Client verbunden: ${clientId} (Tenant: ${req.tenantId})`);
  
  // Initiale Nachricht
  res.write(`event: connected\ndata: ${JSON.stringify({ 
    clientId, 
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
  if (!req.tenantId) {
    return res.status(403).json({
      error: 'no_tenant',
      message: 'Tenant erforderlich',
    });
  }
  
  const { type, severity, host, message, metadata } = req.body;
  
  const event = {
    id: `alert-${Date.now()}`,
    type: type || 'CERT_EXPIRES_SOON',
    severity: severity || 'high',
    host: host || 'test.example.com',
    message: message || 'Test-Alert',
    timestamp: new Date().toISOString(),
    metadata: metadata || {},
  };
  
  broadcastAlert(req.tenantId, event);
  
  // In DB loggen
  await supabase.logEvent(req.tenantId, 'mcp.alert.triggered', event);
  
  res.json({
    success: true,
    message: 'Alert getriggert',
    event,
    clients: Array.from(sseClients.keys()).filter(k => k.startsWith(req.tenantId + '-')).length,
  });
});

// Aktuelle Clients auflisten (für Debugging)
router.get('/clients', async (req: MCPRequest, res: Response) => {
  if (!req.tenantId) {
    return res.status(403).json({
      error: 'no_tenant',
      message: 'Tenant erforderlich',
    });
  }
  
  const clients = Array.from(sseClients.keys())
    .filter(k => k.startsWith(req.tenantId + '-'));
  
  res.json({
    success: true,
    tenantId: req.tenantId,
    count: clients.length,
    clients: clients.map(id => ({
      id,
      connectedSince: id.split('-')[1],
    })),
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
    
    const limit = parseInt(req.query.limit as string || '50', 10);
    const alerts = await supabase.getRecentAlerts(req.tenantId, limit);
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error: any) {
    console.error('recent alerts error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Alerts konnten nicht geladen werden',
    });
  }
});

export default router;
export { sseClients };

