# Agent Quick Test Guide

## Lokaler Test (ohne Docker)

### 1. Go Build & Run

```bash
cd agent

# Dependencies laden
go mod download

# .env erstellen
cp .env.example .env

# WICHTIG: .env bearbeiten und Credentials eintragen
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - SCAN_TARGETS=google.com,github.com

# Agent starten
go run main.go
```

### Erwartete Ausgabe:

```json
{"level":"info","msg":"Starting Zertifikat-Wächter Agent","time":"2025-10-17T..."}
{"level":"info","msg":"Configuration loaded","scan_interval":"1h0m0s","scan_ports":[443,8443,636],...}
{"level":"info","msg":"Health check server starting","port":"8080"}
{"level":"info","msg":"Starting certificate scan"}
{"level":"info","msg":"Certificate scanned and reported","host":"google.com","port":443,"subject_cn":"*.google.com",...}
{"level":"info","msg":"Certificate scan completed","success":3,"failed":0,"total":3}
```

### 2. Health Check testen

In einem anderen Terminal:

```bash
curl http://localhost:8080/healthz
# Erwartete Ausgabe: OK

curl http://localhost:8080/readyz
# Erwartete Ausgabe: READY
```

## Docker Test

### 1. Image bauen

```bash
cd agent
docker build -t certwatcher-agent:test .
```

### 2. Container starten

```bash
docker run -d \
  --name test-agent \
  -e SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key-here \
  -e SCAN_TARGETS=google.com,github.com \
  -e SCAN_PORTS=443 \
  -e SCAN_INTERVAL=60 \
  -e LOG_LEVEL=DEBUG \
  -p 8080:8080 \
  certwatcher-agent:test
```

### 3. Logs prüfen

```bash
# Logs anschauen
docker logs -f test-agent

# Sollte zeigen:
# - "Connector registered" (wenn CONNECTOR_TOKEN gesetzt)
# - "Certificate scanned and reported"
# - "Heartbeat updated" (alle 30 Sekunden)
```

### 4. Health Check

```bash
# Container ist healthy?
docker ps --filter name=test-agent

# Manueller Health Check
docker exec test-agent wget -q -O- http://localhost:8080/healthz
```

### 5. Cleanup

```bash
docker stop test-agent
docker rm test-agent
```

## Integration Test mit Supabase

### 1. Prüfe ob Connector angelegt wurde

```sql
-- In Supabase SQL Editor
SELECT id, name, status, last_seen 
FROM connectors 
WHERE type = 'agent'
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Prüfe ob Assets angelegt wurden

```sql
SELECT id, host, port, status, created_at
FROM assets
WHERE connector_id IN (
  SELECT id FROM connectors WHERE type = 'agent'
)
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Prüfe ob Zertifikate eingegangen sind

```sql
SELECT 
  id, 
  subject_cn, 
  not_after, 
  created_at,
  asset_id,
  tenant_id
FROM certificates
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Problem: Agent startet nicht

```bash
# Prüfe Logs
docker logs test-agent

# Häufige Fehler:
# - "SUPABASE_URL is required" → .env prüfen
# - "tls dial failed" → Host nicht erreichbar
# - "supabase error: 401" → Falscher API Key
```

### Problem: Keine Zertifikate in Supabase

```bash
# Prüfe ob Agent überhaupt scannt
docker logs test-agent | grep "Starting certificate scan"

# Prüfe ob Scan erfolgreich war
docker logs test-agent | grep "Certificate scanned and reported"

# Prüfe ob Supabase-Request erfolgreich
docker logs test-agent | grep "error"
```

### Problem: "supabase error: 400"

Wahrscheinlich fehlt `tenant_id` in den Daten. Prüfe:

1. Ist Connector registriert? (Logs: "Connector registered")
2. Hat Agent `tenant_id`? (Logs sollten `tenant_id` zeigen)
3. RLS Policies korrekt? (Check Supabase Dashboard → Authentication → Policies)

### Problem: Health Check schlägt fehl

```bash
# Prüfe ob Port exposed ist
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep test-agent

# Sollte zeigen: 0.0.0.0:8080->8080/tcp

# Test mit curl
curl -v http://localhost:8080/healthz
```

## Performance Test

### Viele Hosts scannen

```bash
# Teste mit vielen Hosts
docker run -d \
  --name perf-test \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e SCAN_TARGETS=google.com,github.com,stackoverflow.com,reddit.com,amazon.com \
  -e SCAN_PORTS=443,8443 \
  -e SCAN_INTERVAL=300 \
  -e LOG_LEVEL=INFO \
  certwatcher-agent:test

# Logs prüfen
docker logs -f perf-test

# Sollte zeigen:
# - "Certificate scan completed" mit "success": 10 (5 hosts * 2 ports)
# - Keine Timeouts oder Errors
```

### Ressourcen-Verbrauch prüfen

```bash
# CPU und Memory Usage
docker stats test-agent

# Sollte zeigen:
# - CPU: < 1%
# - Memory: < 20 MB
```

## Produktion Ready Checklist

- [ ] Agent scannt erfolgreich (siehe Logs)
- [ ] Zertifikate erscheinen in Supabase
- [ ] Health Check funktioniert (`curl http://localhost:8080/healthz`)
- [ ] Heartbeat wird gesendet (alle 30s in Logs)
- [ ] Connector Status = "active" in Supabase
- [ ] Keine Errors in Logs
- [ ] Ressourcen-Verbrauch OK (< 50 MB RAM)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ist sicher gespeichert (nicht in Git!)
- [ ] Restart Policy gesetzt (`--restart unless-stopped`)
- [ ] Logging konfiguriert (Log-Rotation)

Wenn alle Punkte erfüllt sind: **Agent ist produktionsbereit!** 🎉

