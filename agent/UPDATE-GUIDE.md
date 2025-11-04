# 🔄 Agent Update Guide - Version 1.1

## 🚀 Schnelle Aktualisierung

### Option 1: Automatisches Rebuild (empfohlen)

**Linux/Mac:**
```bash
cd agent
chmod +x rebuild-agent.sh
./rebuild-agent.sh
./start-agent.sh
```

**Windows:**
```powershell
cd agent
.\rebuild-agent.bat
.\start-agent.bat
```

### Option 2: Manuelles Update

**1. Agent stoppen:**
```bash
docker stop certwatcher-agent-test
docker rm certwatcher-agent-test
```

**2. Neues Image bauen:**
```bash
cd agent
docker build -t certwatcher/agent:latest .
```

**3. Agent neu starten:**
```bash
./start-agent.sh  # Linux/Mac
# ODER
.\start-agent.bat  # Windows
```

**4. Logs prüfen:**
```bash
docker logs -f certwatcher-agent-test
```

---

## ✨ Was ist neu in Version 1.1?

### 🌐 Intelligente Netzwerk-Discovery
Der Agent scannt jetzt **ALLE privaten IP-Bereiche** automatisch:
- ✅ 192.168.x.x (Heimnetzwerke, Docker Desktop)
- ✅ 10.x.x.x (Unternehmensnetzwerke)
- ✅ 172.16-31.x.x (Docker, Firmen-LANs)

**Vorher:** Nur explizit konfigurierte Targets
**Jetzt:** Automatische Discovery aller erreichbaren Hosts im Netzwerk!

### 🔍 Erweiterte Host-Erkennung
Der Agent prüft nun **10 Standard-Ports** für schnellere Host-Discovery:
- Web: 80, 443, 8080, 8443
- Remote: 22 (SSH), 3389 (RDP)
- File-Sharing: 445 (SMB)
- Mail: 25 (SMTP)
- Legacy: 21 (FTP), 23 (Telnet)

**Vorher:** 5 Ports → viele Hosts übersehen
**Jetzt:** 10 Ports → findet deutlich mehr Hosts!

### 🏷️ Automatische Service-Erkennung
Der Agent identifiziert automatisch **25+ Standard-Services**:
- **Web-Server:** HTTP, HTTPS, HTTP-Proxy
- **Mail:** SMTP, SMTPS, IMAP, IMAPS, POP3, POP3S
- **Verzeichnisdienste:** LDAP, LDAPS
- **Datenbanken:** MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch
- **Remote-Access:** SSH, RDP, VNC
- **File-Sharing:** FTP, SMB/CIFS
- **DNS, Telnet** und mehr

**Beispiel-Output im Dashboard:**
```
🌐 Host: 192.168.1.100
   Ports: 22, 80, 443, 3306
   Services: SSH, HTTP, HTTPS, MySQL
```

### ⚡ Performance-Verbesserungen
- **2x schneller:** 100 parallele Worker (vorher 50)
- **Schnellere Host-Discovery:** 300ms Timeout (vorher 500ms)
- **Bessere Netzwerk-Abdeckung:** Docker-Desktop-Netzwerke werden gescannt
- **Echtzeit-Updates:** Progress-Updates alle 5 IPs (vorher 10)

### 🐛 Bug Fixes
- ✅ **Fix:** Duplicate-Key-Error beim Speichern von Discovery-Results
- ✅ **Fix:** Docker-Desktop-Netzwerke (192.168.65.x) wurden fälschlicherweise ignoriert
- ✅ **Fix:** Discovery-Results wurden nicht korrekt aktualisiert

---

## 🧪 Testing nach dem Update

### 1. Agent-Status prüfen
```bash
docker ps | grep certwatcher-agent
# Sollte zeigen: Up X seconds (healthy)
```

### 2. Logs anschauen
```bash
docker logs -f certwatcher-agent-test
```

