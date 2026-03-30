import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Minimal DER / ASN.1 parser for X.509 certificate fields
// ---------------------------------------------------------------------------

interface DerElement {
  tag: number
  constructed: boolean
  value: Uint8Array
  children?: DerElement[]
  offset: number   // byte offset in the source buffer
  headerLen: number
  totalLen: number
}

/** Parse one DER element starting at `offset` inside `buf`. */
function parseDer(buf: Uint8Array, offset = 0): DerElement {
  if (offset >= buf.length) throw new Error('DER: unexpected end of data')
  const tag = buf[offset]
  const constructed = !!(tag & 0x20)
  let pos = offset + 1

  // Length
  let length: number
  const lenByte = buf[pos++]
  if (lenByte < 0x80) {
    length = lenByte
  } else {
    const numBytes = lenByte & 0x7f
    length = 0
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[pos++]
    }
  }

  const headerLen = pos - offset
  const value = buf.subarray(pos, pos + length)

  const el: DerElement = { tag, constructed, value, offset, headerLen, totalLen: headerLen + length }

  if (constructed) {
    el.children = []
    let childOff = 0
    while (childOff < value.length) {
      const child = parseDer(value, childOff)
      el.children.push(child)
      childOff += child.totalLen
    }
  }

  return el
}

/** Decode a DER UTF8String / PrintableString / IA5String / etc. to JS string. */
function derStringValue(el: DerElement): string {
  return new TextDecoder().decode(el.value)
}

/** OID bytes (content only, no tag/length) to dotted string. */
function oidToString(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const parts: number[] = [Math.floor(bytes[0] / 40), bytes[0] % 40]
  let value = 0
  for (let i = 1; i < bytes.length; i++) {
    value = (value << 7) | (bytes[i] & 0x7f)
    if (!(bytes[i] & 0x80)) {
      parts.push(value)
      value = 0
    }
  }
  return parts.join('.')
}

// Well-known OIDs
const OID_CN = '2.5.4.3'
const OID_O  = '2.5.4.10'
const OID_SAN = '2.5.29.17'
const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1'
const OID_EC_PUBLIC_KEY  = '1.2.840.10045.2.1'
const OID_ED25519        = '1.3.101.112'

// Named EC curves
const EC_CURVES: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
}

/** Extract a human-readable name from an RDN sequence (the first CN found, or O). */
function extractNameFromRdnSequence(seq: DerElement): string {
  if (!seq.children) return 'Unknown'
  let cn = ''
  let org = ''
  for (const rdnSet of seq.children) {
    if (!rdnSet.children) continue
    for (const attrSeq of rdnSet.children) {
      if (!attrSeq.children || attrSeq.children.length < 2) continue
      const oid = oidToString(attrSeq.children[0].value)
      const val = derStringValue(attrSeq.children[1])
      if (oid === OID_CN) cn = val
      if (oid === OID_O) org = val
    }
  }
  return cn || org || 'Unknown'
}

/** Format a full RDN sequence as a single-line distinguished-name string. */
function rdnToString(seq: DerElement): string {
  if (!seq.children) return 'Unknown'
  const parts: string[] = []
  const oidLabels: Record<string, string> = {
    '2.5.4.6': 'C', '2.5.4.8': 'ST', '2.5.4.7': 'L',
    '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.3': 'CN',
  }
  for (const rdnSet of seq.children) {
    if (!rdnSet.children) continue
    for (const attrSeq of rdnSet.children) {
      if (!attrSeq.children || attrSeq.children.length < 2) continue
      const oid = oidToString(attrSeq.children[0].value)
      const val = derStringValue(attrSeq.children[1])
      const label = oidLabels[oid] || oid
      parts.push(`${label}=${val}`)
    }
  }
  return parts.join(', ') || 'Unknown'
}

