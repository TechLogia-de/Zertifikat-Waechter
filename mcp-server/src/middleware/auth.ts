import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { MCPRequest } from '../types/index.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

export async function authMiddleware(req: MCPRequest, res: Response, next: NextFunction) {
  try {
    const apiKey = req.header('X-API-Key');
    const bearer = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey && !bearer) {
      return res.status(401).json({ 
        error: 'unauthorized', 
        message: 'API-Key oder Bearer Token erforderlich' 
      });
    }

    // Session ID für Context State
    req.sessionId = req.header('X-Session-ID') || 'default';

    if (bearer) {
      // JWT Token validieren
      try {
        const decoded = jwt.verify(bearer, config.jwt.secret, {
          algorithms: [config.jwt.algorithm],
        }) as { sub: string; tenant_id?: string };
        
        req.userId = decoded.sub;
        req.tenantId = decoded.tenant_id;
        
        // Benutzer aus Supabase laden zur Validierung
        const { data: user, error } = await supabase.auth.admin.getUserById(decoded.sub);
        
        if (error || !user) {
          return res.status(401).json({ 
            error: 'invalid_token', 
            message: 'Token ungültig oder Benutzer existiert nicht' 
          });
        }
        
      } catch (err) {
        return res.status(401).json({ 
          error: 'invalid_token', 
          message: 'Token-Validierung fehlgeschlagen' 
        });
      }
    } else if (apiKey) {
      // API Key validieren
      const { data: apiKeyRecord, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', hashApiKey(apiKey))
        .eq('is_active', true)
        .single();
      
      if (error || !apiKeyRecord) {
        return res.status(401).json({ 
          error: 'invalid_api_key', 
          message: 'API-Key ungültig oder inaktiv' 
        });
      }
      
      req.userId = apiKeyRecord.user_id;
      req.tenantId = apiKeyRecord.tenant_id;
      req.apiKey = apiKey;
      
      // Letzten Zugriff aktualisieren
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyRecord.id);
    }
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ 
      error: 'internal_error', 
      message: 'Authentifizierung fehlgeschlagen' 
    });
  }
}

function hashApiKey(key: string): string {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', config.security.apiKeyHashSecret)
    .update(key)
    .digest('hex');
}

export async function tenantMiddleware(req: MCPRequest, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return res.status(403).json({ 
      error: 'no_tenant', 
      message: 'Kein Tenant zugeordnet' 
    });
  }
  
  // Tenant-Zugriff validieren
  const { data: membership, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', req.userId)
    .eq('tenant_id', req.tenantId)
    .single();
  
  if (error || !membership) {
    return res.status(403).json({ 
      error: 'access_denied', 
      message: 'Kein Zugriff auf diesen Tenant' 
    });
  }
  
  next();
}

