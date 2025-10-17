# Zertifikat-Wächter Agent

Leichtgewichtiger Go-Agent für Intranet-Zertifikat-Scans.

## Features

- ✅ TLS/SSL Zertifikat-Scanning für interne Hosts
- ✅ Automatische Registration bei Supabase Backend
- ✅ Periodische Scans (konfigurierbar)
- ✅ Health-Check-Endpoints für Docker/Kubernetes
- ✅ Heartbeat für Status-Monitoring
- ✅ Strukturiertes JSON-Logging
- ✅ Graceful Shutdown

## Schnellstart mit Docker

### 1. Docker Run (Simplest)

```bash
docker run -d \
  --name certwatcher-agent \
  -e SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key-here \
  -e SCAN_TARGETS=internal.example.com,mail.example.com \
  -e SCAN_PORTS=443,8443,636 \
  -e SCAN_INTERVAL=3600 \
  -p 8080:8080 \
  certwatcher/agent:latest
```

### 2. Docker Compose (Empfohlen)

Erstelle `docker-compose.yml`:

```yaml
version: '3.8'

services:
  agent:
    image: certwatcher/agent:latest
    container_name: certwatcher-agent
    environment:
      SUPABASE_URL: https://ethwkzwsxkhcexibuvwp.supabase.co
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      CONNECTOR_NAME: my-office-agent
      SCAN_TARGETS: server1.internal,server2.internal,ldap.internal
      SCAN_PORTS: 443,8443,636,993,995
      SCAN_INTERVAL: 3600
      LOG_LEVEL: INFO
    ports:
      - "8080:8080"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Starten:

```bash
docker-compose up -d
```

### 3. Lokale Entwicklung

#### Voraussetzungen

- Go 1.22+
- Supabase Account

#### Installation

```bash
# Repo clonen
git clone <repo-url>
cd agent

# Dependencies installieren
go mod download

# .env erstellen
cp .env.example .env
# Jetzt .env mit deinen Credentials bearbeiten

# Agent starten
go run main.go
```

## Konfiguration

### Umgebungsvariablen

| Variable | Erforderlich | Default | Beschreibung |
|----------|--------------|---------|--------------|
| `SUPABASE_URL` | ✅ | - | Supabase Projekt URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | - | Service Role Key |
| `CONNECTOR_TOKEN` | ❌ | - | Token für Connector-Registration |
| `CONNECTOR_NAME` | ❌ | `agent-TIMESTAMP` | Name des Agents |
| `SCAN_TARGETS` | ❌ | `localhost` | Komma-separierte Host-Liste |
| `SCAN_PORTS` | ❌ | `443,8443,636` | Komma-separierte Port-Liste |
| `SCAN_INTERVAL` | ❌ | `3600` | Scan-Intervall in Sekunden |
| `SCAN_TIMEOUT` | ❌ | `5` | Timeout pro Scan in Sekunden |
| `HEALTH_CHECK_PORT` | ❌ | `8080` | Port für Health-Checks |
| `LOG_LEVEL` | ❌ | `INFO` | Log-Level (DEBUG, INFO, WARN, ERROR) |

### Scan-Targets

Der Agent unterstützt folgende Formate:

```bash
# Einzelne Hosts
SCAN_TARGETS=example.com

# Mehrere Hosts (komma-separiert)
SCAN_TARGETS=server1.internal,server2.internal,ldap.corp

# Mit verschiedenen Ports
SCAN_TARGETS=mail.example.com
SCAN_PORTS=443,993,995,587

# IP-Adressen
SCAN_TARGETS=192.168.1.10,10.0.0.5
```

## Health Checks

Der Agent stellt zwei Endpunkte bereit:

```bash
# Liveness Check
curl http://localhost:8080/healthz

# Readiness Check
curl http://localhost:8080/readyz
```

## Logs

Der Agent loggt im JSON-Format für einfache Verarbeitung:

```bash
# Logs anschauen (Docker)
docker logs -f certwatcher-agent

# Logs mit jq formatieren
docker logs certwatcher-agent | jq .

