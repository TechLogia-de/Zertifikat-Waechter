# Docker Images auf GitHub Container Registry veröffentlichen

## Status

Die Docker Images werden automatisch gebaut, sind aber standardmäßig **PRIVAT**.

## Schritte um Images öffentlich zu machen

### 1. Warten bis der erste Build fertig ist

Gehe zu: https://github.com/TechLogia-de/Zertifikat-Waechter/actions

Der Workflow "Build and Publish Docker Images" sollte laufen. Warte bis er erfolgreich abgeschlossen ist (~5-10 Minuten).

### 2. Packages öffentlich machen

Nach dem ersten erfolgreichen Build:

#### Für Agent Image:
1. Gehe zu: https://github.com/orgs/TechLogia-de/packages/container/zertifikat-waechter-agent/settings

   **ODER** (falls keine Organization):

   https://github.com/users/TechLogia-de/packages/container/zertifikat-waechter-agent/settings

2. Scrolle nach unten zu "Danger Zone"
3. Klicke auf "Change visibility"
4. Wähle "Public"
5. Bestätige mit dem Repository-Namen

#### Für MCP Server Image:
1. Gehe zu: https://github.com/orgs/TechLogia-de/packages/container/zertifikat-waechter-mcp-server/settings
2. Wiederhole die Schritte (Change visibility → Public)

#### Für Worker Image:
1. Gehe zu: https://github.com/orgs/TechLogia-de/packages/container/zertifikat-waechter-worker/settings
2. Wiederhole die Schritte (Change visibility → Public)

### 3. Testen

Nach dem Ändern auf "Public":

```bash
# Agent Image pullen (sollte jetzt funktionieren)
docker pull ghcr.io/techlogia-de/zertifikat-waechter-agent:latest

# MCP Server Image pullen
docker pull ghcr.io/techlogia-de/zertifikat-waechter-mcp-server:latest

# Worker Image pullen
docker pull ghcr.io/techlogia-de/zertifikat-waechter-worker:latest
```

## Alternative: Images während des Builds öffentlich machen

Um die Images direkt beim ersten Build öffentlich zu machen, können wir die Workflow-Datei anpassen. Allerdings ist dies nicht immer zuverlässig, daher empfehle ich die manuelle Methode oben.

## Troubleshooting

### Build schlägt fehl
- Überprüfe die GitHub Actions Logs
- Stelle sicher, dass alle Dockerfiles korrekt sind
- Prüfe ob die `GITHUB_TOKEN` Permissions korrekt sind

### 401 Unauthorized beim Pull
- Images sind noch privat → Siehe Schritt 2
- Images wurden noch nicht gebaut → Siehe Schritt 1

### Images nicht gefunden
- Überprüfe die Namen: https://github.com/orgs/TechLogia-de/packages
- Stelle sicher, dass der Workflow erfolgreich war

## Weitere Informationen

**Packages anzeigen:**
- https://github.com/orgs/TechLogia-de/packages (für Organizations)
- https://github.com/TechLogia-de?tab=packages (für User Account)

**Workflow Status:**
- https://github.com/TechLogia-de/Zertifikat-Waechter/actions

**GitHub Container Registry Docs:**
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
