# Agent Changelog

## Version 1.2 - Hacker-Intelligence (2025-10-20) 🧠🔒

### 🚀 BRAND NEW: Regelbasierte Hacker-Intelligenz!
Der Agent denkt jetzt wie ein Penetration-Tester und optimiert den Scan automatisch!

#### 🧠 Two-Stage Intelligent Scanning
- **Phase 1: Quick Scan** - Alle IPs mit Standard-Ports (priorisiert)
- **Phase 2: Deep Scan** - Interessante Hosts bekommen adaptive Port-Liste

#### 🎯 Smart Prioritization (Hacker-Strategie)
- **High Priority**: Gateway (.1, .254) → ZUERST scannen!
- **Medium Priority**: Häufige Server-IPs (.10, .20, .100, .200)
- **Low Priority**: Rest des Netzwerks

#### 🌐 CIDR-Aware Network Detection
- Automatische Erkennung der Subnetz-Maske (/24, /16, etc.)
- Gateway-Discovery (testet .1 und .254 automatisch)
- Eigene IP wird automatisch excludiert
- Zeigt CIDR in Logs an (z.B. "192.168.1.0/24")

#### 🔍 OS-Typ-Erkennung (Heuristik)
- **Windows**: RDP oder SMB ohne SSH → Windows erkannt
- **Linux**: SSH vorhanden → Linux erkannt  
- **Network Device**: Nur HTTP/HTTPS + wenige Ports → Router/Switch

#### ⚡ Adaptive Port-Listen (Service-basiert)
Der Agent passt die Port-Liste automatisch an basierend auf erkannten Services:

**Web-Server erkannt (HTTP/HTTPS)?**
→ Scannt zusätzlich: 8080, 8443, 8000, 3000

**Linux-Server erkannt (SSH)?**
→ Scannt zusätzlich: 3306 (MySQL), 5432 (PostgreSQL), 6379 (Redis), 27017 (MongoDB), 9200 (Elasticsearch)

**Windows-Server erkannt (RDP/SMB)?**
→ Scannt zusätzlich: 135 (RPC), 139 (NetBIOS), 5985/5986 (WinRM), 1433 (MSSQL)

**Directory Service erkannt (LDAP)?**
→ Scannt zusätzlich: 88 (Kerberos), 464 (Kerberos Change), 3268 (Global Catalog)

**Mail-Server erkannt?**
→ Scannt zusätzlich: 25, 465, 587, 993, 995 (alle Mail-Ports)

### 📊 Performance-Verbesserungen
- **Intelligente IP-Reihenfolge**: Gateway und Server-IPs zuerst → findet wichtige Hosts schneller
- **Deep Scan nur für Server**: Normale Clients bekommen Quick Scan, Server bekommen Deep Scan
- **10 parallele Worker** für Deep Scan (statt 5)
- **Keine unnötigen Scans**: Eigene IP wird automatisch übersprungen

### 📝 Neue Log-Ausgabe
```json
{"msg":"🧠 Starting INTELLIGENT network discovery (Hacker-Mode)"}
{"msg":"🎯 Scan-Strategie: Gateway → Server-IPs → Rest"}
{"msg":"🌐 Scanning network with Hacker-Intelligence","cidr":"192.168.65.0/24","gateway":"192.168.65.254"}
{"msg":"✓ Host discovered","ip":"192.168.65.254","open_ports":4,"services":["RDP","HTTP","SMB/CIFS","HTTPS"]}
{"msg":"🎯 Interesting host → Deep scan","ip":"192.168.65.254","os_type":"windows","is_server":true}
{"msg":"💎 Deep scan found additional ports!","new_ports":3,"total":7}
{"msg":"🎉 Intelligent network discovery completed!","hosts_found":5}
```

### 🆕 Neue Dateien
- ✅ `scanner/intelligence.go` - Komplette Hacker-Logik
- ✅ Funktionen: `getLocalNetworksWithCIDR()`, `detectGateway()`, `generatePrioritizedIPs()`, `getAdaptivePortList()`, `detectOSType()`

### 🔧 Code-Optimierungen
- Alte `getAllLocalNetworks()` ersetzt durch intelligente `getLocalNetworksWithCIDR()`
- Two-Stage-Scanning statt Single-Pass
- Service-basierte Entscheidungen statt statische Port-Liste

