# MCP-Server Integration für Zertifikat-Wächter

## 🎯 Was ist der MCP-Server?

Der **Model Context Protocol (MCP) Server** erweitert den Zertifikat-Wächter um eine AI-freundliche API-Schicht, die es Large Language Models und anderen intelligenten Clients ermöglicht, direkt mit dem System zu interagieren.

## 🚀 Quick Start

### 1. Lokale Entwicklung

```bash
# Redis starten (erforderlich für Context State)
docker run -d -p 6379:6379 redis:7-alpine

# In mcp-server Verzeichnis
cd mcp-server

# Dependencies installieren
npm install

# Environment konfigurieren
cp .env.example .env
# .env mit deinen Supabase-Credentials ausfüllen

# Server starten
npm run dev
```

Server läuft auf: `http://localhost:8787`

### 2. Docker Compose (Empfohlen)

```bash
# Aus Root-Verzeichnis
docker-compose up -d redis mcp-server

# Logs verfolgen
docker-compose logs -f mcp-server
```

### 3. Vollständiges System

```bash
# Alle Services starten (Agent, Worker, MCP-Server)
docker-compose up -d

# Health Check
curl http://localhost:8787/health
```

## 📋 Verfügbare Tools

### cert.scan

TLS-Zertifikat scannen und analysieren.

```bash
curl -X POST http://localhost:8787/mcp/tools/cert.scan \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com",
    "port": 443,
    "timeoutMs": 5000
  }'
```

### cert.chain

Vollständige Zertifikatskette abrufen.

```bash
curl -X POST http://localhost:8787/mcp/tools/cert.chain \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com"
  }'
```

### cert.expiry

Ablaufdatum prüfen mit Warnungen.

```bash
curl -X POST http://localhost:8787/mcp/tools/cert.expiry \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com",
    "warnDays": 30
  }'
```

### security.anomalyScan

Sicherheitsanalyse durchführen.

```bash
curl -X POST http://localhost:8787/mcp/tools/security.anomalyScan \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com"
  }'
```

### domains.register

Domain für Überwachung registrieren.

```bash
curl -X POST http://localhost:8787/mcp/tools/domains.register \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example.com",
    "port": 443,
    "tags": ["production", "critical"]
  }'
```

### domains.list

Alle registrierten Domains auflisten.

```bash
curl -X POST http://localhost:8787/mcp/tools/domains.list \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": "all",
    "limit": 100
  }'
```

### compliance.report

Compliance-Report generieren.

```bash
curl -X POST http://localhost:8787/mcp/tools/compliance.report \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json"
  }'
```

## 🔔 Echtzeit-Alerts (SSE)

```bash
# Alert-Stream abonnieren
curl -N http://localhost:8787/mcp/alerts/stream \
  -H "X-API-Key: your-api-key"

# Output:
# event: connected
# data: {"clientId":"tenant-123-1729512000000","timestamp":"2025-10-21T12:00:00Z"}
#
# event: keepalive
# data: {"timestamp":"2025-10-21T12:00:15Z"}
#
# event: alert
# data: {"id":"alert-123","type":"CERT_EXPIRES_SOON","severity":"high","host":"example.com"...}
```

### JavaScript/TypeScript Client

```typescript
const eventSource = new EventSource(
  'http://localhost:8787/mcp/alerts/stream',
  {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  }
);

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('alert', (e) => {
  const alert = JSON.parse(e.data);
  console.log('Alert received:', alert);
  
  if (alert.severity === 'critical') {
    // Handle critical alert
  }
});

eventSource.onerror = (err) => {
  console.error('SSE error:', err);
};
```

### Python Client

```python
import requests
import json

headers = {'X-API-Key': 'your-api-key'}
url = 'http://localhost:8787/mcp/alerts/stream'

response = requests.get(url, headers=headers, stream=True)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = json.loads(line[6:])
            print(f"Alert: {data}")
```

## 🔐 Authentifizierung

### API-Key erstellen

1. Über Supabase-Dashboard oder SQL:

```sql
INSERT INTO api_keys (user_id, tenant_id, key_hash, is_active, name)
VALUES (
  'user-uuid',
  'tenant-uuid',
  encode(hmac('my-secret-api-key', 'your-hash-secret', 'sha256'), 'hex'),
  true,
  'MCP Client Key'
);
```

2. API-Key verwenden:

```bash
curl -H "X-API-Key: my-secret-api-key" \
     http://localhost:8787/mcp/tools/cert.scan
```

### JWT Token verwenden

```bash
# Token vom Hauptsystem erhalten
TOKEN=$(curl -X POST http://your-api/auth/login \
  -d '{"email":"user@example.com","password":"pass"}' \
  | jq -r .access_token)

# Mit Token authentifizieren
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8787/mcp/tools/cert.scan
```

## 🧠 Context-Awareness

Der MCP-Server merkt sich Scan-Ergebnisse pro Session:

```bash
# Session-ID setzen
SESSION_ID="my-session-$(date +%s)"

# Scan durchführen (wird in Session gespeichert)
curl -X POST http://localhost:8787/mcp/tools/cert.scan \
  -H "X-API-Key: your-api-key" \
  -H "X-Session-ID: $SESSION_ID" \
  -d '{"host":"example.com"}'

# Expiry-Check nutzt gecachtes Ergebnis (schneller!)
curl -X POST http://localhost:8787/mcp/tools/cert.expiry \
  -H "X-API-Key: your-api-key" \
  -H "X-Session-ID: $SESSION_ID" \
  -d '{"host":"example.com"}'
```

