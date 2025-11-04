import { Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config/index.js';
import { MCPRequest, ContextState } from '../types/index.js';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function initRedis() {
  redisClient = createClient({ url: config.redis.url });
  
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });
  
  await redisClient.connect();
  console.log('✅ Redis verbunden');
  
  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client nicht initialisiert');
  }
  return redisClient;
}

export async function contextMiddleware(req: MCPRequest, res: Response, next: NextFunction) {
  if (!req.sessionId) {
    req.sessionId = 'default';
  }
  
  const contextKey = `mcp:ctx:${req.sessionId}`;
  
  try {
    const redis = getRedisClient();
    
    // Context State laden oder initialisieren
    const contextData = await redis.hGetAll(contextKey);
    
    if (Object.keys(contextData).length === 0) {
      // Neuen Context initialisieren
      const initialContext: ContextState = {
        sessionStart: new Date().toISOString(),
        requestCount: 0,
      };
      
      await redis.hSet(contextKey, {
        sessionStart: initialContext.sessionStart,
        requestCount: '0',
      });
      
      // TTL setzen (1 Stunde)
      await redis.expire(contextKey, 3600);
    } else {
      // Request Counter erhöhen
      await redis.hIncrBy(contextKey, 'requestCount', 1);
    }
    
    // Context State für spätere Verwendung bereitstellen
    (req as any).context = {
      key: contextKey,
      get: async (field: string) => await redis.hGet(contextKey, field),
      set: async (field: string, value: string) => await redis.hSet(contextKey, field, value),
      getAll: async () => await redis.hGetAll(contextKey),
      delete: async (field: string) => await redis.hDel(contextKey, field),
    };
    
    next();
  } catch (err) {
    console.error('Context middleware error:', err);
    // Context-Fehler sollten nicht blockieren
    next();
  }
}

export async function saveToContext(
  sessionId: string, 
  data: Record<string, string>
): Promise<void> {
  const redis = getRedisClient();
  const contextKey = `mcp:ctx:${sessionId}`;
  
  await redis.hSet(contextKey, data);
  await redis.expire(contextKey, 3600);
}

export async function getFromContext(
  sessionId: string, 
  field: string
): Promise<string | null> {
  const redis = getRedisClient();
  const contextKey = `mcp:ctx:${sessionId}`;
  
  const result = await redis.hGet(contextKey, field);
  return result ?? null;
}

export async function clearContext(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const contextKey = `mcp:ctx:${sessionId}`;
  
  await redis.del(contextKey);
}

