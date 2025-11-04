import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readFile } from 'fs/promises';
import { config } from './config/index.js';
import { authMiddleware, tenantMiddleware } from './middleware/auth.js';
import { contextMiddleware, initRedis } from './middleware/context.js';
import toolsRouter from './routes/tools.js';
import alertsRouter from './routes/alerts.js';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/mcp/', limiter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Manifest Endpoint
app.get('/mcp/manifest', async (req: Request, res: Response) => {
  try {
    const manifest = JSON.parse(
      await readFile(new URL('../manifest.json', import.meta.url), 'utf-8')
    );
    
    res.json({
      ...manifest,
      health: 'ok',
      updatedAt: new Date().toISOString(),
      endpoints: {
        tools: '/mcp/tools/*',
        alerts: '/mcp/alerts/*',
        manifest: '/mcp/manifest',
        health: '/health',
      },
    });
  } catch (error) {
    console.error('Manifest loading error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Manifest konnte nicht geladen werden',
    });
  }
});

// MCP Tool Routes (mit Auth und Context)
app.use(
  '/mcp/tools',
  authMiddleware,
  tenantMiddleware,
  contextMiddleware,
  toolsRouter
);

// Alert Routes (mit Auth)
app.use(
  '/mcp/alerts',
  authMiddleware,
  tenantMiddleware,
  alertsRouter
);

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'internal_error',
    message: config.nodeEnv === 'development' ? err.message : 'Ein Fehler ist aufgetreten',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'not_found',
    message: `Route ${req.method} ${req.path} nicht gefunden`,
    availableEndpoints: {
      manifest: 'GET /mcp/manifest',
      health: 'GET /health',
      tools: 'POST /mcp/tools/*',
      alerts: 'GET /mcp/alerts/*',
    },
  });
});

// Server starten
async function startServer() {
  try {
    console.log('🚀 MCP-Server wird gestartet...');
    console.log(`Umgebung: ${config.nodeEnv}`);
    
    // Redis verbinden
    await initRedis();
    
    // HTTP Server starten
    const server = app.listen(config.port, () => {
      console.log(`\n✅ MCP-Server läuft auf Port ${config.port}`);
      console.log(`📋 Manifest: http://localhost:${config.port}/mcp/manifest`);
      console.log(`💚 Health: http://localhost:${config.port}/health`);
      console.log(`🔧 Tools: http://localhost:${config.port}/mcp/tools/*`);
      console.log(`🔔 Alerts: http://localhost:${config.port}/mcp/alerts/stream`);
    });
    
    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} empfangen. Server wird heruntergefahren...`);
      
      server.close(() => {
        console.log('HTTP Server geschlossen');
        process.exit(0);
      });
      
      // Force shutdown nach 10 Sekunden
      setTimeout(() => {
        console.error('Erzwungenes Herunterfahren nach Timeout');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Server-Start fehlgeschlagen:', error);
    process.exit(1);
  }
}

// Server starten, wenn direkt ausgeführt
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { app, startServer };

