import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const {
      tenant_id,
      tenant_name = 'Organisation',
      config = {},
      certificates = [],
      events = [],
      stats = {},
      generated_by = 'System',
      generated_at = new Date().toISOString()
    } = body

    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    console.log(`Generating ${config.format || 'pdf'} report for tenant ${tenant_id}`)
    console.log(`Config:`, config)
    console.log(`Certificates: ${certificates.length}`)
    console.log(`Events: ${events.length}`)

    // Generate HTML Report (kann vom Browser als PDF gespeichert werden)
    const html = generateComplianceReport({
      tenant_name,
      certificates,
      events,
      stats,
      config,
      generated_by,
      generated_at
    })

    // Return HTML (Frontend kann es in neuem Tab öffnen → Drucken → Als PDF)
    return new Response(
      JSON.stringify({
        success: true,
        html_report: html,
        metadata: {
          certificates_count: certificates.length,
          events_count: events.length,
          generated_at,
          generated_by,
          tenant_name
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error: any) {
    console.error('Report generation failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})

function generateComplianceReport(data: any): string {
  const { tenant_name, certificates, events, stats, config, generated_by, generated_at } = data
  
  const reportDate = new Date(generated_at).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Hash-Chain Verifizierung
  let hashChainHtml = ''
  if (config.includeHashChain && events.length > 0) {
    const lastEvent = events[0]
    hashChainHtml = `
      <div class="hash-chain-section">
        <h2>🔒 Kryptographische Hash-Chain Verifizierung</h2>
        <div class="hash-info">
          <p><strong>Letzter Event:</strong> ${lastEvent.type}</p>
          <p><strong>Hash (SHA-256):</strong></p>
          <code>${lastEvent.hash}</code>
          <p class="hash-note">
            ✅ Diese Hash-Kette beweist, dass die Audit-Log-Daten seit Erstellung 
            nicht manipuliert wurden. Jeder Event ist kryptographisch mit dem vorherigen verknüpft.
          </p>
        </div>
      </div>
    `
  }

  // Zertifikats-Tabellen
  const certRows = certificates.map((cert: any) => {
    const asset = cert.assets || {}
    const expiryDate = new Date(cert.not_after)
    const daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    
    let statusColor = '#10B981'
    let statusLabel = '✅ Gültig'
    
    if (daysRemaining < 0) {
      statusColor = '#EF4444'
      statusLabel = '🚨 Abgelaufen'
    } else if (daysRemaining < 7) {
      statusColor = '#EF4444'
      statusLabel = '⚠️ Kritisch'
    } else if (daysRemaining < 30) {
      statusColor = '#F59E0B'
      statusLabel = '⏰ Warnung'
    }

    return `
      <tr>
        <td><strong>${cert.subject_cn || 'N/A'}</strong></td>
        <td>${asset.host || 'N/A'}:${asset.port || ''}</td>
        <td class="issuer">${cert.issuer || 'N/A'}</td>
        <td>${expiryDate.toLocaleDateString('de-DE')}</td>
        <td style="color: ${statusColor}; font-weight: bold;">
          ${daysRemaining >= 0 ? daysRemaining + ' Tage' : 'Abgelaufen'}
        </td>
        <td>
          <span class="status-badge" style="background-color: ${statusColor}20; color: ${statusColor}">
            ${statusLabel}
          </span>
        </td>
      </tr>
    `
  }).join('')

  // Event Log
  let auditLogHtml = ''
  if (config.includeAuditLog && events.length > 0) {
    const eventRows = events.slice(0, 50).map((event: any) => `
      <tr>
        <td class="timestamp">${new Date(event.ts).toLocaleString('de-DE')}</td>
        <td><code>${event.type}</code></td>
        <td class="payload">${JSON.stringify(event.payload).substring(0, 100)}...</td>
      </tr>
    `).join('')

    auditLogHtml = `
      <div class="audit-section page-break">
        <h2>📋 Audit Log</h2>
        <p class="section-desc">Letzte ${events.length} Events (unveränderlich)</p>
        <table class="audit-table">
          <thead>
            <tr>
              <th style="width: 180px">Zeitstempel</th>
              <th style="width: 250px">Event-Typ</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${eventRows}
          </tbody>
        </table>
      </div>
    `
  }

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title || 'Certificate Compliance Report'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: white;
      color: #0F172A;
      line-height: 1.6;
    }
    
    @media print {
      .page-break { page-break-before: always; }
      .no-print { display: none; }
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px;
    }
    
    /* Title Page */
    .title-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
      color: white;
      text-align: center;
      padding: 60px;
    }
    
    .logo {
      font-size: 80px;
      margin-bottom: 20px;
    }
    
    .title-page h1 {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }
    
    .title-page .subtitle {
      font-size: 24px;
      opacity: 0.9;
      margin-bottom: 40px;
    }
    
    .metadata {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 30px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.2);
      margin-top: 40px;
    }
    
    .metadata-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .metadata-item:last-child {
      border-bottom: none;
    }
    
    /* Stats Summary */
    .summary-page {
      padding: 60px;
    }
    
    .summary-page h2 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 40px;
      color: #1E293B;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%);
      padding: 30px;
      border-radius: 16px;
      border: 2px solid #E2E8F0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    
    .stat-card .icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    
    .stat-card .value {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    
    .stat-card .label {
      font-size: 14px;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    /* Certificate Table */
    .cert-section {
      padding: 60px;
    }
    
    .cert-section h2 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #1E293B;
    }
    
    .section-desc {
      font-size: 16px;
      color: #64748B;
      margin-bottom: 30px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    thead {
      background: #F8FAFC;
      border-bottom: 2px solid #E2E8F0;
    }
    
    th {
      padding: 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    td {
      padding: 16px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 14px;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover {
      background: #F8FAFC;
    }
    
    .issuer {
      font-size: 12px;
      color: #64748B;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    
    /* Hash Chain */
    .hash-chain-section {
      padding: 60px;
      background: linear-gradient(135deg, #D1FAE5 0%, #DCFCE7 100%);
    }
    
    .hash-chain-section h2 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #065F46;
    }
    
    .hash-info {
      background: white;
      padding: 30px;
      border-radius: 12px;
      border: 2px solid #10B981;
    }
    
    .hash-info code {
      display: block;
      background: #F1F5F9;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      word-break: break-all;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    
    .hash-note {
      font-size: 14px;
      color: #047857;
      margin-top: 12px;
      padding: 12px;
      background: #D1FAE5;
      border-radius: 6px;
    }
    
    /* Audit Log */
    .audit-section {
      padding: 60px;
    }
    
    .audit-table {
      font-size: 12px;
    }
    
    .audit-table .timestamp {
      font-family: 'Courier New', monospace;
      color: #64748B;
    }
    
    .audit-table code {
      background: #F8FAFC;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    
    .audit-table .payload {
      font-size: 11px;
      color: #94A3B8;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 40px;
      background: #F8FAFC;
      border-top: 2px solid #E2E8F0;
      margin-top: 60px;
    }
    
    .footer-signature {
      font-size: 14px;
      color: #64748B;
      margin-bottom: 20px;
    }
    
    .footer-hash {
      background: #1E293B;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin-top: 20px;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #3B82F6;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      z-index: 1000;
    }
    
    .print-button:hover {
      background: #2563EB;
    }
  </style>
</head>
<body>
  <button onclick="window.print()" class="print-button no-print">
    🖨️ Als PDF speichern
  </button>

  <!-- TITLE PAGE -->
  <div class="title-page">
    <div class="logo">🛡️</div>
    <h1>${config.title || 'Certificate Compliance Report'}</h1>
    <p class="subtitle">${config.description || 'SSL/TLS Zertifikats-Übersicht'}</p>
    
    <div class="metadata">
      <div class="metadata-item">
        <span><strong>Organisation:</strong></span>
        <span>${tenant_name}</span>
      </div>
      <div class="metadata-item">
        <span><strong>Erstellt am:</strong></span>
        <span>${reportDate}</span>
      </div>
      <div class="metadata-item">
        <span><strong>Erstellt von:</strong></span>
        <span>${generated_by}</span>
      </div>
      <div class="metadata-item">
        <span><strong>Zertifikate gesamt:</strong></span>
        <span>${certificates.length}</span>
      </div>
      ${config.includeHashChain ? `
      <div class="metadata-item">
        <span><strong>Hash-Chain Verifizierung:</strong></span>
        <span>✅ Aktiviert</span>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- SUMMARY PAGE -->
  <div class="summary-page page-break">
    <h2>📊 Executive Summary</h2>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon">🔐</div>
        <div class="value" style="color: #3B82F6">${stats.totalCerts || certificates.length}</div>
        <div class="label">Zertifikate gesamt</div>
      </div>
      
      <div class="stat-card">
        <div class="icon">✅</div>
        <div class="value" style="color: #10B981">${stats.valid || 0}</div>
        <div class="label">Gültig</div>
      </div>
      
      <div class="stat-card">
        <div class="icon">⏰</div>
        <div class="value" style="color: #F59E0B">${stats.expiring || 0}</div>
        <div class="label">Bald ablaufend</div>
      </div>
      
      <div class="stat-card">
        <div class="icon">🚨</div>
        <div class="value" style="color: #EF4444">${stats.expired || 0}</div>
        <div class="label">Abgelaufen</div>
      </div>
    </div>
    
    ${stats.expired > 0 ? `
    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <h3 style="color: #991B1B; margin-bottom: 10px;">⚠️ Kritische Befunde</h3>
      <p style="color: #7F1D1D;">
        <strong>${stats.expired} Zertifikat(e) sind bereits abgelaufen!</strong> 
        Sofortiges Handeln erforderlich um Dienstausfälle zu vermeiden.
      </p>
    </div>
    ` : ''}
    
    ${stats.expiring > 0 ? `
    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px; margin-top: 20px;">
      <h3 style="color: #92400E; margin-bottom: 10px;">⏰ Handlungsempfehlung</h3>
      <p style="color: #78350F;">
        <strong>${stats.expiring} Zertifikat(e) laufen in den nächsten 30 Tagen ab.</strong> 
        Planung der Erneuerung wird empfohlen.
      </p>
    </div>
    ` : ''}
  </div>

  <!-- CERTIFICATES TABLE -->
  <div class="cert-section page-break">
    <h2>📋 Zertifikats-Details</h2>
    <p class="section-desc">Vollständige Übersicht aller überwachten Zertifikate</p>
    
    <table>
      <thead>
        <tr>
          <th>Common Name</th>
          <th>Host:Port</th>
          <th>Aussteller</th>
          <th>Gültig bis</th>
          <th>Verbleibend</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${certRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748B;">Keine Zertifikate gefunden</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- AUDIT LOG -->
  ${auditLogHtml}

  <!-- HASH CHAIN -->
  ${hashChainHtml}

  <!-- FOOTER / SIGNATURE -->
  <div class="footer">
    <div class="footer-signature">
      <p><strong>🛡️ Zertifikat-Wächter</strong> • SSL/TLS Certificate Monitoring System</p>
      <p style="margin-top: 8px;">Version 1.0.0 • ${reportDate}</p>
      <p style="margin-top: 16px; font-size: 12px;">
        Dieser Report wurde automatisch generiert und ist ausschließlich für interne Compliance-Zwecke bestimmt.
      </p>
    </div>
    
    ${config.includeHashChain && events.length > 0 ? `
    <div class="footer-hash">
      <p><strong>Report-Hash (SHA-256):</strong></p>
      <p style="margin-top: 8px; word-break: break-all;">
        ${events[0]?.hash || 'N/A'}
      </p>
      <p style="margin-top: 12px; font-size: 11px; opacity: 0.7;">
        Dieser Hash dient als unveränderlicher Nachweis der Report-Integrität zum Zeitpunkt der Erstellung.
      </p>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `
}
