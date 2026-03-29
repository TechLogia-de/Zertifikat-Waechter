import Badge from '../../ui/Badge'
import { Connector, ConnectorWithToken } from './types'

export function getDockerCommand(connector: ConnectorWithToken): string {
  const targets = connector.config?.scan_targets?.join(',') || 'localhost'
  const ports = connector.config?.scan_ports?.join(',') || '443'
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://***REMOVED***'
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'

  return `docker run -d \\
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \\
  --network host \\
  -e SUPABASE_URL=${supabaseUrl} \\
  -e SUPABASE_ANON_KEY=${anonKey} \\
  -e CONNECTOR_TOKEN=${connector.auth_token} \\
  -e CONNECTOR_NAME="${connector.name}" \\
  -e SCAN_TARGETS=${targets} \\
  -e SCAN_PORTS=${ports} \\
  -e SCAN_INTERVAL=3600 \\
  certwatcher/agent:latest`
}

export function getDockerComposeContent(connector: ConnectorWithToken): string {
  const targets = connector.config?.scan_targets?.join(',') || 'localhost'
  const ports = connector.config?.scan_ports?.join(',') || '443'
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://***REMOVED***'
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'

  return `version: '3.8'

services:
  agent:
    image: certwatcher/agent:latest
    container_name: certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')}
    environment:
      SUPABASE_URL: ${supabaseUrl}
      SUPABASE_ANON_KEY: ${anonKey}
      CONNECTOR_TOKEN: ${connector.auth_token}
      CONNECTOR_NAME: "${connector.name}"
      SCAN_TARGETS: ${targets}
      SCAN_PORTS: ${ports}
      SCAN_INTERVAL: 3600
      LOG_LEVEL: INFO
    ports:
      - "8080:8080"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3`
}

export function getWindowsCommand(connector: ConnectorWithToken): string {
  const targets = connector.config?.scan_targets?.join(',') || 'localhost'
  const ports = connector.config?.scan_ports?.join(',') || '443'
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://***REMOVED***'
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'

  return `# Windows PowerShell
docker run -d \`
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \`
  --network host \`
  -e SUPABASE_URL=${supabaseUrl} \`
  -e SUPABASE_ANON_KEY=${anonKey} \`
  -e CONNECTOR_TOKEN=${connector.auth_token} \`
  -e CONNECTOR_NAME="${connector.name}" \`
  -e SCAN_TARGETS=${targets} \`
  -e SCAN_PORTS=${ports} \`
  certwatcher/agent:latest`
}

export function maskToken(token: string | null): string {
  if (!token) return '••••••••••••••••'
  if (token.length < 20) return token
  const start = token.substring(0, 12)
  const end = token.substring(token.length - 8)
  return `${start}...${end}`
}

export function getSetupCommand(connector: Connector, showToken: boolean = false): string {
  const targets = connector.config?.scan_targets?.join(',') || 'localhost'
  const ports = connector.config?.scan_ports?.join(',') || '443'
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://***REMOVED***'
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHdrendzeGtoY2V4aWJ1dndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg4MzM1NzAsImV4cCI6MjA0NDQwOTU3MH0.sEddNv_LaKJiSnN81KbTGDH3fF83TZ7rZ9sKqRvQOYc'
  const token = showToken ? (connector.auth_token || '<TOKEN_NICHT_VERFÜGBAR>') : maskToken(connector.auth_token)

  return `docker run -d \\
  --name certwatcher-agent-${connector.name.toLowerCase().replace(/\s+/g, '-')} \\
  --network host \\
  -e SUPABASE_URL=${supabaseUrl} \\
  -e SUPABASE_ANON_KEY=${anonKey} \\
  -e CONNECTOR_TOKEN=${token} \\
  -e CONNECTOR_NAME="${connector.name}" \\
  -e SCAN_TARGETS=${targets} \\
  -e SCAN_PORTS=${ports} \\
  -e SCAN_INTERVAL=3600 \\
  certwatcher/agent:latest`
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Aktiv</Badge>
    case 'inactive':
      return <Badge variant="neutral">Inaktiv</Badge>
    case 'error':
      return <Badge variant="error">Fehler</Badge>
    default:
      return <Badge variant="neutral">{status}</Badge>
  }
}

export function formatLastSeen(lastSeen: string | null) {
  if (!lastSeen) return 'Noch nie'
  const date = new Date(lastSeen)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 30) return 'Gerade eben'
  if (diffSec < 60) return `vor ${diffSec} Sek`
  if (diffMin < 60) return `vor ${diffMin} Min`
  if (diffHour < 24) return `vor ${diffHour} Std`
  if (diffDay < 7) return `vor ${diffDay} Tag${diffDay !== 1 ? 'en' : ''}`

  // Älter als 7 Tage → zeige Datum (lokale Zeit, deutsche Formatierung)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