# Nur Errors
docker logs certwatcher-agent | jq 'select(.level == "error")'
```

## Monitoring

Der Agent sendet alle 30 Sekunden einen Heartbeat an Supabase, um seinen Status zu aktualisieren.

```bash
# Status prüfen (in Supabase)
SELECT id, name, status, last_seen 
FROM connectors 
WHERE type = 'agent';
```

## Deployment-Szenarien

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: certwatcher-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: certwatcher-agent
  template:
    metadata:
      labels:
        app: certwatcher-agent
    spec:
      containers:
      - name: agent
        image: certwatcher/agent:latest
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: certwatcher-secrets
              key: supabase-url
        - name: SUPABASE_SERVICE_ROLE_KEY
          valueFrom:
            secretKeyRef:
              name: certwatcher-secrets
              key: service-role-key
        - name: SCAN_TARGETS
          value: "server1.internal,server2.internal"
        - name: SCAN_PORTS
          value: "443,8443"
        ports:
        - containerPort: 8080
          name: health
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Systemd (Linux Server)

```ini
[Unit]
Description=Zertifikat-Wächter Agent
After=network.target

[Service]
Type=simple
User=certwatcher
WorkingDirectory=/opt/certwatcher-agent
EnvironmentFile=/opt/certwatcher-agent/.env
ExecStart=/opt/certwatcher-agent/agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Windows Service

```powershell
# Mit NSSM (Non-Sucking Service Manager)
nssm install CertwatcherAgent "C:\Program Files\CertwatcherAgent\agent.exe"
nssm set CertwatcherAgent AppDirectory "C:\Program Files\CertwatcherAgent"
nssm set CertwatcherAgent AppEnvironmentExtra SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=...
nssm start CertwatcherAgent
```

## Troubleshooting

### Agent startet nicht

```bash
# Logs prüfen
docker logs certwatcher-agent

# Häufige Fehler:
# - Fehlende SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY
# - Ungültiger Key
# - Netzwerk-Probleme
```

### Scans schlagen fehl

```bash
# Debug-Modus aktivieren
docker run -e LOG_LEVEL=DEBUG ...

# Häufige Ursachen:
# - Hosts nicht erreichbar (Firewall?)
# - Port nicht offen
# - TLS-Handshake fehlgeschlagen
# - Timeout zu kurz (erhöhe SCAN_TIMEOUT)
```

### Zertifikate erscheinen nicht im Dashboard

```bash
# Prüfe ob Agent registriert ist
docker logs certwatcher-agent | grep "Connector registered"

# Prüfe Supabase Connectivity
curl -H "apikey: YOUR_KEY" \
  -H "Authorization: Bearer YOUR_KEY" \
  https://YOUR_PROJECT.supabase.co/rest/v1/connectors

# Prüfe RLS Policies in Supabase
```

## Sicherheit

### ⚠️ Wichtige Hinweise

- **NIEMALS** `SUPABASE_SERVICE_ROLE_KEY` im Code committen!
- Service Role Key umgeht RLS - nur für Backend/Agent verwenden
- Agent sollte nur Zugriff auf notwendige Hosts haben
- Verwende separate Service Accounts für verschiedene Agents
- Regelmäßig Logs auf Anomalien prüfen

### Empfohlene Praxis

```bash
# Service Role Key als Secret speichern
echo "SUPABASE_SERVICE_ROLE_KEY=your-key" > .env
chmod 600 .env

# In Docker Secrets (Swarm/Kubernetes)
kubectl create secret generic certwatcher-secrets \
  --from-literal=service-role-key=YOUR_KEY
```

## Build from Source

```bash
# Lokal bauen
go build -o agent .

# Docker Image bauen
docker build -t certwatcher/agent:latest .

# Multi-Arch Build (ARM + AMD64)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t certwatcher/agent:latest \
  --push .
```

## Roadmap

- [ ] Unterstützung für Client-Zertifikate
- [ ] STARTTLS für SMTP/LDAP
- [ ] SNI für virtuelle Hosts
- [ ] Prometheus Metrics Export
- [ ] Automatische Discovery (Netzwerk-Scan)
- [ ] Credential Management für authentifizierte Scans

## Support

Bei Problemen:
1. Prüfe die Logs mit `LOG_LEVEL=DEBUG`
2. Schaue in [Troubleshooting](#troubleshooting)
3. Erstelle ein Issue im Repository

## Lizenz

Siehe [LICENSE](../LICENSE) Datei.
