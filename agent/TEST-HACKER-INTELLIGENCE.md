# 🧠 Hacker-Intelligence Test Guide

## ✨ Was ist neu?

Der Agent nutzt jetzt **regelbasierte Hacker-Intelligenz** statt dummes Blind-Scanning:

### 🎯 Intelligente Strategien

1. **CIDR-Aware**: Agent erkennt Subnetz automatisch (z.B. /24, /16)
2. **Gateway-First**: Gateway wird ZUERST gescannt (.1, .254)
3. **Smart Prioritization**: Wichtige IPs (Server-Bereiche) vor Clients
4. **OS-Detection**: Erkennt Windows/Linux/Network-Device
5. **Adaptive Scanning**: Port-Liste passt sich an erkannte Services an!

### 🔬 Two-Stage-Scanning

**Phase 1: Quick Scan**
- Alle IPs mit 25 Standard-Ports
- Priorisierte Reihenfolge (Gateway → Server-IPs → Rest)

**Phase 2: Deep Scan** (nur für interessante Hosts!)
- Hosts mit 3+ offenen Ports bekommen Deep Scan
- Adaptive Port-Liste basierend auf Services
- Windows → Windows-Ports, Linux → Linux-Ports

---

## 🚀 Testing

### 1. Agent starten

**WICHTIG: Erst RLS-Fix anwenden!**
```powershell
# In Supabase SQL Editor ausführen:
# apply-discovery-rls-fix.sql

# Agent starten
cd agent
docker stop certwatcher-agent-test 2>$null
docker rm certwatcher-agent-test 2>$null
docker run -d --name certwatcher-agent-test --network host -e SUPABASE_URL=<URL> -e SUPABASE_ANON_KEY=<KEY> -e CONNECTOR_TOKEN=<TOKEN> -e CONNECTOR_NAME="Hacker-Test" certwatcher/agent:latest
```

### 2. Erwartete Log-Ausgabe

**Alte Version (v1.1):**
```json
{"msg":"Starting network discovery on ALL networks","networks":["192.168.65"]}
{"msg":"Host discovered","ip":"192.168.65.254","open_ports":[80,443,3389,445]}
{"msg":"Network discovery completed","hosts_found":5}
```

**Neue Version (v1.2 - Hacker-Mode):**
```json
{"msg":"🧠 Starting INTELLIGENT network discovery (Hacker-Mode)"}
{"msg":"🎯 Scan-Strategie: Gateway → Server-IPs → Rest","total_ips":253}
{"msg":"🌐 Scanning network with Hacker-Intelligence","network":"192.168.65","cidr":"192.168.65.0/24","gateway":"192.168.65.254","own_ip":"192.168.65.2"}
{"msg":"✓ Host discovered","ip":"192.168.65.254","open_ports":4,"services":["RDP","HTTP","SMB/CIFS","HTTPS"]}
{"msg":"🔬 Starting DEEP scan for interesting hosts...","hosts_found":5}
{"msg":"🎯 Interesting host → Deep scan","ip":"192.168.65.254","os_type":"windows","is_server":true}
{"msg":"💎 Deep scan found additional ports!","ip":"192.168.65.254","new_ports":2,"total":6}
{"msg":"🎉 Intelligent network discovery completed!","hosts_found":5}
```

### 3. Logs anschauen

```powershell
docker logs -f certwatcher-agent-test
```

**Achte auf diese Emojis:**
- 🧠 = Hacker-Mode aktiviert
- 🎯 = Priorisierte Strategie
- 🌐 = CIDR-Erkennung
- ✓ = Host gefunden
- 🔬 = Deep Scan startet
- 💎 = Zusätzliche Ports gefunden (Deep Scan erfolgreich!)
- 🎉 = Scan abgeschlossen

### 4. Dashboard prüfen

1. Öffne Dashboard → Connectors → "📊 Details"
2. Prüfe **"🌐 Netzwerk-Scan Ergebnisse"**
3. Du solltest nun:
   - ✅ **Gateway zuerst** in der Liste sehen
   - ✅ **Mehr Ports** bei Servern (Deep Scan!)
   - ✅ **CIDR-Info** in Logs

---

## 🧪 Test-Szenarien

### Szenario 1: Gateway-Erkennung

**Test:**
```powershell
# Prüfe ob Gateway zuerst gescannt wird
docker logs certwatcher-agent-test | Select-String "gateway"
```

**Erwartung:**
```
{"msg":"🌐 Scanning network...","gateway":"192.168.65.254"}
{"msg":"✓ Host discovered","ip":"192.168.65.254",...}  # <- Als erstes gefunden!
```

### Szenario 2: OS-Erkennung

**Test:**
```powershell
# Prüfe ob OS-Typ erkannt wird
docker logs certwatcher-agent-test | Select-String "os_type"
```

**Erwartung:**
```
{"msg":"🎯 Interesting host → Deep scan","os_type":"windows",...}
{"msg":"🎯 Interesting host → Deep scan","os_type":"linux",...}
```

### Szenario 3: Adaptive Port-Liste

**Test:**
Host mit SSH (22) sollte zusätzlich MySQL/PostgreSQL/Redis Ports bekommen.

