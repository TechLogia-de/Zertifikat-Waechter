import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export function useScanDomain() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function scanDomain(assetId: string, host: string, port: number) {
    setScanning(true)
    setError(null)

    try {
      console.log('Scanning certificate for:', { assetId, host, port })

      // Vereinfachter Scan: Hole Cert-Info über externe API
      // Für MVP: Verwende SSL Labs API oder direkten Fetch
      const certData = await scanCertificateSimple(host, port)

      // Hole Asset für tenant_id
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('tenant_id')
        .eq('id', assetId)
        .single()

      if (assetError || !asset) {
        throw new Error('Asset nicht gefunden')
      }

      const assetData = asset as any

      // Speichere Zertifikat in DB
      const certificateInsert: Database['public']['Tables']['certificates']['Insert'] = {
        tenant_id: assetData.tenant_id,
        asset_id: assetId,
        fingerprint: certData.fingerprint,
        subject_cn: certData.subject_cn,
        san: certData.san,
        issuer: certData.issuer,
        not_before: certData.not_before,
        not_after: certData.not_after,
        key_alg: certData.key_alg,
        key_size: certData.key_size,
        serial: certData.serial,
        is_trusted: certData.is_trusted ?? true,
        is_self_signed: certData.is_self_signed ?? false
      }

      const { data: certificate, error: certError } = await supabase
        .from('certificates')
        .upsert(certificateInsert as any, {
          onConflict: 'fingerprint'
        })
        .select()
        .single()

      if (certError || !certificate) {
        console.error('Certificate save error:', certError)
        throw new Error('Fehler beim Speichern: ' + (certError?.message || 'Unbekannter Fehler'))
      }

      // Type-safe certificate data
      const certData2: any = certificate

      // Check-Eintrag erstellen
      const checkInsert: Database['public']['Tables']['checks']['Insert'] = {
        certificate_id: certData2.id,
        ran_at: new Date().toISOString(),
        status: 'success',
        details: {
          scanned_by: 'frontend',
          host: host,
          port: port
        }
      }

      await supabase
        .from('checks')
        .insert(checkInsert as any)

      console.log('✅ ECHTE ZERTIFIKATSDATEN gespeichert:', {
        domain: certData2.subject_cn,
        issuer: certData2.issuer,
        expires: certData2.not_after,
        fingerprint: certData2.fingerprint?.substring(0, 16) + '...'
      })
      
      return certData2
    } catch (err: any) {
      console.error('Scan error:', err)
      setError(err.message || 'Scan fehlgeschlagen')
      throw err
    } finally {
      setScanning(false)
    }
  }

  return { scanDomain, scanning, error }
}

async function scanCertificateSimple(host: string, port: number) {
  try {
    console.log(`🔍 Scanning TLS certificate for ${host}:${port}...`)
    
    // Methode 1: Python Worker API - ECHTE SCANS!
    // In Production: /api/ (Nginx Reverse Proxy)
    // In Development: http://localhost:5000
    const apiUrl = import.meta.env.VITE_WORKER_API_URL || '/api'
    
    try {
      console.log('Trying Worker API...', apiUrl)
      const workerResponse = await fetch(`${apiUrl}/scan-certificate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host, port })
      })

      if (workerResponse.ok) {
        const workerData = await workerResponse.json()
        if (workerData.success && workerData.certificate) {
          console.log('✅ Worker API scan successful! REAL DATA!')
          return workerData.certificate
        }
      }
      
      console.warn('⚠️ Worker API failed:', await workerResponse.text())
    } catch (workerError) {
      console.warn('⚠️ Worker API not available:', workerError)
    }

    // Methode 2: Supabase Edge Function (falls deployed)
    try {
      console.log('Trying Edge Function...')
      const { data, error } = await supabase.functions.invoke('scan-domain', {
        body: { host, port }
      })

      if (!error && data?.certificate) {
        console.log('✅ Edge Function scan successful! REAL DATA!')
        return data.certificate
      }
      
      console.warn('⚠️ Edge Function not available')
    } catch (edgeFunctionError) {
      console.warn('⚠️ Edge Function error:', edgeFunctionError)
    }

    // Methode 3: SSL Labs API (nur für HTTPS, öffentliche Domains)
    if (port === 443) {
      try {
        console.log('Trying SSL Labs API...')
        const sslLabsData = await fetchFromSSLLabs(host)
        if (sslLabsData) {
          console.log('✅ SSL Labs API scan successful! REAL DATA!')
          return sslLabsData
        }
      } catch (sslLabsError) {
        console.warn('⚠️ SSL Labs API failed:', sslLabsError)
      }
    }

    // KEIN Fallback mehr - zeige Fehler
    const isDev = apiUrl.includes('localhost')
    throw new Error(
      isDev 
        ? `❌ Scan fehlgeschlagen!\n\n` +
          `Der Worker API ist nicht erreichbar.\n\n` +
          `STARTE DEN WORKER:\n` +
          `1. Öffne neues Terminal\n` +
          `2. cd worker\n` +
          `3. python api.py\n\n` +
          `Der Worker läuft dann auf http://localhost:5000`
        : `❌ Scan fehlgeschlagen!\n\n` +
          `Der Backend-Service ist nicht verfügbar.\n` +
          `Bitte kontaktiere den Administrator.`
    )
  } catch (error) {
    throw error
  }
}

// SSL Labs API Helper (nur für öffentliche HTTPS Domains, cached data only)
async function fetchFromSSLLabs(host: string) {
  try {
    // SSL Labs API: Nur gecachte Daten, kein neuer Scan
    const apiUrl = `https://api.ssllabs.com/api/v3/analyze?host=${host}&fromCache=on&maxAge=24&all=done`
    
    const response = await fetch(apiUrl)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    // Nur wenn bereits gecacht UND fertig
    if (data.status === 'READY' && data.endpoints?.[0]?.details?.cert) {
      const cert = data.endpoints[0].details.cert
      
      return {
        fingerprint: cert.sha256Hash || await generateFingerprint(host),
        subject_cn: cert.subject || host,
        san: cert.altNames || [host],
        issuer: cert.issuerLabel || 'Unknown',
        not_before: new Date(cert.notBefore).toISOString(),
        not_after: new Date(cert.notAfter).toISOString(),
        key_alg: cert.sigAlg || 'Unknown',
        key_size: cert.keySize || 0,
        serial: cert.serialNumber || '',
        is_trusted: data.endpoints[0].grade !== 'T',
        is_self_signed: false
      }
    }

    return null
  } catch (error) {
    return null
  }
}

async function generateFingerprint(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text + Date.now())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

