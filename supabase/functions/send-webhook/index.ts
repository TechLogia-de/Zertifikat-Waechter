import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

// URL-Validierung: Blockiere private IP-Ranges
function validateWebhookUrl(url: string): void {
  try {
    const parsed = new URL(url)
    
    // Nur HTTPS erlauben (außer localhost)
    if (parsed.protocol !== 'https:' && !parsed.hostname.includes('localhost')) {
      throw new Error('Only HTTPS URLs are allowed (except localhost)')
    }

    const hostname = parsed.hostname.toLowerCase()
    
    // Private IP-Ranges blockieren
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^127\./,
    ]

    // localhost ist OK
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return
    }

    // Prüfe private IPs
    if (privatePatterns.some(pattern => pattern.test(hostname))) {
      throw new Error('Private IP addresses are not allowed')
    }
  } catch (err) {
    throw new Error(`Invalid webhook URL: ${err.message}`)
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
      validateWebhookUrl(config.url)
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