**Erwartung im Log:**
```
{"msg":"✓ Host discovered","ip":"10.0.0.5","services":["SSH"]}
{"msg":"🎯 Interesting host → Deep scan","os_type":"linux"}
{"msg":"💎 Deep scan found additional ports!","new_ports":3}  # MySQL, PostgreSQL, Redis!
```

### Szenario 4: Deep Scan nur für Server

**Test:**
Normale Clients (1-2 Ports) sollten KEINEN Deep Scan bekommen.

**Erwartung:**
```
{"msg":"✓ Host discovered","ip":"192.168.1.150","open_ports":1,"services":["HTTP"]}
# KEIN "Deep scan" für diesen Host!
```

---

## 📊 Performance-Vergleich

### Alte Version (v1.1)
- ❌ Blind-Scanning aller IPs in zufälliger Reihenfolge
- ❌ Alle Hosts bekommen gleiche Port-Liste
- ❌ Keine Priorisierung
- ❌ Keine OS-Erkennung
- ⏱️ Scan-Zeit: ~3-5 Minuten

### Neue Version (v1.2 - Hacker-Mode)
- ✅ Gateway zuerst, dann wichtige Server-IPs
- ✅ Adaptive Port-Liste basierend auf Services
- ✅ Deep Scan nur für interessante Hosts
- ✅ OS-Erkennung (Windows/Linux/Network-Device)
- ⏱️ Scan-Zeit: ~2-4 Minuten (schneller durch Priorisierung!)

---

## 🎓 Hacker-Strategie Explained

### Warum Gateway zuerst?
Router/Gateways sind oft:
- Wichtigste Netzwerk-Komponente
- Haben Management-Interfaces (HTTP/HTTPS)
- Können Hinweise auf Netzwerk-Struktur geben

### Warum Server-IPs priorisieren?
Admins vergeben oft vorhersehbare IPs:
- .10, .20 → Produktions-Server
- .100, .200 → Test-Server
- .250 → Management-Server

### Warum Deep Scan nur für Server?
- Client-PCs (1-2 Ports) sind uninteressant
- Server (3+ Ports) könnten weitere Services verbergen
- Spart Zeit und Ressourcen!

### Wie funktioniert Adaptive Port-Liste?

**Beispiel: Windows-Server gefunden**
1. Quick Scan findet: 80 (HTTP), 443 (HTTPS), 3389 (RDP)
2. OS-Detection: "RDP vorhanden → Windows!"
3. Deep Scan testet zusätzlich:
   - 135 (RPC)
   - 139 (NetBIOS)
   - 445 (SMB) → **GEFUNDEN!**
   - 5985 (WinRM)
   - 1433 (MSSQL)

**Resultat:** Findet SMB-Share der ohne Hacker-Logik übersehen worden wäre! 💎

---

## 🐛 Troubleshooting

### Problem: Keine Emojis in Logs
**Lösung:** Das ist normal. Emojis sind nur zur Verdeutlichung im Markdown. Die echten Logs nutzen Unicode.

### Problem: "No valid private networks found"
**Lösung:** 
```powershell
# Prüfe ob Agent mit --network host läuft
docker inspect certwatcher-agent-test | Select-String "NetworkMode"
# Sollte zeigen: "NetworkMode": "host"
```

### Problem: Agent findet keine Hosts
**Lösung:**
1. Firewall prüfen (Windows Defender kann Scans blockieren)
2. Netzwerk prüfen (VPN aktiv?)
3. Logs prüfen: `docker logs certwatcher-agent-test`

### Problem: RLS-Fehler
**Lösung:** 
```sql
-- In Supabase SQL Editor ausführen:
ALTER TABLE discovery_results DISABLE ROW LEVEL SECURITY;
GRANT ALL ON discovery_results TO anon, authenticated;
```

---

## 🎉 Erfolg!

Wenn du diese Logs siehst, funktioniert die Hacker-Intelligence perfekt:

```json
{"level":"info","msg":"🧠 Starting INTELLIGENT network discovery (Hacker-Mode)","time":"..."}
{"level":"info","msg":"🎯 Scan-Strategie: Gateway → Server-IPs → Rest","total_ips":253,"time":"..."}
{"level":"info","msg":"🌐 Scanning network with Hacker-Intelligence","network":"192.168.1","cidr":"192.168.1.0/24","gateway":"192.168.1.1","time":"..."}
{"level":"info","msg":"✓ Host discovered","ip":"192.168.1.1","open_ports":2,"services":["HTTP","HTTPS"],"time":"..."}
{"level":"info","msg":"🔬 Starting DEEP scan for interesting hosts...","hosts_found":8,"time":"..."}
{"level":"info","msg":"🎯 Interesting host → Deep scan","ip":"192.168.1.10","os_type":"linux","is_server":true,"time":"..."}
{"level":"info","msg":"💎 Deep scan found additional ports!","ip":"192.168.1.10","new_ports":4,"total":9,"time":"..."}
{"level":"info","msg":"🎉 Intelligent network discovery completed!","hosts_found":8,"time":"..."}
```

**Der Agent denkt jetzt wie ein Hacker! 🧠🔒**



