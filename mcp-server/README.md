# MCP-Server für Zertifikat-Wächter

Model Context Protocol (MCP) Server für TLS-Zertifikatsüberwachung, Sicherheitsanalyse und Compliance-Reporting.

## Features

- 🔍 **TLS-Scanning**: Zertifikate scannen und Chains validieren
- ⏰ **Expiry-Checks**: Ablaufdaten überwachen mit konfigurierbaren Warnschwellen
- 🛡️ **Anomaly Detection**: Heuristische Sicherheitsanalysen
- 📊 **Compliance Reports**: JSON/CSV-Exporte für Audits
- 🔔 **Echtzeit-Alerts**: SSE-Stream für Live-Benachrichtigungen
- 💾 **Context-Aware**: Redis-basierte Session-Verwaltung
- 🔐 **Multi-Tenant**: Vollständige Tenant-Isolation mit RBAC

## Architektur

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │────────▶│  MCP-Server  │────────▶│  Supabase   │
│  (AI/App)   │  HTTP/  │   (Express)  │  SQL    │ (PostgreSQL)│
└─────────────┘  SSE    └──────────────┘         └─────────────┘
                              │
                              │ Cache/State
                              ▼
                        ┌──────────────┐
                        │    Redis     │
                        └──────────────┘
```

## Installation

### Voraussetzungen

- Node.js >= 20.0.0
- Redis >= 7.0
- Zugriff auf Supabase-Instanz

### Setup

```bash
# Dependencies installieren
cd mcp-server
npm install

# Environment konfigurieren
cp .env.example .env
# .env anpassen mit deinen Credentials

# Development Server starten
npm run dev

# Production Build
npm run build
npm start
```

### Docker

```bash
# Image bauen
docker build -t cert-watcher-mcp .

# Container starten
docker run -d \
  --name mcp-server \
  -p 8787:8787 \
  --env-file .env \
  cert-watcher-mcp
```

## API-Übersicht

### Manifest

```bash
GET /mcp/manifest
```

Liefert vollständiges Tool-Manifest mit Schemas.

### Health Check

```bash
GET /health
```

Server-Status und Metriken.

### Tools

Alle Tool-Endpunkte erfordern Authentifizierung (`X-API-Key` oder `Authorization: Bearer <token>`).

#### cert.scan

TLS-Handshake durchführen und Zertifikat scannen.

```bash
POST /mcp/tools/cert.scan
Content-Type: application/json

{
  "host": "example.com",
  "port": 443,
  "timeoutMs": 5000
}
```

**Response:**
```json
{
  "tool": "cert.scan",
  "success": true,
  "data": {
    "host": "example.com",
    "port": 443,
    "success": true,
    "timestamp": "2025-10-21T12:00:00Z",
    "certificate": {
      "subject": { "CN": "example.com" },
      "issuer": { "CN": "Let's Encrypt Authority X3" },
      "validFrom": "2025-01-01T00:00:00Z",
      "validTo": "2025-04-01T00:00:00Z",
      "fingerprint256": "sha256:abcd...",
      "serialNumber": "03:14:15:92...",
      "subjectAltNames": ["example.com", "www.example.com"]
    },
    "tlsVersion": "TLSv1.3",
    "cipherSuite": "TLS_AES_256_GCM_SHA384"
  }
}
```

#### cert.chain

Vollständige Zertifikatskette abrufen.

```bash
POST /mcp/tools/cert.chain
Content-Type: application/json

{
  "host": "example.com",
  "port": 443
}
```

#### cert.expiry

Ablaufdatum prüfen mit Vorwarnzeit.

```bash
POST /mcp/tools/cert.expiry
Content-Type: application/json

{
  "host": "example.com",
  "warnDays": 30
}
```

**Response:**
```json
{
  "tool": "cert.expiry",
  "success": true,
  "data": {
    "host": "example.com",
    "expiresAt": "2025-04-01T00:00:00Z",
    "daysLeft": 162,
    "severity": "ok",
    "status": "valid",
    "certificate": {
      "subject": "example.com",
      "issuer": "Let's Encrypt Authority X3",
      "fingerprint": "sha256:abcd..."
    }
  }
}
```

#### security.anomalyScan

Heuristische Sicherheitsanalyse.

```bash
POST /mcp/tools/security.anomalyScan
Content-Type: application/json

{
  "host": "example.com"
}
```

**Response:**
```json
{
  "tool": "security.anomalyScan",
  "success": true,
  "data": {
    "host": "example.com",
    "anomalies": [
      {
        "type": "certificate_expiring",
        "severity": "medium",
        "description": "Zertifikat läuft in 25 Tagen ab",
        "recommendation": "Zertifikat zeitnah erneuern"
      }
    ],
    "score": 85,
    "status": "safe"
  }
}
```

#### domains.register

Domain für kontinuierliche Überwachung registrieren.

```bash
POST /mcp/tools/domains.register
Content-Type: application/json

{
  "name": "example.com",
  "port": 443,
  "tags": ["production", "critical"]
}
```

#### domains.list

Registrierte Domains auflisten.

```bash
POST /mcp/tools/domains.list
Content-Type: application/json