**Erwartete Ausgabe:**
```json
{"level":"info","msg":"Starting Zertifikat-Wächter Agent","time":"2025-10-20T12:00:00Z"}
{"level":"info","msg":"✅ Connector authenticated successfully!","time":"2025-10-20T12:00:01Z"}
{"level":"info","msg":"Starting network discovery on ALL networks","networks":["192.168.1","192.168.65"],"networks_found":2,"time":"2025-10-20T12:00:02Z"}
{"level":"info","msg":"Host discovered","host":"192.168.1.1","open_ports":[80,443],"services":["HTTP","HTTPS"],"time":"2025-10-20T12:00:10Z"}
```

### 3. Dashboard prüfen
1. Öffne das Dashboard: https://dein-dashboard.com/connectors
2. Klicke auf "📊 Details" bei deinem Agent
3. Prüfe **"🌐 Netzwerk-Scan Ergebnisse"** – sollte nun viel mehr Hosts zeigen!

**Vorher:** 0-3 Hosts
**Jetzt:** 5-20+ Hosts (je nach Netzwerk)

---

## 🔧 Troubleshooting

### Problem: Agent findet keine Hosts
**Lösung:** Stelle sicher, dass der Agent mit `--network host` läuft:
```bash
docker run --network host ...
```

**Wichtig für Windows Docker Desktop:**
- Host-Network funktioniert nur auf Linux!
- Für Windows: Nutze **manuelle Targets** statt Auto-Discovery

### Problem: Duplicate-Key-Error in Logs
**Lösung:** Das wurde in v1.1 gefixt! Update durchführen.

### Problem: Agent scannt nur Docker-Netzwerk
**Lösung:** Das wurde in v1.1 gefixt! Agent scannt nun alle privaten Netzwerke.

### Problem: Scan dauert sehr lange
**Normal!** Ein vollständiger Netzwerk-Scan kann 5-10 Minuten dauern:
- 254 IPs pro Netzwerk × 25 Ports = viele Verbindungen
- Mit 100 parallelen Workern: ~3-5 Minuten pro Netzwerk

**Tipp:** Nutze manuelle Targets für produktive Umgebungen:
```bash
SCAN_TARGETS=server1.local,192.168.1.10,mail.firma.de
SCAN_PORTS=443,636,993
```

---

## 📊 Performance-Vergleich

| Feature | v1.0 | v1.1 | Verbesserung |
|---------|------|------|--------------|
| Parallele Worker | 50 | 100 | **+100%** |
| Quick-Check-Ports | 5 | 10 | **+100%** |
| Alive-Check-Timeout | 500ms | 300ms | **+40% schneller** |
| Netzwerk-Abdeckung | Nur 172.16.x | Alle privaten IPs | **+200%** |
| Progress-Updates | Alle 10 IPs | Alle 5 IPs | **+100% häufiger** |
| Docker Desktop Support | ❌ | ✅ | **NEU!** |

---

## 🎯 Best Practices

### Production-Umgebungen
**Nutze manuelle Targets für bessere Performance:**
```bash
# .env
SCAN_TARGETS=web1.prod,web2.prod,ldap.prod,mail.prod
SCAN_PORTS=443,636,993,995
SCAN_INTERVAL=3600  # 1 Stunde
```

### Development/Test-Umgebungen
**Nutze Auto-Discovery für maximale Abdeckung:**
```bash
# .env
SCAN_TARGETS=localhost  # Trigger für Auto-Discovery
SCAN_INTERVAL=1800      # 30 Minuten
```

### Hybrid-Ansatz
**Kombiniere beides:**
1. Agent 1: Auto-Discovery für Netzwerk-Übersicht
2. Agent 2: Manuelle Targets für kritische Server (häufigere Scans)

---

## 📝 Fragen?

- **Logs:** `docker logs -f certwatcher-agent-test`
- **Health-Check:** `curl http://localhost:8080/healthz`
- **Dashboard:** https://dein-dashboard.com/connectors
- **Dokumentation:** `agent/README.md`

---

**Happy Scanning! 🚀**


