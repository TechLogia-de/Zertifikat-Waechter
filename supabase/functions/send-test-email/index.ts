// @ts-ignore: Deno runtime
import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { smtp_config, to, subject, body } = await req.json()
    
    console.log('Sending email to:', to)

    // SMTP über TLS Connection
    let conn
    
    if (smtp_config.port === 465) {
      // SSL
      // @ts-ignore: Deno runtime
      conn = await Deno.connectTls({
        hostname: smtp_config.host,
        port: smtp_config.port,
      })
    } else {
      // Plain oder STARTTLS
      // @ts-ignore: Deno runtime
      conn = await Deno.connect({
        hostname: smtp_config.host,
        port: smtp_config.port,
      })
    }

    const textEncoder = new TextEncoder()
    const textDecoder = new TextDecoder()

    async function read() {
      const buffer = new Uint8Array(1024)
      const n = await conn.read(buffer)
      if (!n) return ''
      return textDecoder.decode(buffer.subarray(0, n))
    }

    async function write(data: string) {
      await conn.write(textEncoder.encode(data + '\r\n'))
    }

    // SMTP Dialog
    await read() // Banner
    await write('EHLO zertifikat-waechter.local')
    await read()

    if (smtp_config.port === 587) {
      await write('STARTTLS')
      await read()
      // TLS upgrade
      // @ts-ignore: Deno runtime
      conn = await Deno.startTls(conn, { hostname: smtp_config.host })
      await write('EHLO zertifikat-waechter.local')
      await read()
    }

    // Auth
    await write('AUTH LOGIN')
    await read()
    await write(btoa(smtp_config.user))
    await read()
    await write(btoa(smtp_config.password))
    const authResp = await read()
    
    if (!authResp.includes('235')) {
      throw new Error('SMTP Auth fehlgeschlagen')
    }

    // Mail senden
    await write(`MAIL FROM:<${smtp_config.from}>`)
    await read()
    await write(`RCPT TO:<${to}>`)
    await read()
    await write('DATA')
    await read()

    const emailData = `From: ${smtp_config.from}
To: ${to}
Subject: ${subject || '🛡️ Test von Zertifikat-Wächter'}
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

${buildEmailHTML(subject, body, smtp_config)}
.`

    await write(emailData)
    await read()
    await write('QUIT')
    conn.close()

    console.log('Email sent successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Test-E-Mail erfolgreich an ${to} gesendet`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('SMTP Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'SMTP-Verbindung fehlgeschlagen'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildEmailHTML(subject: string, body: string, smtp_config: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 20px; background-color: #F8FAFC;">
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🛡️ Zertifikat-Wächter</h1>
            <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 14px;">SSL/TLS Monitoring</p>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0F172A; margin-top: 0; font-size: 22px;">${subject || 'Test-E-Mail'}</h2>
            <p style="color: #64748B; line-height: 1.6; font-size: 16px;">${body || 'Dies ist eine Test-E-Mail um zu prüfen ob deine SMTP-Konfiguration funktioniert.'}</p>
            <div style="margin-top: 30px; padding: 20px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #10B981;">
              <p style="margin: 0; color: #065F46; font-weight: bold; font-size: 16px;">✅ E-Mail-Versand funktioniert!</p>
              <p style="margin: 10px 0 0 0; color: #64748B; font-size: 14px;">
                Server: ${smtp_config.host}:${smtp_config.port}<br>
                Absender: ${smtp_config.from}
              </p>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 20px;">
              Diese E-Mail wurde von Zertifikat-Wächter gesendet.<br>
              Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

