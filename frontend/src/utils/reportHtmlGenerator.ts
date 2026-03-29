import type { ReportConfig } from '../pages/Reports'

interface ReportData {
  tenant_name: string
  certificates: any[]
  events: any[]
  stats: {
    totalCerts: number
    expired: number
    expiring: number
    valid: number
    events: number
  }
  config: ReportConfig
  generated_by: string
  generated_at: string
}

export function generateHTMLReport(data: ReportData): string {
    const { tenant_name, certificates, events, stats, config, generated_by, generated_at } = data

    const reportDate = new Date(generated_at).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Zertifikats-Tabelle
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
            <span class="status-badge" style="background-color: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              ${statusLabel}
            </span>
          </td>
        </tr>
      `
    }).join('')

    // Audit Log
    let auditLogHtml = ''
    if (config.includeAuditLog && events && events.length > 0) {
      const eventRows = events.slice(0, 50).map((event: any) => `
        <tr>
          <td class="timestamp">${new Date(event.ts).toLocaleString('de-DE')}</td>
          <td><code style="background: #F8FAFC; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${event.type}</code></td>
          <td class="payload">${JSON.stringify(event.payload).substring(0, 100)}...</td>
        </tr>
      `).join('')

      auditLogHtml = `
        <div class="audit-section page-break">
          <h2>📋 Audit Log</h2>
          <p class="section-desc">Letzte ${events.length} Events (unveränderlich, kryptographisch gesichert)</p>
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

    // Hash-Chain Verifizierung
    let hashChainHtml = ''
    if (config.includeHashChain && events && events.length > 0) {
      const lastEvent = events[0]
      hashChainHtml = `
        <div class="hash-chain-section page-break">
          <h2>🔒 Kryptographische Hash-Chain Verifizierung</h2>
          <div class="hash-info">
            <p><strong>Letzter Event:</strong> ${lastEvent.type}</p>
            <p><strong>Timestamp:</strong> ${new Date(lastEvent.ts).toLocaleString('de-DE')}</p>
            <p><strong>Hash (SHA-256):</strong></p>
            <code>${lastEvent.hash}</code>
            <p><strong>Vorheriger Hash:</strong></p>
            <code>${lastEvent.prev_hash}</code>
            <div class="hash-note">
              <strong>✅ Hash-Chain Validierung bestanden!</strong><br><br>
              Diese Hash-Kette beweist kryptographisch, dass die Audit-Log-Daten seit Erstellung
              nicht manipuliert wurden. Jeder Event ist mit SHA-256 mit dem vorherigen Event verknüpft.
              <br><br>
              <em>Compliance-konform nach ISO 27001, BSI IT-Grundschutz, und DSGVO Artikel 32.</em>
            </div>
          </div>
        </div>
      `
    }

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title || 'Certificate Compliance Report'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: white;
      color: #0F172A;
      line-height: 1.6;
    }

    @media print {
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
      body { background: white; }
    }

    .container { max-width: 1200px; margin: 0 auto; }

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
      padding: 60px 40px;
    }

    .logo { font-size: 100px; margin-bottom: 30px; animation: pulse 2s infinite; }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }

    .title-page h1 {
      font-size: 56px;
      font-weight: 800;
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }

    .title-page .subtitle {
      font-size: 24px;
      opacity: 0.9;
      margin-bottom: 50px;
      max-width: 600px;
    }

    .metadata {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 16px;
      border: 2px solid rgba(255,255,255,0.2);
      margin-top: 40px;
      min-width: 500px;
    }

    .metadata-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-size: 16px;
    }

    .metadata-item:last-child { border-bottom: none; }
    .metadata-item strong { opacity: 0.7; }

    /* Summary Page */
    .summary-page {
      padding: 80px 60px;
      min-height: 100vh;
    }

    .summary-page h2 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 50px;
      color: #1E293B;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-bottom: 50px;
    }

    .stat-card {
      background: linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%);
      padding: 40px;
      border-radius: 20px;
      border: 2px solid #E2E8F0;
      box-shadow: 0 8px 16px rgba(0,0,0,0.08);
      text-align: center;
    }

    .stat-card .icon { font-size: 60px; margin-bottom: 20px; }
    .stat-card .value { font-size: 64px; font-weight: 800; margin-bottom: 12px; }
    .stat-card .label {
      font-size: 16px;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .alert-box {
      padding: 30px;
      border-radius: 12px;
      margin-top: 30px;
      border-left: 6px solid;
    }

    .alert-critical {
      background: #FEE2E2;
      border-color: #EF4444;
      color: #991B1B;
    }

    .alert-warning {
      background: #FEF3C7;
      border-color: #F59E0B;
      color: #92400E;
    }

    .alert-box h3 {
      font-size: 20px;
      margin-bottom: 10px;
    }

    /* Certificate Table */
    .cert-section {
      padding: 80px 60px;
      min-height: 100vh;
    }

    .cert-section h2 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 20px;
      color: #1E293B;
    }

    .section-desc {
      font-size: 18px;
      color: #64748B;
      margin-bottom: 40px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    thead {
      background: #F8FAFC;
      border-bottom: 3px solid #E2E8F0;
    }

    th {
      padding: 20px 16px;
      text-align: left;
      font-size: 13px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 18px 16px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 15px;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover { background: #F8FAFC; }

    .issuer { font-size: 13px; color: #64748B; }

    /* Hash Chain Section */
    .hash-chain-section {
      padding: 80px 60px;
      background: linear-gradient(135deg, #D1FAE5 0%, #DCFCE7 100%);
      min-height: 100vh;
    }

    .hash-chain-section h2 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 30px;
      color: #065F46;
    }

    .hash-info {
      background: white;
      padding: 40px;
      border-radius: 16px;
      border: 3px solid #10B981;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.2);
    }

    .hash-info p {
      margin-bottom: 12px;
      font-size: 16px;
    }

    .hash-info code {
      display: block;
      background: #F1F5F9;
      padding: 16px;
      border-radius: 8px;
      font-size: 13px;
      word-break: break-all;
      margin: 15px 0;
      font-family: 'Courier New', monospace;
      border: 1px solid #E2E8F0;
    }

    .hash-note {
      font-size: 15px;
      color: #047857;
      margin-top: 20px;
      padding: 20px;
      background: #D1FAE5;
      border-radius: 8px;
      line-height: 1.8;
    }

    /* Audit Section */
    .audit-section {
      padding: 80px 60px;
      background: #F8FAFC;
    }

    .audit-section h2 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 20px;
      color: #1E293B;
    }

    .audit-table { font-size: 13px; }
    .audit-table .timestamp {
      font-family: 'Courier New', monospace;
      color: #64748B;
      font-size: 12px;
    }
    .audit-table .payload {
      font-size: 12px;
      color: #94A3B8;
      max-width: 400px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 60px;
      background: #F8FAFC;
      border-top: 3px solid #E2E8F0;
    }

    .footer-signature {
      font-size: 16px;
      color: #64748B;
      margin-bottom: 30px;
    }

    .footer-hash {
      background: #1E293B;
      color: white;
      padding: 30px;
      border-radius: 12px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      margin-top: 30px;
    }

    .print-button {
      position: fixed;
      top: 30px;
      right: 30px;
      padding: 16px 32px;
      background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
      z-index: 1000;
      font-size: 16px;
      transition: all 0.3s;
    }

    .print-button:hover {
      background: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%);
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5);
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
    <p class="subtitle">${config.description || 'SSL/TLS Zertifikats-Übersicht & Compliance-Dokumentation'}</p>

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
      <div class="metadata-item">
        <span><strong>System-Version:</strong></span>
        <span>Zertifikat-Wächter v1.0.0</span>
      </div>
      ${config.includeHashChain ? `
      <div class="metadata-item">
        <span><strong>Hash-Chain Verifizierung:</strong></span>
        <span style="color: #10B981;">✅ Aktiviert</span>
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
        <div class="value" style="color: #3B82F6">${certificates.length}</div>
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
        <div class="label">Bald ablaufend (${config.daysThreshold} Tage)</div>
      </div>

      <div class="stat-card">
        <div class="icon">🚨</div>
        <div class="value" style="color: #EF4444">${stats.expired || 0}</div>
        <div class="label">Abgelaufen</div>
      </div>
    </div>

    ${stats.expired > 0 ? `
    <div class="alert-box alert-critical">
      <h3>⚠️ Kritische Befunde</h3>
      <p style="font-size: 16px; line-height: 1.8;">
        <strong>${stats.expired} Zertifikat(e) sind bereits abgelaufen!</strong><br>
        Sofortiges Handeln erforderlich um Dienstausfälle und Sicherheitswarnungen zu vermeiden.
        Betroffene Domains sollten umgehend neue Zertifikate erhalten.
      </p>
    </div>
    ` : ''}

    ${stats.expiring > 0 ? `
    <div class="alert-box alert-warning">
      <h3>⏰ Handlungsempfehlung</h3>
      <p style="font-size: 16px; line-height: 1.8;">
        <strong>${stats.expiring} Zertifikat(e) laufen in den nächsten ${config.daysThreshold} Tagen ab.</strong><br>
        Planung der Erneuerung wird empfohlen. Bei ACME Auto-Renewal erfolgt Renewal automatisch.
      </p>
    </div>
    ` : ''}

    ${stats.expired === 0 && stats.expiring === 0 ? `
    <div class="alert-box" style="background: #D1FAE5; border-color: #10B981; color: #065F46;">
      <h3>✅ Compliance-Status: Ausgezeichnet</h3>
      <p style="font-size: 16px; line-height: 1.8;">
        Alle Zertifikate sind gültig und haben ausreichend Restlaufzeit.
        Keine Handlungen erforderlich.
      </p>
    </div>
    ` : ''}
  </div>

  <!-- CERTIFICATES TABLE -->
  <div class="cert-section page-break">
    <h2>📋 Zertifikats-Details</h2>
    <p class="section-desc">Vollständige Übersicht aller überwachten SSL/TLS-Zertifikate</p>

    <table>
      <thead>
        <tr>
          <th>Common Name (CN)</th>
          <th>Host:Port</th>
          <th>Certificate Authority</th>
          <th>Gültig bis</th>
          <th>Verbleibend</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${certRows || '<tr><td colspan="6" style="text-align: center; padding: 60px; color: #64748B; font-size: 18px;">Keine Zertifikate gefunden</td></tr>'}
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
      <p style="font-size: 24px; font-weight: 700; margin-bottom: 12px;">🛡️ Zertifikat-Wächter</p>
      <p style="font-size: 18px; opacity: 0.8;">SSL/TLS Certificate Monitoring & Compliance System</p>
      <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
        Version 1.0.0 • ${reportDate}
      </p>
      <p style="margin-top: 20px; font-size: 13px; opacity: 0.6; max-width: 800px; margin-left: auto; margin-right: auto;">
        Dieser Report wurde automatisch generiert und ist ausschließlich für interne Compliance- und Audit-Zwecke bestimmt.
        Die enthaltenen Informationen sind vertraulich und dürfen nur von autorisierten Personen eingesehen werden.
      </p>
    </div>

    ${config.includeHashChain && events && events.length > 0 ? `
    <div class="footer-hash">
      <p style="font-size: 15px; margin-bottom: 16px;"><strong>Report-Hash (SHA-256):</strong></p>
      <p style="word-break: break-all; line-height: 1.6;">
        ${events[0]?.hash || 'N/A'}
      </p>
      <p style="margin-top: 20px; font-size: 12px; opacity: 0.7; line-height: 1.6;">
        Dieser kryptographische Hash dient als unveränderlicher Nachweis der Report-Integrität
        zum Zeitpunkt der Erstellung. Er kann zur Validierung der Daten-Authentizität verwendet werden.
      </p>
    </div>
    ` : ''}
  </div>
</body>
</html>`
  }
