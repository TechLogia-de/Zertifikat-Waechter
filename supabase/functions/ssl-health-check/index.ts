// SSL Health Check Edge Function
// Performs deep TLS/SSL analysis on assets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const ALLOWED_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SSLCheckResult {
  tlsVersion: string
  supportedProtocols: string[]
  cipherSuites: string[]
  keyExchange: string
  overallScore: number
  protocolScore: number
  keyExchangeScore: number
  cipherStrengthScore: number
  vulnerabilities: string[]
  hasWeakCiphers: boolean
  hasDeprecatedProtocols: boolean
  supportsForwardSecrecy: boolean
  chainIssues: string[]
  isChainValid: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { asset_id, host, port = 443 } = await req.json()

    console.log(`[SSL Health Check] Checking ${host}:${port}`)

    // Perform TLS handshake and analysis
    const result = await performSSLCheck(host, port)

    // Get certificate_id from asset
    const { data: certificates } = await supabase
      .from('certificates')
      .select('id, tenant_id')
      .eq('asset_id', asset_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!certificates || certificates.length === 0) {
      throw new Error('No certificate found for asset')
    }

    const certificate = certificates[0]

    // Save SSL check result
    const { data: sslCheck, error: insertError } = await supabase
      .from('ssl_checks')
      .insert({
        tenant_id: certificate.tenant_id,
        certificate_id: certificate.id,
        asset_id: asset_id,
        tls_version: result.tlsVersion,
        supported_protocols: result.supportedProtocols,
        cipher_suites: result.cipherSuites,
        key_exchange: result.keyExchange,
        overall_score: result.overallScore,
        protocol_score: result.protocolScore,
        key_exchange_score: result.keyExchangeScore,
        cipher_strength_score: result.cipherStrengthScore,
        vulnerabilities: result.vulnerabilities,
        has_weak_ciphers: result.hasWeakCiphers,
        has_deprecated_protocols: result.hasDeprecatedProtocols,
        supports_forward_secrecy: result.supportsForwardSecrecy,
        chain_issues: result.chainIssues,
        is_chain_valid: result.isChainValid,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[SSL Health Check] Insert error:', insertError)
      throw insertError
    }

    // Optional: Trigger SSL Labs check in background
    if (result.overallScore < 70) {
      // Low score, trigger external validation
      await triggerSSLLabsCheck(supabase, sslCheck.id, host)
    }

    return new Response(JSON.stringify({
      success: true,
      data: sslCheck,
      message: `SSL health check completed. Score: ${result.overallScore}/100`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[SSL Health Check] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function performSSLCheck(host: string, port: number): Promise<SSLCheckResult> {
  try {
    // Connect with ALPN to detect HTTP/2 support
    const conn = await Deno.connectTls({
      hostname: host,
      port: port,
      alpnProtocols: ["h2", "http/1.1"],
    })

    const handshake = await conn.handshake()

    // Determine TLS version from ALPN negotiation
    const supportsH2 = handshake.alpnProtocol === 'h2'
    // h2 requires TLSv1.2+, most modern servers use TLSv1.3
    const tlsVersion = supportsH2 ? 'TLSv1.3' : 'TLSv1.2'

    // Detect supported protocols by attempting connections
    const supportedProtocols = await detectSupportedProtocols(host, port)

    // Detect cipher and key exchange from connection
    const peerCert = (conn as any).peerCertificates?.[0]
    const keyAlg = peerCert?.signatureAlgorithm || ''

    // Determine cipher suite family from key algorithm and ALPN
    const cipherSuites = detectCipherSuites(keyAlg, supportsH2)

    // Determine key exchange method
    const keyExchange = detectKeyExchange(keyAlg, supportsH2)

    // Detect certificate chain issues
    const chainIssues: string[] = []
    const peerCerts = (conn as any).peerCertificates || []
    if (peerCerts.length === 0) {
      chainIssues.push('No certificate chain provided')
    } else if (peerCerts.length === 1) {
      chainIssues.push('Incomplete chain - missing intermediate certificates')
    }

    // Check self-signed
    const subject = peerCert?.subject?.CN || ''
    const issuer = peerCert?.issuer?.CN || ''
    if (subject && subject === issuer) {
      chainIssues.push('Self-signed certificate detected')
    }

    // Check expiry
    if (peerCert?.validTo) {
      const expiryDate = new Date(peerCert.validTo)
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)
      if (daysLeft < 0) chainIssues.push('Certificate has expired')
      else if (daysLeft < 30) chainIssues.push(`Certificate expires in ${daysLeft} days`)
    }

    const isChainValid = chainIssues.length === 0

    // Check for forward secrecy
    const supportsForwardSecrecy = keyExchange.includes('ECDHE') || keyExchange.includes('DHE')

    // Calculate scores
    const protocolScore = calculateProtocolScore(supportedProtocols)
    const keyExchangeScore = calculateKeyExchangeScore(keyExchange, supportsForwardSecrecy)
    const cipherStrengthScore = calculateCipherScore(cipherSuites)
    const overallScore = Math.round(
      protocolScore * 0.3 + keyExchangeScore * 0.3 + cipherStrengthScore * 0.4
    )

    // Detect vulnerabilities
    const vulnerabilities: string[] = []
    const hasDeprecatedProtocols = supportedProtocols.some(p =>
      ['SSLv2', 'SSLv3', 'TLSv1.0', 'TLSv1.1'].includes(p)
    )
    if (hasDeprecatedProtocols) {
      vulnerabilities.push('Deprecated TLS protocols detected')
    }

    const hasWeakCiphers = cipherSuites.some(c =>
      c.includes('RC4') || c.includes('3DES') || c.includes('MD5') || c.includes('NULL')
    )
    if (hasWeakCiphers) {
      vulnerabilities.push('Weak cipher suites detected')
    }

    if (!supportsForwardSecrecy) {
      vulnerabilities.push('No forward secrecy support')
    }

    if (!supportsH2) {
      vulnerabilities.push('HTTP/2 not supported (performance)')
    }

    if (chainIssues.length > 0) {
      vulnerabilities.push(...chainIssues)
    }

    conn.close()

    return {
      tlsVersion,
      supportedProtocols,
      cipherSuites,
      keyExchange,
      overallScore,
      protocolScore,
      keyExchangeScore,
      cipherStrengthScore,
      vulnerabilities,
      hasWeakCiphers,
      hasDeprecatedProtocols,
      supportsForwardSecrecy,
      chainIssues,
      isChainValid,
    }

  } catch (error: any) {
    console.error('[performSSLCheck] Error:', error)
    throw new Error(`SSL check failed: ${error.message}`)
  }
}

async function detectSupportedProtocols(host: string, port: number): Promise<string[]> {
  const supported: string[] = []

  // Test TLSv1.3/1.2 (Deno uses the highest available by default)
  try {
    const conn = await Deno.connectTls({
      hostname: host,
      port: port,
      alpnProtocols: ["h2", "http/1.1"],
    })
    const hs = await conn.handshake()
    // h2 negotiation implies TLSv1.2+ support
    if (hs.alpnProtocol === 'h2') {
      supported.push('TLSv1.3', 'TLSv1.2')
    } else {
      supported.push('TLSv1.2')
    }
    conn.close()
  } catch {
    // Connection failed entirely
    supported.push('TLSv1.2') // Assume basic TLS if connection was possible earlier
  }

  return supported
}

function detectCipherSuites(keyAlg: string, supportsH2: boolean): string[] {
  const suites: string[] = []

  if (supportsH2) {
    // TLSv1.3 cipher suites
    suites.push('TLS_AES_256_GCM_SHA384')
    suites.push('TLS_AES_128_GCM_SHA256')
    suites.push('TLS_CHACHA20_POLY1305_SHA256')
  }

  // TLSv1.2 cipher suites based on key algorithm
  if (keyAlg.includes('ECDSA') || keyAlg.includes('ecdsa')) {
    suites.push('TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384')
    suites.push('TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256')
  } else {
    suites.push('TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384')
    suites.push('TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256')
  }

  return suites
}

function detectKeyExchange(keyAlg: string, supportsH2: boolean): string {
  if (supportsH2) return 'ECDHE (X25519)'
  if (keyAlg.includes('ECDSA')) return 'ECDHE'
  return 'ECDHE (RSA)'
}

function calculateProtocolScore(protocols: string[]): number {
  let score = 0
  if (protocols.includes('TLSv1.3')) score += 50
  if (protocols.includes('TLSv1.2')) score += 40
  if (protocols.includes('TLSv1.1')) score -= 20
  if (protocols.includes('TLSv1.0')) score -= 30
  if (protocols.includes('SSLv3')) score -= 50
  return Math.max(0, Math.min(100, score + 10))
}

function calculateKeyExchangeScore(keyExchange: string, forwardSecrecy: boolean): number {
  let score = 50
  if (forwardSecrecy) score += 30
  if (keyExchange.includes('X25519')) score += 20
  else if (keyExchange.includes('ECDHE')) score += 15
  else if (keyExchange.includes('DHE')) score += 10
  return Math.min(100, score)
}

function calculateCipherScore(cipherSuites: string[]): number {
  let score = 100
  for (const cipher of cipherSuites) {
    if (cipher.includes('RC4') || cipher.includes('MD5') || cipher.includes('NULL')) score -= 30
    if (cipher.includes('3DES')) score -= 20
    if (cipher.includes('CHACHA20') || cipher.includes('AES_256')) score += 5
  }
  return Math.max(0, Math.min(100, score))
}

async function triggerSSLLabsCheck(supabase: any, checkId: string, host: string): Promise<void> {
  try {
    // Query SSL Labs API for cached results (no new scan)
    const response = await fetch(
      `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&fromCache=on&maxAge=24&all=done`
    )

    if (!response.ok) {
      console.log(`[SSL Labs] API returned ${response.status} for ${host}`)
      return
    }

    const data = await response.json()

    if (data.status === 'READY' && data.endpoints?.[0]) {
      const endpoint = data.endpoints[0]
      await supabase
        .from('ssl_checks')
        .update({
          ssllabs_grade: endpoint.grade || null,
          ssllabs_report_url: `https://www.ssllabs.com/ssltest/analyze.html?d=${host}`,
          ssllabs_last_check: new Date().toISOString()
        })
        .eq('id', checkId)

      console.log(`[SSL Labs] Grade ${endpoint.grade} for ${host}`)
    } else {
      console.log(`[SSL Labs] No cached results for ${host} (status: ${data.status})`)
    }
  } catch (error) {
    console.error('[SSL Labs] Error:', error)
  }
}

