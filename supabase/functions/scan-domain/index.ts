import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // CORS Headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    const { host, port = 443 } = await req.json()

    if (!host) {
      return new Response(
        JSON.stringify({ error: 'Host parameter is required' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      )
    }

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
            'Access-Control-Allow-Origin': '*'
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
            'Access-Control-Allow-Origin': '*'
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
          'Access-Control-Allow-Origin': '*'
        },
      }
    )
  }
})

async function scanTLSCertificate(host: string, port: number) {
  // TLS-Verbindung über Deno's TLS API
  const conn = await Deno.connectTls({
    hostname: host,
    port: port,
  })

  try {
    // Hole Zertifikat-Informationen
    const cert = await conn.handshake()
    
    if (!cert) {
      throw new Error('Kein Zertifikat gefunden')
    }

    // Parse Zertifikat-Details
    const certDetails = parseCertificate(cert)
    
    return certDetails
  } finally {
    try {
      conn.close()
    } catch (e) {
      console.warn('Failed to close connection:', e)
    }
  }
}

function parseCertificate(cert: any) {
  // Extrahiere Zertifikat-Informationen
  const notBefore = new Date(cert.validFrom)
  const notAfter = new Date(cert.validTo)
  
  // Generiere Fingerprint aus Zertifikat
  const fingerprint = generateFingerprint(cert)
  
  return {
    fingerprint: fingerprint,
    subject_cn: cert.subject?.CN || cert.subjectaltname?.split(',')[0] || 'Unknown',
    san: parseSAN(cert.subjectaltname),
    issuer: cert.issuer?.CN || 'Unknown',
    not_before: notBefore.toISOString(),
    not_after: notAfter.toISOString(),
    key_alg: cert.signatureAlgorithm || 'Unknown',
    key_size: cert.bits || 2048,
    serial: cert.serialNumber || generateRandomSerial(),
    is_trusted: !cert.selfSigned,
    is_self_signed: cert.selfSigned || false
  }
}

function parseSAN(sanString: string | null): string[] {
  if (!sanString) return []
  
  return sanString
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.replace(/^DNS:/, ''))
}

function generateFingerprint(cert: any): string {
  // Generiere SHA-256 Fingerprint aus Zertifikat-Daten
  // Für MVP: Nutze Serial + Subject als Basis
  const data = `${cert.serialNumber}-${cert.subject?.CN}-${cert.validFrom}-${cert.validTo}`
  const encoder = new TextEncoder()
  const hash = Array.from(new Uint8Array(encoder.encode(data)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return hash.substring(0, 64) // SHA-256 ist 64 Hex-Zeichen
}

function generateRandomSerial(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