/** Parse a DER-encoded GeneralizedTime or UTCTime to a JS Date. */
function derTimeToDate(el: DerElement): Date {
  const raw = derStringValue(el)
  // UTCTime: YYMMDDHHMMSSZ
  if (el.tag === 0x17) {
    const yy = parseInt(raw.substring(0, 2), 10)
    const year = yy >= 50 ? 1900 + yy : 2000 + yy
    return new Date(Date.UTC(
      year,
      parseInt(raw.substring(2, 4), 10) - 1,
      parseInt(raw.substring(4, 6), 10),
      parseInt(raw.substring(6, 8), 10),
      parseInt(raw.substring(8, 10), 10),
      parseInt(raw.substring(10, 12), 10),
    ))
  }
  // GeneralizedTime: YYYYMMDDHHMMSSZ
  return new Date(Date.UTC(
    parseInt(raw.substring(0, 4), 10),
    parseInt(raw.substring(4, 6), 10) - 1,
    parseInt(raw.substring(6, 8), 10),
    parseInt(raw.substring(8, 10), 10),
    parseInt(raw.substring(10, 12), 10),
    parseInt(raw.substring(12, 14), 10),
  ))
}

/** Extract the serial number as a colon-separated hex string. */
function serialToHex(el: DerElement): string {
  return Array.from(el.value).map(b => b.toString(16).padStart(2, '0')).join(':')
}

/** Parse Subject Alternative Names from the SAN extension value. */
function parseSanExtension(extValueBytes: Uint8Array): string[] {
  const sans: string[] = []
  try {
    const seq = parseDer(extValueBytes, 0)
    if (seq.children) {
      for (const child of seq.children) {
        // context tag [2] = dNSName (IA5String implicit)
        if ((child.tag & 0x1f) === 2) {
          sans.push(new TextDecoder().decode(child.value))
        }
        // context tag [7] = iPAddress
        if ((child.tag & 0x1f) === 7) {
          if (child.value.length === 4) {
            sans.push(child.value.join('.'))
          } else if (child.value.length === 16) {
            const parts: string[] = []
            for (let i = 0; i < 16; i += 2) {
              parts.push(((child.value[i] << 8) | child.value[i + 1]).toString(16))
            }
            sans.push(parts.join(':'))
          }
        }
      }
    }
  } catch { /* ignore parse errors in SAN */ }
  return sans
}

interface ParsedCert {
  subjectCn: string
  issuer: string
  notBefore: Date
  notAfter: Date
  serialNumber: string
  keyAlg: string
  keySize: number | null
  san: string[]
  isSelfSigned: boolean
}

