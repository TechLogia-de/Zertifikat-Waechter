# 🔄 ACME Auto-Renewal Guide

## Was ist ACME?

ACME (Automated Certificate Management Environment) ist ein Protokoll zur automatischen Ausstellung und Erneuerung von SSL/TLS-Zertifikaten. Die bekannteste Implementation ist **Let's Encrypt**.

## Features

✅ **Let's Encrypt Integration** - Kostenlose SSL-Zertifikate  
✅ **DNS-01 Challenge** - Für Wildcard-Zertifikate (*.example.com)  
✅ **HTTP-01 Challenge** - Für einzelne Domains  
✅ **Cloudflare Integration** - Automatische DNS-Validierung  
✅ **Auto-Renewal Dashboard** - Übersicht aller Renewals  

---

## 🚀 Quick Start

### 1. ACME Account erstellen

1. Gehe zu **ACME Auto-Renewal** in der Sidebar
2. Klicke auf **➕ Account erstellen**
3. Wähle Provider (Let's Encrypt empfohlen)
4. Gib deine E-Mail-Adresse ein
5. Klicke auf **✓ Account erstellen**

**Provider-Optionen:**
- **Let's Encrypt** (empfohlen) - Kostenlos, vertrauenswürdig
- **ZeroSSL** - Alternative zu Let's Encrypt
- **Buypass** - Norwegischer CA mit 180-Tage-Zertifikaten

---

### 2. Cloudflare API konfigurieren (für DNS-01)

Für **Wildcard-Zertifikate** (*.example.com) benötigst du einen Cloudflare API Token.

#### Cloudflare API Token erstellen:

1. Gehe zu [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Klicke auf **Create Token**
3. Wähle Template: **Edit zone DNS**
4. Konfiguriere:
   - **Permissions**: Zone → DNS → Edit
   - **Zone Resources**: Include → Specific zone → [Deine Domain]
5. Klicke auf **Continue to summary** → **Create Token**
6. **Kopiere den Token** (wird nur einmal angezeigt!)

#### Token im Zertifikat-Wächter eintragen:

1. Gehe zu **ACME Auto-Renewal**
2. Scrolle zu **Cloudflare DNS-01 Integration**
3. Füge den API Token ein
4. Optional: Zone ID (beschleunigt Lookups)
5. Klicke auf **💾 Cloudflare Config speichern**

---

### 3. Renewal Order erstellen

1. Klicke auf **➕ Order erstellen**
2. Wähle deinen **ACME Account**
3. Gib die **Domain** ein:
   - Einzelne Domain: `example.com`
   - Wildcard: `*.example.com`
   - Beide: Erstelle 2 separate Orders
4. Wähle **Challenge-Typ**:
   - **DNS-01**: Für Wildcards (benötigt Cloudflare)
   - **HTTP-01**: Für einzelne Domains (Server muss öffentlich erreichbar sein)
5. Klicke auf **✓ Order erstellen**

---

## 📋 Challenge-Typen erklärt

### DNS-01 Challenge

✅ **Vorteile:**
- Wildcard-Zertifikate möglich (*.example.com)
- Funktioniert auch wenn Server nicht öffentlich erreichbar
- Sicherer (kein offener Port 80 nötig)

❌ **Nachteile:**
- Benötigt DNS-Provider API (z.B. Cloudflare)
- Etwas komplexer einzurichten

**Wie es funktioniert:**
1. ACME-Server fordert einen TXT-Record für `_acme-challenge.example.com`
2. Zertifikat-Wächter erstellt den Record via Cloudflare API
3. ACME-Server validiert den DNS-Record
4. Zertifikat wird ausgestellt

---

### HTTP-01 Challenge

✅ **Vorteile:**
- Einfach einzurichten
- Keine DNS-API nötig

❌ **Nachteile:**
- Keine Wildcard-Zertifikate möglich
- Server muss auf Port 80 öffentlich erreichbar sein
- Firewall/Load Balancer können Probleme verursachen

**Wie es funktioniert:**
1. ACME-Server fordert eine Datei unter `http://example.com/.well-known/acme-challenge/TOKEN`
2. Zertifikat-Wächter stellt die Datei bereit
3. ACME-Server ruft die URL ab
4. Zertifikat wird ausgestellt

---

## 🔐 Sicherheit

### Was wird gespeichert?

✅ **Gespeichert in Datenbank:**
- ACME Account E-Mail
- Provider (Let's Encrypt, ZeroSSL, etc.)
- Account URL
- Order Status

❌ **NICHT gespeichert:**
- Private Keys von Zertifikaten (nur Referenz)
- Cloudflare API Token (verschlüsselt in Integrations-Tabelle)

### Best Practices

1. **API Token minimale Rechte**: Nur `Zone:DNS:Edit` für Cloudflare
2. **Separate E-Mail**: Verwende eine dedizierte E-Mail für ACME
3. **Monitoring**: Überwache Orders im Dashboard
4. **Backup**: Exportiere Zertifikate regelmäßig

---

## 📊 Status-Übersicht

### Order Status

| Status | Bedeutung | Aktion |
|--------|-----------|--------|
| 🟡 Pending | Order erstellt, wartet auf Verarbeitung | Warten |
| 🔵 Processing | Challenge wird durchgeführt | Warten |
| 🟢 Valid | Zertifikat erfolgreich ausgestellt | ✓ Fertig |
| 🔴 Invalid | Fehler bei Challenge | Fehler prüfen |
| ⚫ Revoked | Zertifikat widerrufen | Neu erstellen |

---

## 🛠️ Troubleshooting

### DNS-01 Fehler

**Problem:** "DNS validation failed"

**Lösung:**
1. Prüfe ob Cloudflare API Token gültig ist
2. Stelle sicher, dass Zone ID korrekt ist
3. Warte 2-3 Minuten (DNS-Propagierung)
4. Prüfe ob Domain bei Cloudflare gehostet wird

---

### HTTP-01 Fehler

**Problem:** "Connection refused" oder "Timeout"

**Lösung:**
1. Stelle sicher, dass Port 80 offen ist
2. Prüfe Firewall-Regeln
3. Teste: `curl http://example.com/.well-known/acme-challenge/test`
4. Load Balancer muss `/.well-known/acme-challenge/*` durchlassen

---

### Rate Limits

Let's Encrypt hat Rate Limits:
- **50 Certificates per domain per week**
- **5 Failed Validations per hour**
- **300 New Orders per 3 hours**

Bei Überschreitung: Warte bis Limit zurückgesetzt wird oder verwende Staging-Server zum Testen.

---

## 🎯 Use Cases

### 1. Wildcard für alle Subdomains

```
Domain: *.example.com
Challenge: DNS-01 (mit Cloudflare)
→ Deckt ab: api.example.com, www.example.com, staging.example.com, etc.
```

### 2. Einzelne Produktions-Domain

```
Domain: www.example.com
Challenge: HTTP-01
→ Einfach, schnell, keine API nötig
```

### 3. Multi-Domain Setup

Erstelle separate Orders für:
- `example.com` (HTTP-01)
- `*.example.com` (DNS-01)
- `www.example.com` (HTTP-01)

---

## 📚 Weitere Ressourcen

- [Let's Encrypt Dokumentation](https://letsencrypt.org/docs/)
- [ACME Protocol Spec](https://tools.ietf.org/html/rfc8555)
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
- [Challenge Types erklärt](https://letsencrypt.org/docs/challenge-types/)

---

## 🚨 Wichtige Hinweise

1. **Produktions-Zertifikate**: Let's Encrypt hat Rate Limits! Teste erst mit Staging.
2. **Renewal-Zeitpunkt**: Zertifikate sollten 30 Tage vor Ablauf erneuert werden.
3. **Monitoring**: Überwache Ablaufdaten in der **Certificates**-Seite.
4. **Backup**: Exportiere wichtige Zertifikate manuell als Backup.

---

**Bei Fragen oder Problemen:** Prüfe die Audit Log-Seite für detaillierte Events! 🔍