---

## Version 1.1 - Intelligente Discovery (2025-10-20)

### 🚀 Neue Features
- ✅ **Intelligente Netzwerk-Discovery**: Scannt nun ALLE privaten IP-Bereiche (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- ✅ **Erweiterte Host-Erkennung**: 10+ Quick-Check-Ports für schnellere Host-Discovery (HTTP, HTTPS, SSH, RDP, SMB, FTP, SMTP, Telnet, Alt-HTTP)
- ✅ **Verbesserte Service-Erkennung**: Automatische Identifikation von 25+ Standard-Services
- ✅ **Docker Desktop Support**: Docker-Desktop-Netzwerke (192.168.65.x) werden nun gescannt
- ✅ **Performance-Boost**: 100 parallele Worker (vorher 50) für 2x schnelleres Scanning
- ✅ **Besseres Logging**: Detaillierte Scan-Statistiken mit Dauer und Erfolgsquote
- ✅ **Echtzeit-Progress**: Progress-Updates alle 5 IPs (vorher 10) für besseres UX

### 🔧 Verbesserungen
- ✅ **Fix: Duplicate-Key-Error**: Discovery-Results werden nun korrekt mit UPDATE/INSERT gehandhabt
- ✅ **Schnellerer Alive-Check**: Timeout reduziert von 500ms auf 300ms
- ✅ **Netzwerk-Filter optimiert**: Nur echte Docker-Bridge-Netzwerke werden ausgefiltert (172.17.x, 172.18.x)
- ✅ **Häufigere Progress-Updates**: Alle 5 IPs statt 10 für besseres UX im Dashboard

### 📊 Performance-Verbesserungen
- 🔥 **2x schneller**: 100 parallele Worker (vorher 50)
- 🔥 **Schnellere Host-Discovery**: 300ms Timeout (vorher 500ms)
- 🔥 **Mehr Quick-Check-Ports**: 10 Ports (vorher 5) → findet mehr Hosts
- 🔥 **Bessere Netzwerk-Abdeckung**: Scannt nun Docker-Desktop-Netzwerke

### 🐛 Bug Fixes
- ✅ Fix: `duplicate key value violates unique constraint "discovery_results_connector_id_ip_address_key"`
- ✅ Fix: Docker-Desktop-Netzwerke wurden fälschlicherweise ausgefiltert
- ✅ Fix: Discovery-Results wurden nicht korrekt aktualisiert

### 📝 Dokumentation
- ✅ Neue Build-Scripts: `rebuild-agent.sh` und `rebuild-agent.bat`
- ✅ Update CHANGELOG mit allen Änderungen

---

## Version 1.0 - Production Ready (2025-10-17)

### ✅ Vollständig implementierte Features

#### Core Funktionen
- ✅ TLS/SSL Zertifikat-Scanning (443, 8443, 636, 993, 995, etc.)
- ✅ Connector-Registration bei Supabase
- ✅ Automatisches Asset-Management (Hosts/Ports)
- ✅ Periodische Scans (konfigurierbar)
- ✅ Heartbeat-Monitoring (alle 30 Sekunden)
- ✅ Health-Check-Endpoints (`/healthz`, `/readyz`)
- ✅ Graceful Shutdown (SIGTERM/SIGINT)

#### Scanner
- ✅ TLS-Handshake mit Timeout
- ✅ Zertifikat-Parsing (CN, SAN, Issuer, Fingerprint, etc.)
- ✅ SHA-256 Fingerprint-Berechnung
- ✅ Fehlerbehandlung mit Retry-Logik
- ✅ Parallel-Scanning mehrerer Hosts/Ports

#### Supabase Integration
- ✅ REST API Client
- ✅ Connector-Registration
- ✅ Asset Upsert (mit Deduplication)
- ✅ Certificate Upsert (mit Fingerprint-Dedup)
- ✅ Heartbeat Updates
- ✅ Tenant-Isolation (Row Level Security)

#### Observability
- ✅ Strukturiertes JSON-Logging (logrus)
- ✅ Debug-Modus (`LOG_LEVEL=DEBUG`)
- ✅ Erfolgs-/Fehler-Zähler pro Scan
- ✅ Health-Check-Server (Port 8080)
- ✅ Docker Health Checks

#### Deployment
- ✅ Multi-Stage Docker Build (nur ~10 MB final image)
- ✅ Docker-Compose-Support
- ✅ Umgebungsvariablen-Konfiguration
- ✅ Start-Scripts (Linux/Windows)
- ✅ .dockerignore für saubere Builds

#### Dokumentation
- ✅ Vollständiges README mit Beispielen
- ✅ Quick-Test-Guide
- ✅ Docker-Compose-Beispiele
- ✅ Troubleshooting-Guide
- ✅ Umgebungsvariablen-Dokumentation

### 🔧 Konfiguration

#### Erforderliche Variablen
- `SUPABASE_URL` - Supabase Projekt URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key für Backend-API

#### Optionale Variablen
- `CONNECTOR_TOKEN` - Token für Connector-Registration
- `CONNECTOR_NAME` - Name des Agents (default: `agent-TIMESTAMP`)
- `SCAN_TARGETS` - Komma-separierte Host-Liste (default: `localhost`)
- `SCAN_PORTS` - Komma-separierte Port-Liste (default: `443,8443,636`)
- `SCAN_INTERVAL` - Intervall in Sekunden (default: `3600` = 1 Stunde)
- `SCAN_TIMEOUT` - Timeout pro Scan (default: `5` Sekunden)
- `HEALTH_CHECK_PORT` - Port für Health Checks (default: `8080`)
- `LOG_LEVEL` - Log-Level (default: `INFO`, Options: `DEBUG`, `WARN`, `ERROR`)

### 📦 Deployment-Optionen

1. **Docker Run** (Simplest)
   ```bash
   docker run -d --name certwatcher-agent \
     -e SUPABASE_URL=... \
     -e SUPABASE_SERVICE_ROLE_KEY=... \
     -e SCAN_TARGETS=internal.example.com \
     -p 8080:8080 \
     certwatcher/agent:latest
   ```

2. **Docker Compose** (Recommended)
   ```bash
   docker-compose up -d
   ```

3. **Kubernetes** (siehe README)
4. **Systemd Service** (siehe README)
5. **Windows Service** (siehe README)

### 🔐 Sicherheit

- ✅ Keine Private Keys gespeichert (nur Metadaten)
- ✅ Service Role Key über Umgebungsvariablen
- ✅ Tenant-Isolation durch RLS
- ✅ InsecureSkipVerify für interne Zertifikate (by design)
- ✅ Kein Root-User im Docker Container
- ✅ Readonly Filesystem (optional)

### 📊 Monitoring

- ✅ Strukturierte Logs (JSON)
- ✅ Health-Check-Endpoints
- ✅ Heartbeat alle 30 Sekunden
- ✅ Scan-Statistiken (Success/Fail Count)
- ✅ Docker Health Checks

### 🚀 Performance

- **Image Size:** ~10 MB (Alpine-based)
- **Memory:** < 20 MB unter Last
- **CPU:** < 1% idle, < 5% beim Scannen
- **Startup Time:** < 2 Sekunden
- **Scan Speed:** ~100ms pro Host/Port

### 🐛 Bekannte Limitierungen

- Kein SNI für Virtual Hosts (geplant für v1.1)
- Keine STARTTLS-Unterstützung für SMTP/LDAP (geplant für v1.1)
- Keine Client-Zertifikat-Auth (geplant für v1.2)
- Key-Size-Extraktion noch nicht implementiert

### 📝 Migration von v0.x

Wenn du eine ältere Version verwendest:

1. Stoppe alten Agent: `docker stop certwatcher-agent`
2. Neues Image pullen: `docker pull certwatcher/agent:latest`
3. Neue Umgebungsvariablen setzen (siehe oben)
4. Agent starten mit neuen Parametern

### 🎯 Nächste Steps (Roadmap)

- [ ] v1.1: SNI Support für Virtual Hosts
- [ ] v1.1: STARTTLS für SMTP/LDAP
- [ ] v1.2: Client-Zertifikat-Authentifizierung
- [ ] v1.2: Automatische Netzwerk-Discovery
- [ ] v1.3: Prometheus Metrics Export
- [ ] v1.3: Certificate Validation (gegen Issuer Chain)
- [ ] v2.0: gRPC API für schnellere Kommunikation

### 🤝 Contribution

Contributions sind willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

### 📄 Lizenz

Siehe [LICENSE](../LICENSE).

