# Agent bauen und veröffentlichen

## Option 1: Lokal bauen (Empfohlen für Test) ⚡

```powershell
# 1. Gehe ins Agent-Verzeichnis
cd agent

# 2. Baue das Docker Image
docker build -t certwatcher/agent:latest .

# 3. Jetzt kannst du den Agent starten!
docker run -d `
  --name certwatcher-agent-test `
  -e SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co `
  -e CONNECTOR_TOKEN=dein-token-hier `
  -e CONNECTOR_NAME="Test-Agent" `
  -e SCAN_TARGETS=192.168.178.32 `
  -e SCAN_PORTS=443 `
  -p 8080:8080 `
  certwatcher/agent:latest
```

## Option 2: Auf GitHub Container Registry veröffentlichen (Öffentlich) 🌐

### Schritt 1: GitHub Personal Access Token erstellen

1. Gehe zu https://github.com/settings/tokens
2. Klicke "Generate new token" → "Generate new token (classic)"
3. Name: `certwatcher-agent`
4. Scopes auswählen:
   - ✅ `write:packages` (schließt `read:packages` ein)
   - ✅ `delete:packages`
5. Token kopieren (wird nur einmal angezeigt!)

### Schritt 2: Bei GitHub Container Registry anmelden

```powershell
# Ersetze YOUR_TOKEN mit deinem Token
echo YOUR_TOKEN | docker login ghcr.io -u antonio-030 --password-stdin
```

### Schritt 3: Image bauen und pushen

```powershell
# 1. Gehe ins Agent-Verzeichnis
cd agent

# 2. Baue das Image mit GitHub Registry Tag
docker build -t ghcr.io/antonio-030/certwatcher-agent:latest .

# 3. Pushe zu GitHub Container Registry
docker push ghcr.io/antonio-030/certwatcher-agent:latest

# Optional: Mit Version-Tag
docker tag ghcr.io/antonio-030/certwatcher-agent:latest ghcr.io/antonio-030/certwatcher-agent:v1.0.0
docker push ghcr.io/antonio-030/certwatcher-agent:v1.0.0
```

### Schritt 4: Package öffentlich machen

1. Gehe zu https://github.com/antonio-030?tab=packages
2. Klicke auf `certwatcher-agent`
3. Klicke "Package settings"
4. Scrolle runter zu "Danger Zone"
5. Klicke "Change visibility" → "Public"

### Schritt 5: Agent starten (von GitHub)

Jetzt kann JEDER den Agent nutzen:

```powershell
docker run -d `
  --name certwatcher-agent-home `
  -e SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co `
  -e CONNECTOR_TOKEN=dein-token-hier `
  -e CONNECTOR_NAME="Home-Agent" `
  -e SCAN_TARGETS=192.168.178.32 `
  -e SCAN_PORTS=443,8443,636 `
  -p 8080:8080 `
  ghcr.io/antonio-030/certwatcher-agent:latest
```

## Option 3: Auf Docker Hub veröffentlichen 🐳

### Schritt 1: Docker Hub Account erstellen

1. Gehe zu https://hub.docker.com/signup
2. Erstelle Account
3. Bestätige E-Mail

### Schritt 2: Anmelden

```powershell
docker login
# Username: dein-dockerhub-username
# Password: dein-dockerhub-passwort
```

### Schritt 3: Image bauen und pushen

```powershell
# 1. Gehe ins Agent-Verzeichnis
cd agent

# 2. Baue mit deinem Docker Hub Username
docker build -t dein-username/certwatcher-agent:latest .

# 3. Pushe zu Docker Hub
docker push dein-username/certwatcher-agent:latest

# Optional: Mit Version
docker tag dein-username/certwatcher-agent:latest dein-username/certwatcher-agent:v1.0.0
docker push dein-username/certwatcher-agent:v1.0.0
```

### Schritt 4: Agent starten (von Docker Hub)

```powershell
docker run -d `
  --name certwatcher-agent `
  -e SUPABASE_URL=... `
  -e CONNECTOR_TOKEN=... `
  dein-username/certwatcher-agent:latest
```

## Automatisches Build mit GitHub Actions (Empfohlen) 🤖

Erstelle `.github/workflows/docker-publish.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: ./agent
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

Dann bei jedem Push zu `main` wird automatisch ein neues Image gebaut!

## Frontend Config anpassen

In `frontend/src/pages/Connectors.tsx` ändere:

```typescript
// Von:
certwatcher/agent:latest

// Zu:
ghcr.io/antonio-030/certwatcher-agent:latest
```

## Zusammenfassung

**Für DICH (Test):**
```powershell
cd agent
docker build -t certwatcher/agent:latest .
# Dann Agent starten
```

**Für ANDERE (Public):**
```powershell
cd agent
docker build -t ghcr.io/antonio-030/certwatcher-agent:latest .
docker login ghcr.io -u antonio-030
docker push ghcr.io/antonio-030/certwatcher-agent:latest
# Dann auf GitHub als Public markieren
```

**Beste Lösung:**
- GitHub Actions einrichten (siehe oben)
- Automatisches Build bei jedem Push
- Immer aktuelles Image verfügbar!

