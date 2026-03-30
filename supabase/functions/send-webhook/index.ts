import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  event: string
  tenant_id: string
  certificate?: any
  message?: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  timestamp: string
}

interface WebhookConfig {
  url: string
  secret?: string
  timeout_seconds?: number
  retry_count?: number
  validate_ssl?: boolean
}

// HMAC-SHA256 Signatur generieren
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex
}

// Check if an IP address belongs to a private/reserved range
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const ipv4Parts = ip.split('.').map(Number)
  if (ipv4Parts.length === 4 && ipv4Parts.every(p => p >= 0 && p <= 255)) {
    const [a, b] = ipv4Parts
    if (a === 127) return true                              // 127.0.0.0/8 loopback
    if (a === 10) return true                               // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true        // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true                 // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true                 // 169.254.0.0/16 link-local
    if (a === 0) return true                                // 0.0.0.0/8
    return false
  }

  // IPv6 private ranges
  const normalized = ip.toLowerCase()
  if (normalized === '::1') return true                     // IPv6 loopback
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true  // fc00::/7 unique local
  if (normalized.startsWith('fe80')) return true            // fe80::/10 link-local
  if (normalized === '::') return true                      // unspecified address

  return false
}

// URL validation: block private IP ranges using proper DNS resolution
async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid webhook URL: malformed URL')
  }

  // Only allow HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed')
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and common loopback aliases
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    throw new Error('Loopback addresses are not allowed')
  }

  // If hostname looks like a raw IP, check it directly
  if (isPrivateIP(hostname)) {
    throw new Error('Private IP addresses are not allowed')
  }

  // Resolve hostname to IP addresses and verify none are private
  try {
    const resolved = await Deno.resolveDns(hostname, 'A')
    for (const ip of resolved) {
      if (isPrivateIP(ip)) {
        throw new Error(`Hostname resolves to private IP address (${ip})`)
      }
    }
  } catch (err: any) {
    // If the error is one we threw ourselves, re-throw it
    if (err.message.includes('private IP') || err.message.includes('Loopback')) {
      throw err
    }
    // DNS resolution failed - also try AAAA records before giving up
  }

  // Also check AAAA records for IPv6
  try {
    const resolved = await Deno.resolveDns(hostname, 'AAAA')
    for (const ip of resolved) {
      if (isPrivateIP(ip)) {
        throw new Error(`Hostname resolves to private IPv6 address (${ip})`)
      }
    }
  } catch (err: any) {
    if (err.message.includes('private IP')) {
      throw err
    }
    // AAAA resolution failure is not fatal
  }
}

// Webhook mit Retry-Logik senden
async function sendWebhookWithRetry(
  config: WebhookConfig,
  payload: WebhookPayload,
  maxRetries: number = 3
): Promise<{ success: boolean; statusCode?: number; error?: string; attempts: number }> {
  const payloadString = JSON.stringify(payload)
  const timeout = (config.timeout_seconds || 5) * 1000
  let lastError = ''

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Zertifikat-Waechter/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Attempt': attempt.toString(),
      }

      // HMAC-Signatur hinzufügen
      if (config.secret) {
        const signature = await generateSignature(payloadString, config.secret)
        headers['X-Webhook-Signature'] = `sha256=${signature}`
        headers['X-Webhook-Signature-Timestamp'] = payload.timestamp
      }

      // Sende mit Timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt
        }
      }

      lastError = `HTTP ${response.status}: ${await response.text().catch(() => 'No details')}`

      // Bei 4xx Fehlern nicht retrien (Client-Fehler)
      if (response.status >= 400 && response.status < 500) {
        break
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = `Timeout after ${config.timeout_seconds}s`
      } else {
        lastError = err.message
      }
    }

    // Exponential Backoff bei weiteren Versuchen
    if (attempt < maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxRetries
  }
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody = await req.json()
    const { tenant_id, payload, delivery_id } = requestBody

    if (!tenant_id || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id or payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Webhook-Konfiguration abrufen
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config, enabled')
      .eq('tenant_id', tenant_id)
      .eq('type', 'webhook')
      .eq('enabled', true)
      .maybeSingle()

    if (integrationError || !integration) {
      console.log('No webhook integration found for tenant:', tenant_id)
      return new Response(
        JSON.stringify({ error: 'No webhook configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config = integration.config as WebhookConfig

    // URL validieren
    try {
      await validateWebhookUrl(config.url)
    } catch (err: any) {
      console.error('Invalid webhook URL:', err.message)
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Webhook senden
    const result = await sendWebhookWithRetry(
      config,
      {
        ...payload,
        tenant_id,
        timestamp: payload.timestamp || new Date().toISOString()
      },
      config.retry_count || 3
    )

    // Delivery Status in DB speichern
    if (delivery_id) {
      if (result.success) {
        // Markiere als delivered
        await supabase.rpc('mark_webhook_delivered', {
          p_delivery_id: delivery_id,
          p_status_code: result.statusCode,
          p_response_body: null,
          p_response_headers: null
        })
      } else {
        // Schedule Retry
        await supabase.rpc('schedule_webhook_retry', {
          p_delivery_id: delivery_id,
          p_error_message: result.error || 'Unknown error',
          p_status_code: result.statusCode || null
        })
      }
    }

    // Log Event
    await supabase.from('events').insert({
      tenant_id,
      type: result.success ? 'webhook.sent' : 'webhook.failed',
      payload: {
        url: config.url,
        event: payload.event,
        success: result.success,
        status_code: result.statusCode,
        error: result.error,
        attempts: result.attempts,
        delivery_id
      }
    })

    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook sent successfully',
          attempts: result.attempts,
          delivery_id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          attempts: result.attempts,
          delivery_id 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('Webhook function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