Vorteile:
- ✅ Schneller (keine redundanten Scans)
- ✅ Konsistent (gleiche Daten)
- ✅ Ressourcenschonend

## 🐳 Docker Compose Integration

### Environment-Variablen

Füge zu deiner Root `.env` hinzu:

```env
# MCP Server
JWT_SECRET=secure-random-string-min-32-chars
API_KEY_HASH_SECRET=another-secure-random-string
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:5173,https://your-domain.com
```

### Services starten

```bash
# Nur MCP-Server
docker-compose up -d mcp-server

# Mit Agent
docker-compose up -d agent mcp-server

# Alle Services
docker-compose up -d
```

### Logs

```bash
# MCP-Server Logs
docker-compose logs -f mcp-server

# Alle Logs
docker-compose logs -f
```

### Health Checks

```bash
# Health Status
curl http://localhost:8787/health

# Manifest
curl http://localhost:8787/mcp/manifest

# Alert-Clients (Debugging)
curl -H "X-API-Key: your-key" \
     http://localhost:8787/mcp/alerts/clients
```

## 🔧 Troubleshooting

### Redis-Verbindung fehlschlägt

**Problem:**
```
Error: Redis Client Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Lösung:**
```bash
# Redis starten
docker-compose up -d redis

# Oder lokal
docker run -d -p 6379:6379 redis:7-alpine
```

### Authentifizierung fehlgeschlagen

**Problem:**
```json
{"error":"unauthorized","message":"API-Key oder Bearer Token erforderlich"}
```

**Lösungen:**
1. API-Key Header vergessen: `-H "X-API-Key: your-key"`
2. Falscher API-Key Hash in DB
3. JWT_SECRET in .env falsch

### Rate Limit überschritten

**Problem:**
```json
{"error":"rate_limit_exceeded","message":"Zu viele Anfragen..."}
```

**Lösung:**
```env
# In .env erhöhen
RATE_LIMIT_MAX_REQUESTS=500
```

### CORS-Fehler im Browser

**Problem:**
```
Access to fetch at 'http://localhost:8787/mcp/tools/cert.scan' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Lösung:**
```env
# Origin hinzufügen
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

### Port bereits belegt

**Problem:**
```
Error: listen EADDRINUSE: address already in use :::8787
```

**Lösung:**
```env
# Anderen Port verwenden
PORT=8788
```

```bash
# Im docker-compose.yml anpassen
ports:
  - "8788:8787"
```

## 🎨 Integration-Beispiele

### Mit Claude/ChatGPT

```
Ich verwende einen MCP-Server unter http://localhost:8787.

Tools:
- cert.scan: Scannt TLS-Zertifikate
- cert.expiry: Prüft Ablaufdatum
- security.anomalyScan: Sicherheitsanalyse

Bitte scanne example.com und prüfe ob das Zertifikat bald abläuft.
```

### Mit Custom Client (Node.js)

```typescript
import axios from 'axios';

const mcpClient = axios.create({
  baseURL: 'http://localhost:8787/mcp',
  headers: {
    'X-API-Key': process.env.MCP_API_KEY,
    'Content-Type': 'application/json',
  },
});

async function scanDomain(host: string) {
  const { data } = await mcpClient.post('/tools/cert.scan', { host });
  return data.data;
}

async function checkExpiry(host: string, warnDays = 30) {
  const { data } = await mcpClient.post('/tools/cert.expiry', { 
    host, 
    warnDays 
  });
  return data.data;
}

// Verwendung
const scan = await scanDomain('example.com');
const expiry = await checkExpiry('example.com');

console.log(`Zertifikat läuft ab in: ${expiry.daysLeft} Tagen`);
```

### Mit Python

```python
import requests

class MCPClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def scan_cert(self, host, port=443):
        response = requests.post(
            f'{self.base_url}/tools/cert.scan',
            headers=self.headers,
            json={'host': host, 'port': port}
        )
        return response.json()['data']
    
    def check_expiry(self, host, warn_days=30):
        response = requests.post(
            f'{self.base_url}/tools/cert.expiry',
            headers=self.headers,
            json={'host': host, 'warnDays': warn_days}
        )
        return response.json()['data']

# Verwendung
client = MCPClient('http://localhost:8787/mcp', 'your-api-key')
scan = client.scan_cert('example.com')
expiry = client.check_expiry('example.com')

print(f"Zertifikat läuft ab in: {expiry['daysLeft']} Tagen")
```

## 📊 Monitoring

### Prometheus Metriken (geplant)

```bash
curl http://localhost:8787/metrics
```

### Custom Logging

Logs werden nach stdout geschrieben:

```bash
# Docker Logs
docker-compose logs -f mcp-server

# Mit Filtering
docker-compose logs mcp-server | grep ERROR
```

## 🔄 Updates

### Code Updates

```bash
# Container neu bauen
docker-compose build mcp-server

# Neu starten
docker-compose up -d mcp-server
```

### Dependencies Updates

```bash
cd mcp-server
npm update
npm audit fix
```

## 📚 Weitere Ressourcen

- [MCP-Server README](./mcp-server/README.md) - Vollständige API-Dokumentation
- [Manifest](./mcp-server/manifest.json) - Tool-Definitionen
- [Haupt-README](./README.md) - Gesamtsystem-Dokumentation

## 🤝 Support

Bei Problemen oder Fragen:
1. Health-Endpoint prüfen: `curl http://localhost:8787/health`
2. Logs checken: `docker-compose logs mcp-server`
3. Redis-Verbindung testen: `docker-compose exec redis redis-cli ping`
4. Issue im Repository erstellen

---

**Viel Erfolg mit dem MCP-Server! 🚀**