/** Parse essential fields from a DER-encoded X.509 certificate. */
function parseCertificate(der: Uint8Array): ParsedCert {
  const root = parseDer(der)
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
  const tbs = root.children![0]
  const tbsChildren = tbs.children!

  // The first element may be an explicit [0] version tag
  let idx = 0
  if ((tbsChildren[idx].tag & 0x1f) === 0 && (tbsChildren[idx].tag & 0x80)) {
    idx++ // skip version wrapper
  }

  const serialEl = tbsChildren[idx++]
  const serialNumber = serialToHex(serialEl)

  idx++ // skip signature algorithm inside TBS

  const issuerSeq = tbsChildren[idx++]
  const issuer = rdnToString(issuerSeq)

  // Validity
  const validity = tbsChildren[idx++]
  const notBefore = derTimeToDate(validity.children![0])
  const notAfter  = derTimeToDate(validity.children![1])

  const subjectSeq = tbsChildren[idx++]
  const subjectCn = extractNameFromRdnSequence(subjectSeq)
  const subjectDn = rdnToString(subjectSeq)

  // SubjectPublicKeyInfo
  const spki = tbsChildren[idx++]
  const algSeq = spki.children![0]
  const algOid = oidToString(algSeq.children![0].value)
  let keyAlg = 'Unknown'
  let keySize: number | null = null

  if (algOid === OID_RSA_ENCRYPTION) {
    keyAlg = 'RSA'
    // The public key is a BIT STRING wrapping a SEQUENCE of (modulus, exponent)
    const pubKeyBits = spki.children![1]
    try {
      // Skip the leading 0x00 "unused bits" byte of the BIT STRING
      const inner = parseDer(pubKeyBits.value, 1)
      if (inner.children && inner.children.length >= 1) {
        // Modulus is first INTEGER; key size = bit length
        const modulus = inner.children[0].value
        // Strip leading zero byte used for sign
        const stripped = modulus[0] === 0 ? modulus.subarray(1) : modulus
        keySize = stripped.length * 8
      }
    } catch { /* could not determine RSA key size */ }
  } else if (algOid === OID_EC_PUBLIC_KEY) {
    keyAlg = 'EC'
    if (algSeq.children!.length >= 2) {
      const curveOid = oidToString(algSeq.children![1].value)
      const curveName = EC_CURVES[curveOid]
      if (curveName) {
        keyAlg = `EC ${curveName}`
        const bits: Record<string, number> = { 'P-256': 256, 'P-384': 384, 'P-521': 521 }
        keySize = bits[curveName] ?? null
      }
    }
  } else if (algOid === OID_ED25519) {
    keyAlg = 'Ed25519'
    keySize = 256
  }

  // Extensions (optional, context tag [3])
  let san: string[] = []
  for (let e = idx; e < tbsChildren.length; e++) {
    if ((tbsChildren[e].tag & 0x1f) === 3 && (tbsChildren[e].tag & 0x80)) {
      // Extensions wrapper -> SEQUENCE of Extension
      const extsSeq = parseDer(tbsChildren[e].value, 0)
      if (extsSeq.children) {
        for (const ext of extsSeq.children) {
          if (!ext.children || ext.children.length < 2) continue
          const extOid = oidToString(ext.children[0].value)
          if (extOid === OID_SAN) {
            // The value is an OCTET STRING wrapping the actual SAN sequence
            const octetIdx = ext.children.length === 3 ? 2 : 1
            const octet = ext.children[octetIdx]
            san = parseSanExtension(octet.value)
          }
        }
      }
    }
  }

  const isSelfSigned = issuer === subjectDn

  return { subjectCn, issuer, notBefore, notAfter, serialNumber, keyAlg, keySize, san, isSelfSigned }
}

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

          // Retrieve the peer certificate chain from the TLS handshake.
          // Deno exposes DER-encoded certificates via peerCertificates on the handshake result
          // or on the connection itself depending on the runtime version.
          const peerCerts: Uint8Array[] | undefined =
            (handshake as any).peerCertificates ??
            (conn as any).peerCertificates

          const now = new Date()
          let certData: Record<string, any>

          if (peerCerts && peerCerts.length > 0) {
            const rawCert = peerCerts[0]

            // Generate a real SHA-256 fingerprint from the actual DER bytes
            const hashBuffer = await crypto.subtle.digest('SHA-256', rawCert)
            const fingerprint = Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(':')

            // Parse X.509 fields from the DER-encoded certificate
            const parsed = parseCertificate(rawCert)

            certData = {
              tenant_id: asset.tenant_id,
              asset_id: asset.id,
              subject_cn: parsed.subjectCn,
              issuer: parsed.issuer,
              serial_number: parsed.serialNumber,
              not_before: parsed.notBefore.toISOString(),
              not_after: parsed.notAfter.toISOString(),
              key_alg: parsed.keyAlg,
              key_size: parsed.keySize,
              is_trusted: true,
              is_self_signed: parsed.isSelfSigned,
              san: parsed.san.length > 0 ? parsed.san : [host],
              fingerprint,
              last_seen: now.toISOString(),
            }

            console.log(`Parsed cert for ${host}: CN=${parsed.subjectCn}, expires=${parsed.notAfter.toISOString()}, alg=${parsed.keyAlg}`)
          } else {
            // Fallback: TLS connected but no peer certificate bytes available.
            // This should be rare; log a warning so operators can investigate.
            console.warn(`No peer certificate bytes available for ${host}:${port} – using connection-derived data`)

            const fallbackFpData = new TextEncoder().encode(`${host}:${port}:fallback:${now.toISOString()}`)
            const fallbackHash = await crypto.subtle.digest('SHA-256', fallbackFpData)
            const fingerprint = Array.from(new Uint8Array(fallbackHash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(':')

            certData = {
              tenant_id: asset.tenant_id,
              asset_id: asset.id,
              subject_cn: host,
              issuer: 'Unknown (no peer cert available)',
              not_before: null,
              not_after: null,
              key_alg: 'Unknown',
              key_size: null,
              is_trusted: true,
              is_self_signed: false,
              san: [host],
              fingerprint,
              last_seen: now.toISOString(),
            }
          }

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
