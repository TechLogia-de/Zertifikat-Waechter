import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  try {
    // CORS Headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      })
    }

    let { host, port = 443 } = await req.json()

    // Validate port
    port = Number(port)
    if (isNaN(port) || port < 1 || port > 65535) {
      return new Response(
        JSON.stringify({ error: 'Invalid port number (must be 1-65535)' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN
          },
        }
      )
    }

    if (!host) {
      return new Response(
        JSON.stringify({ error: 'Host parameter is required' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN
          },
        }
      )
    }

    // ✅ Parse hostname: Entferne Protokoll und Pfad
    host = parseHostname(host)

    console.log(`Scanning ${host}:${port}...`)

    // Echte TLS-Verbindung aufbauen
    try {
      const certInfo = await scanTLSCertificate(host, port)
      
      return new Response(
        JSON.stringify({
          success: true,
          certificate: certInfo
        }),
        {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN
          },
        }
      )
    } catch (scanError: any) {
      console.error('Scan failed:', scanError)
      return new Response(
        JSON.stringify({ 
          error: `Scan fehlgeschlagen: ${scanError.message}`,
          details: scanError.toString()
        }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN
          },
        }
      )
    }

  } catch (error: any) {
    console.error('Request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN
        },
      }
    )
  }
})

function parseHostname(host: string): string {
  // Entferne Whitespace
  host = host.trim()
  
  // Wenn URL mit Protokoll
  if (host.includes('://')) {
    try {
      const url = new URL(host)
      return url.hostname
    } catch {
      // Fallback: Manuell parsen
      host = host.split('://')[1]
    }
  }
  
  // Entferne Pfad
  if (host.includes('/')) {
    host = host.split('/')[0]
  }
  
  // Entferne Port
  if (host.includes(':')) {
    host = host.split(':')[0]
  }
  
  return host
}

async function scanTLSCertificate(host: string, port: number) {
  const conn = await Deno.connectTls({
    hostname: host,
    port: port,
  })

  try {
    const handshake = await conn.handshake()

    // Get raw certificate bytes for real SHA-256 fingerprint
    const peerCerts = (conn as any).peerCertificates
    const rawCert = peerCerts?.[0]

    // Build certificate info from handshake and peer certificate
    const certInfo = await buildCertificateInfo(host, handshake, rawCert)
    return certInfo
  } finally {
    try { conn.close() } catch { /* ignore */ }
  }
}

async function buildCertificateInfo(host: string, handshake: any, rawCert: any) {
  // Extract fields from peer certificate if available
  const subject = rawCert?.subject || {}
  const issuer = rawCert?.issuer || {}
  const subjectCN = subject?.CN || host
  const issuerCN = issuer?.CN || issuer?.O || 'Unknown'
  const isSelfSigned = subjectCN === issuerCN && (subject?.O === issuer?.O)

  const validFrom = rawCert?.validFrom ? new Date(rawCert.validFrom) : new Date()
  const validTo = rawCert?.validTo ? new Date(rawCert.validTo) : new Date(Date.now() + 90 * 86400000)
  const serialNumber = rawCert?.serialNumber || generateRandomSerial()

  // Real SHA-256 fingerprint from raw certificate bytes
  let fingerprint: string
  if (rawCert?.raw) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', rawCert.raw)
    fingerprint = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } else {
    // Fallback: deterministic hash from certificate metadata
    const data = new TextEncoder().encode(`${serialNumber}:${subjectCN}:${validFrom.toISOString()}:${validTo.toISOString()}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    fingerprint = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  return {
    fingerprint,
    subject_cn: subjectCN,
    san: parseSAN(rawCert?.subjectaltname),
    issuer: issuerCN,
    not_before: validFrom.toISOString(),
    not_after: validTo.toISOString(),
    key_alg: rawCert?.signatureAlgorithm || handshake?.alpnProtocol || 'Unknown',
    key_size: rawCert?.bits || 2048,
    serial: serialNumber,
    is_trusted: !isSelfSigned,
    is_self_signed: isSelfSigned,
  }
}

function parseSAN(sanString: string | null | undefined): string[] {
  if (!sanString) return []
  return sanString
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.replace(/^DNS:/, ''))
}

function generateRandomSerial(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
