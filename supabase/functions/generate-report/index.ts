import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // CORS Headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { tenant_id, format = 'csv', filters = {} } = await req.json()

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Build query
    let query = supabase
      .from('certificates')
      .select(`
        *,
        assets(host, port, proto)
      `)
      .eq('tenant_id', tenant_id)
      .order('not_after', { ascending: true })

    // Apply filters
    if (filters.expired) {
      query = query.lt('not_after', new Date().toISOString())
    }
    if (filters.expiringSoon) {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      query = query.lte('not_after', thirtyDaysFromNow.toISOString())
    }
    if (filters.search) {
      query = query.ilike('subject_cn', `%${filters.search}%`)
    }

    const { data: certificates, error } = await query

    if (error) throw error

    if (!certificates || certificates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No certificates found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate Report
    if (format === 'csv') {
      const csv = generateCSV(certificates)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="certificates-${new Date().toISOString().split('T')[0]}.csv"`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    } else if (format === 'json') {
      return new Response(JSON.stringify(certificates, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="certificates-${new Date().toISOString().split('T')[0]}.json"`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    } else if (format === 'html') {
      const html = generateHTML(certificates, tenant_id)
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    return new Response(
      JSON.stringify({ error: 'Invalid format. Use csv, json, or html' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Report generation failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateCSV(certificates: any[]): string {
  const headers = [
    'Subject CN',
    'Host',
    'Port',
    'Issuer',
    'Valid From',
    'Valid Until',
    'Days Remaining',
    'Status',
    'Key Algorithm',
    'Key Size',
    'Serial',
    'Fingerprint',
    'Self-Signed',
  ]

  const rows = certificates.map(cert => {
    const asset = cert.assets || {}
    const now = new Date()
    const expiryDate = new Date(cert.not_after)
    const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    let status = 'Valid'
    if (daysRemaining < 0) status = 'Expired'
    else if (daysRemaining < 7) status = 'Critical'
    else if (daysRemaining < 30) status = 'Warning'
  
  return [
      cert.subject_cn || '',
      asset.host || '',
      asset.port || '',
      cert.issuer || '',
      new Date(cert.not_before).toISOString(),
      new Date(cert.not_after).toISOString(),
      daysRemaining.toString(),
      status,
      cert.key_alg || '',
      cert.key_size?.toString() || '',
      cert.serial || '',
      cert.fingerprint || '',
      cert.is_self_signed ? 'Yes' : 'No',
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

function generateHTML(certificates: any[], tenant_id: string): string {
  const now = new Date()
  const reportDate = now.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const stats = {
    total: certificates.length,
    valid: 0,
    warning: 0,
    critical: 0,
    expired: 0,
  }

  const rows = certificates.map(cert => {
    const asset = cert.assets || {}
    const expiryDate = new Date(cert.not_after)
    const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    let status = 'valid'
    let statusColor = '#10B981'
    let statusLabel = 'Gültig'
    
    if (daysRemaining < 0) {
      status = 'expired'
      statusColor = '#991B1B'
      statusLabel = 'Abgelaufen'
      stats.expired++
    } else if (daysRemaining < 7) {
      status = 'critical'
      statusColor = '#EF4444'
      statusLabel = 'Kritisch'
      stats.critical++
    } else if (daysRemaining < 30) {
      status = 'warning'
      statusColor = '#F59E0B'
      statusLabel = 'Warnung'
      stats.warning++
    } else {
      stats.valid++
    }

    return `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="px-4 py-3 font-mono text-sm">${cert.subject_cn || 'N/A'}</td>
        <td class="px-4 py-3 text-sm">${asset.host || 'N/A'}:${asset.port || ''}</td>
        <td class="px-4 py-3 text-sm">${cert.issuer || 'N/A'}</td>
        <td class="px-4 py-3 text-sm">${expiryDate.toLocaleDateString('de-DE')}</td>
        <td class="px-4 py-3 text-sm font-bold" style="color: ${statusColor}">
          ${daysRemaining >= 0 ? daysRemaining + ' Tage' : 'Abgelaufen'}
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 text-xs font-semibold rounded" style="background-color: ${statusColor}20; color: ${statusColor}">
            ${statusLabel}
          </span>
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zertifikat-Report - ${reportDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F8FAFC;
      padding: 40px 20px;
      color: #0F172A;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
      color: white;
      padding: 40px;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 40px;
      border-bottom: 1px solid #E2E8F0;
    }
    .stat-card {
      text-align: center;
      padding: 20px;
      background: #F8FAFC;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .stat-label {
      font-size: 14px;
      color: #64748B;
      font-weight: 500;
    }
    .table-container {
      padding: 40px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #F8FAFC;
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #E2E8F0;
    }
    td {
      padding: 12px 16px;
    }
    .footer {
      padding: 20px 40px;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      text-align: center;
      font-size: 12px;
      color: #94A3B8;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Zertifikat-Bericht</h1>
      <p>Generiert am ${reportDate}</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value" style="color: #3B82F6">${stats.total}</div>
        <div class="stat-label">Gesamt Zertifikate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #10B981">${stats.valid}</div>
        <div class="stat-label">Gültig</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #F59E0B">${stats.warning}</div>
        <div class="stat-label">Warnung</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #EF4444">${stats.critical}</div>
        <div class="stat-label">Kritisch</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #991B1B">${stats.expired}</div>
        <div class="stat-label">Abgelaufen</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Common Name</th>
            <th>Host:Port</th>
            <th>Aussteller</th>
            <th>Läuft ab</th>
            <th>Verbleibend</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p><strong>Zertifikat-Wächter</strong> • SSL/TLS Certificate Monitoring</p>
      <p style="margin-top: 8px">Dieser Bericht wurde automatisch generiert und ist nur für interne Zwecke bestimmt.</p>
    </div>
  </div>

  <script>
    // Auto-Print für PDF-Export
    if (window.location.search.includes('print=true')) {
      window.print();
    }
  </script>
</body>
</html>
  `
}
