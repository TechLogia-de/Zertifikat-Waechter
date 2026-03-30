// Utility functions for webhook validation, signing, and error formatting

/**
 * Validate a webhook URL: enforce HTTPS and block private IP ranges.
 * Allows localhost for development purposes.
 */
export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Only allow HTTPS (except localhost for dev)
    if (parsed.protocol !== 'https:' && !parsed.hostname.includes('localhost')) {
      throw new Error('Nur HTTPS URLs sind erlaubt (außer localhost)')
    }

    // Block private IP ranges
    const hostname = parsed.hostname.toLowerCase()
    const privatePatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/
    ]

    // localhost is OK for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true
    }

    // Block private IPs in production
    if (privatePatterns.some(pattern => pattern.test(hostname))) {
      throw new Error('Private IP-Adressen sind nicht erlaubt')
    }

    return true
  } catch (err: any) {
    throw new Error(`Ungültige URL: ${err.message}`)
  }
}

/**
 * Compute an HMAC-SHA256 signature for a webhook payload using the Web Crypto API.
 */
export async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
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

/**
 * Format a user-friendly error message from a webhook test failure.
 */
export function formatWebhookError(
  errMessage: string,
  webhookUrl: string,
  timeoutSeconds?: number
): string {
  if (errMessage.includes('NetworkError') || errMessage.includes('Failed to fetch')) {
    const isLocalhost = webhookUrl.includes('localhost')

    if (isLocalhost) {
      return (
        `❌ Lokaler Webhook-Server nicht erreichbar!\n\n` +
        `Bitte starte den Test-Server:\n\n` +
        `1️⃣ Öffne ein Terminal im Projekt-Root\n` +
        `2️⃣ Führe aus: node test-webhook-server.js\n` +
        `3️⃣ Warte bis "Test-Webhook-Server gestartet!" erscheint\n` +
        `4️⃣ Klicke erneut auf "Test senden"\n\n` +
        `Verwendete URL: ${webhookUrl}\n` +
        `Erwartete URL: http://localhost:3333/webhook`
      )
    }

    return (
      `Verbindung zum Webhook fehlgeschlagen.\n\n` +
      `Mögliche Ursachen:\n` +
      `• Webhook-Server läuft nicht oder ist nicht erreichbar\n` +
      `• Firewall blockiert die Verbindung\n` +
      `• CORS-Header fehlen auf dem Server\n` +
      `• URL ist falsch: ${webhookUrl}\n\n` +
      `Prüfe ob der Server läuft:\n` +
      `curl -X POST ${webhookUrl} -d '{"test": true}'`
    )
  }

  if (errMessage.includes('Timeout')) {
    return (
      `Webhook antwortet nicht (Timeout nach ${timeoutSeconds}s).\n\n` +
      `Mögliche Ursachen:\n` +
      `• Server ist langsam oder nicht erreichbar\n` +
      `• Erhöhe den Timeout in den Einstellungen\n` +
      `• Prüfe Firewall-Regeln`
    )
  }

  return errMessage
}