{
  "filter": "all",
  "limit": 100
}
```

Filter: `all`, `expiring`, `expired`, `valid`

#### compliance.report

Compliance-Report generieren.

```bash
POST /mcp/tools/compliance.report
Content-Type: application/json

{
  "format": "json"
}
```

Format: `json` oder `csv`

### Alerts

#### SSE Stream

Echtzeit-Alert-Stream abonnieren.

```bash
GET /mcp/alerts/stream
X-API-Key: your-api-key
X-Session-ID: optional-session-id
```

Empfängt Server-Sent Events:
- `connected`: Verbindung hergestellt
- `keepalive`: Keepalive alle 15s
- `alert`: Neuer Alert

**Event-Format:**
```
event: alert
data: {"id":"alert-123","type":"CERT_EXPIRES_SOON","severity":"high","host":"example.com","message":"Zertifikat läuft in 7 Tagen ab","timestamp":"2025-10-21T12:00:00Z"}
```

#### Letzte Alerts

```bash
GET /mcp/alerts/recent?limit=50
```

#### Alert triggern (Testing)

```bash
POST /mcp/alerts/trigger
Content-Type: application/json

{
  "type": "CERT_EXPIRES_SOON",
  "severity": "high",
  "host": "test.example.com",
  "message": "Test-Alert"
}
```

## Authentifizierung

### API-Key

```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:8787/mcp/tools/cert.scan
```

### JWT Bearer Token

```bash
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:8787/mcp/tools/cert.scan
```

### Session-ID (für Context)

```bash
curl -H "X-Session-ID: my-session-123" \
     -H "X-API-Key: your-api-key" \
     http://localhost:8787/mcp/tools/cert.expiry
```

Session-IDs ermöglichen Context-Sharing zwischen mehreren Tool-Aufrufen (z.B. Scan-Ergebnisse wiederverwenden).

## Context-Awareness

Der MCP-Server ist context-aware und speichert Scan-Ergebnisse pro Session in Redis:

1. **cert.scan** scannt und speichert Ergebnis im Context
2. **cert.expiry** kann das Ergebnis wiederverwenden (spart Zeit)

```bash
# Erster Request: Scan durchführen
curl -X POST http://localhost:8787/mcp/tools/cert.scan \
  -H "X-API-Key: xxx" \
  -H "X-Session-ID: session-1" \
  -d '{"host":"example.com"}'

# Zweiter Request: Nutzt gecachtes Ergebnis
curl -X POST http://localhost:8787/mcp/tools/cert.expiry \
  -H "X-API-Key: xxx" \
  -H "X-Session-ID: session-1" \
  -d '{"host":"example.com"}'
```

## Sicherheit

### Rate Limiting

- 100 Requests pro 15 Minuten (konfigurierbar)
- Gilt für alle `/mcp/*` Endpunkte

### CORS

Konfigurierbare Origins in `.env`:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### JWT-Validierung

Unterstützt HS256 und RS256:
```
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
```

### API-Keys

API-Keys werden gehasht gespeichert (HMAC-SHA256).

## Monitoring

### Health Endpoint

```bash
curl http://localhost:8787/health
```

```json
{
  "status": "ok",
  "timestamp": "2025-10-21T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600.5
}
```

### Docker Health Check

Automatische Healthchecks alle 30 Sekunden.

### Logging

Alle Requests werden geloggt:
```
POST /mcp/tools/cert.scan - 200 (234ms)
```

## Development

### Tests schreiben

```bash
npm test
```

### TypeScript kompilieren

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Troubleshooting

### Redis-Verbindung fehlgeschlagen

```
Error: Redis Client Error: connect ECONNREFUSED
```

**Lösung:** Redis-Server starten oder `REDIS_URL` anpassen.

### Authentifizierung fehlgeschlagen

```json
{
  "error": "unauthorized",
  "message": "API-Key oder Bearer Token erforderlich"
}
```

**Lösung:** `X-API-Key` oder `Authorization` Header setzen.

### Rate Limit überschritten

```json
{
  "error": "rate_limit_exceeded",
  "message": "Zu viele Anfragen..."
}
```

**Lösung:** 15 Minuten warten oder `RATE_LIMIT_MAX_REQUESTS` erhöhen.

## Limitierungen

- **Timeouts**: TLS-Scans haben Default-Timeout von 5 Sekunden
- **Chain-Parsing**: Selbst-signierte Zertifikate werden erkannt, aber nicht vollständig validiert
- **Anomaly-Detection**: Heuristisch, nicht 100% Accuracy
- **SSE-Clients**: Unbegrenzt, aber Server-Ressourcen beachten

## Roadmap

- [ ] WebSocket-Unterstützung parallel zu SSE
- [ ] Batch-Operations für mehrere Hosts
- [ ] Advanced Certificate Validation (OCSP, CRL)
- [ ] Prometheus-Metriken Export
- [ ] GraphQL API parallel zu REST

## License

Siehe [LICENSE](../LICENSE)

## Support

Probleme oder Fragen? Issue erstellen im Haupt-Repository.

