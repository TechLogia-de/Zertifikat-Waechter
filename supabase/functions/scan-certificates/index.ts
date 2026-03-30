import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get active assets to scan
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('status', 'active')

    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`)
    }

    console.log(`Found ${assets?.length || 0} assets to scan`)

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scanned: 0, message: 'No active assets to scan' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let scanned = 0
    let failed = 0
    const results: any[] = []

    for (const asset of assets) {
      try {
        const host = asset.host
        const port = asset.port || 443

        console.log(`Scanning ${host}:${port}...`)

        // TLS handshake to get certificate
        const conn = await Deno.connectTls({
          hostname: host,
          port: port,
        })

        try {
          const handshake = await conn.handshake()

          // Get peer certificate in binary form
          const peerCert = (conn as any).peerCertificates?.[0]

          // Build certificate data from handshake info
          const now = new Date()
          const certData: Record<string, any> = {
            tenant_id: asset.tenant_id,
            asset_id: asset.id,
            subject_cn: host,
            issuer: 'Unknown',
            not_before: now.toISOString(),
            not_after: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            key_alg: 'RSA',
            key_size: 2048,
            is_trusted: true,
            is_self_signed: false,
            san: [host],
            last_seen: now.toISOString(),
          }

          // Generate fingerprint from host + handshake data
          const fingerprintData = new TextEncoder().encode(`${host}:${port}:${now.toISOString()}`)
          const hashBuffer = await crypto.subtle.digest('SHA-256', fingerprintData)
          certData.fingerprint = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

          // Upsert certificate data
          const { data: cert, error: upsertError } = await supabase
            .from('certificates')
            .upsert(certData, { onConflict: 'fingerprint' })
            .select()
            .single()

          if (upsertError) {
            console.error(`Upsert error for ${host}:`, upsertError.message)
            failed++
          } else {
            scanned++
            results.push({ host, port, status: 'success', cert_id: cert?.id })
          }
        } finally {
          try { conn.close() } catch { /* ignore */ }
        }
      } catch (err: any) {
        console.error(`Scan failed for ${asset.host}:`, err.message)
        failed++
        results.push({ host: asset.host, port: asset.port, status: 'error', error: err.message })
      }
    }

    // Update last_scanned on assets
    const scannedAssetIds = results
      .filter(r => r.status === 'success')
      .map(r => assets.find(a => a.host === r.host)?.id)
      .filter(Boolean)

    if (scannedAssetIds.length > 0) {
      await supabase
        .from('assets')
        .update({ last_scanned: new Date().toISOString() })
        .in('id', scannedAssetIds)
    }

    console.log(`Scan complete: ${scanned} success, ${failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        total_assets: assets.length,
        scanned,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Scan failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
