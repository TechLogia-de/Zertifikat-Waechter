// ACME Order Processing Edge Function
// Automatische Verarbeitung von pending ACME Orders

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ACMEOrder {
  id: string
  tenant_id: string
  domain: string
  challenge_type: string
  status: string
  key_size: number
  acme_accounts: {
    email: string
    provider: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[ACME Processor] Starting...')

    // Hole alle pending Orders
    const { data: orders, error: ordersError } = await supabase
      .from('acme_orders')
      .select(`
        *,
        acme_accounts (
          email,
          provider
        )
      `)
      .eq('status', 'pending')
      .limit(10)

    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
      console.log('[ACME Processor] No pending orders')
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending orders to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[ACME Processor] Processing ${orders.length} orders`)

    const results = []

    for (const order of orders as ACMEOrder[]) {
      try {
        console.log(`[ACME Processor] Processing ${order.domain}`)

        // Prüfe DNS Provider
        const dnsProvider = await detectDNSProvider(supabase, order.tenant_id, order.domain)

        if (order.challenge_type === 'dns-01') {
          if (dnsProvider === 'cloudflare') {
            // DNS-01 mit Cloudflare
            await processDNS01Challenge(supabase, order)
            results.push({ domain: order.domain, status: 'success', method: 'dns-01-cloudflare' })
          } else {
            // DNS-01 aber kein Cloudflare → Skip, braucht manuelle Konfiguration
            await supabase
              .from('acme_orders')
              .update({ 
                status: 'invalid',
                last_error: 'DNS-01 Challenge erfordert Cloudflare-Integration. Bitte konfiguriere Cloudflare oder wechsle zu HTTP-01.'
              })
              .eq('id', order.id)
            
            results.push({ domain: order.domain, status: 'skipped', reason: 'no-cloudflare' })
          }
        } else if (order.challenge_type === 'http-01') {
          // HTTP-01 Challenge
          await processHTTP01Challenge(supabase, order)
          results.push({ domain: order.domain, status: 'success', method: 'http-01' })
        }

      } catch (error) {
        console.error(`[ACME Processor] Error for ${order.domain}:`, error)
        
        await supabase
          .from('acme_orders')
          .update({ 
            status: 'invalid',
            last_error: error.message 
          })
          .eq('id', order.id)

        results.push({ domain: order.domain, status: 'error', error: error.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: orders.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[ACME Processor] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function detectDNSProvider(supabase: any, tenantId: string, domain: string): Promise<string | null> {
  try {
    // Extrahiere Basis-Domain für Wildcard
    const baseDomain = domain.startsWith('*.') ? domain.substring(2) : domain

    // Prüfe ob Cloudflare-Integration existiert
    const { data: cloudflareIntegration } = await supabase
      .from('integrations')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('type', 'cloudflare')
      .eq('is_active', true)
      .maybeSingle()

    if (cloudflareIntegration && cloudflareIntegration.config?.api_token) {
      // Prüfe ob Domain bei Cloudflare ist (optional, für MVP skip)
      return 'cloudflare'
    }

    return null
  } catch (error) {
    console.error('[detectDNSProvider] Error:', error)
    return null
  }
}

async function processDNS01Challenge(supabase: any, order: ACMEOrder): Promise<void> {
  console.log(`[DNS-01] Processing ${order.domain}`)

  // Hole Cloudflare Config
  const { data: integration } = await supabase
    .from('integrations')
    .select('config')
    .eq('tenant_id', order.tenant_id)
    .eq('type', 'cloudflare')
    .eq('is_active', true)
    .single()

  if (!integration) {
    throw new Error('Cloudflare Integration nicht gefunden')
  }

  const cloudflareToken = integration.config.api_token
  const cloudflareZoneId = integration.config.zone_id || null

  // ACME Challenge Token generieren (vereinfacht für MVP)
  const challengeToken = generateChallengeToken()
  const challengeValue = await calculateChallengeValue(challengeToken, order.acme_accounts.email)

  // DNS Record bei Cloudflare erstellen
  const recordName = `_acme-challenge.${order.domain.replace('*.', '')}`
  
  await createCloudflareRecord(
    cloudflareToken,
    cloudflareZoneId,
    order.domain.replace('*.', ''),
    recordName,
    challengeValue
  )

  // Warte auf DNS Propagation
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Update Order Status
  await supabase
    .from('acme_orders')
    .update({ 
      status: 'processing',
      last_error: null
    })
    .eq('id', order.id)

  console.log(`[DNS-01] Challenge created for ${order.domain}`)

  // In Production: Validierung bei Let's Encrypt durchführen
  // Dann Zertifikat holen und speichern
  // Für MVP: Markiere als "processing" (manuelle Finalisierung)
}

async function processHTTP01Challenge(supabase: any, order: ACMEOrder): Promise<void> {
  console.log(`[HTTP-01] Processing ${order.domain}`)

  // HTTP-01 erfordert Webserver-Zugriff
  // Für MVP: Setze Anleitung als "last_error"
  await supabase
    .from('acme_orders')
    .update({ 
      status: 'invalid',
      last_error: `HTTP-01 Challenge: Lege Datei unter http://${order.domain}/.well-known/acme-challenge/[token] ab. Details siehe ACME-Guide.`
    })
    .eq('id', order.id)

  console.log(`[HTTP-01] Manual steps required for ${order.domain}`)
}

async function createCloudflareRecord(
  token: string,
  zoneId: string | null,
  domain: string,
  recordName: string,
  value: string
): Promise<void> {
  try {
    let zone = zoneId

    // Falls keine Zone ID, hole sie über API
    if (!zone) {
      const zonesResponse = await fetch(
        'https://api.cloudflare.com/client/v4/zones',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const zonesData = await zonesResponse.json()
      
      // Finde Zone für Domain
      const targetZone = zonesData.result?.find((z: any) => 
        domain === z.name || domain.endsWith('.' + z.name)
      )

      if (!targetZone) {
        throw new Error(`Cloudflare Zone für ${domain} nicht gefunden`)
      }

      zone = targetZone.id
    }

    // Erstelle DNS TXT Record
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'TXT',
          name: recordName,
          content: value,
          ttl: 120,
          comment: 'ACME DNS-01 Challenge - Auto-generated by Zertifikat-Wächter'
        }),
      }
    )

    const data = await response.json()

    if (!data.success) {
      throw new Error(`Cloudflare API Error: ${data.errors?.[0]?.message || 'Unknown'}`)
    }

    console.log(`[Cloudflare] DNS Record created: ${recordName}`)
  } catch (error) {
    console.error('[Cloudflare] Error:', error)
    throw error
  }
}

function generateChallengeToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function calculateChallengeValue(token: string, accountEmail: string): Promise<string> {
  // Vereinfacht für MVP
  // In Production: Korrekte ACME JWS Berechnung
  const encoder = new TextEncoder()
  const data = encoder.encode(token + accountEmail)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hash))
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

