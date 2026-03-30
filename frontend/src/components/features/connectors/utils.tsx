import Badge from '../../ui/Badge'
import { Connector, ConnectorWithToken } from './types'
import { formatRelativeTime } from '../../../utils/dateUtils'

// Read Supabase config from env vars only; use placeholders if missing
function getSupabaseConfig(): { supabaseUrl: string; anonKey: string } {
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '<SUPABASE_URL>'
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '<SUPABASE_ANON_KEY>'
  return { supabaseUrl, anonKey }
}

export function getDockerCommand(connector: ConnectorWithToken): string {
  const targets = connector.config?.scan_targets?.join(',') || 'localhost'
  const ports = connector.config?.scan_ports?.join(',') || '443'
  const { supabaseUrl, anonKey } = getSupabaseConfig()

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
  const { supabaseUrl, anonKey } = getSupabaseConfig()

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
  const { supabaseUrl, anonKey } = getSupabaseConfig()

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
  const { supabaseUrl, anonKey } = getSupabaseConfig()
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

// Re-export formatRelativeTime as formatLastSeen for backward compatibility
export const formatLastSeen = formatRelativeTime
