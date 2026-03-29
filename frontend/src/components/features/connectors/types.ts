export interface Connector {
  id: string
  tenant_id: string
  name: string
  type: string
  status: 'active' | 'inactive' | 'error'
  last_seen: string | null
  auth_token: string | null
  config?: {
    scan_targets?: string[]
    scan_ports?: number[]
    scanning?: boolean
    scan_progress?: {
      current: number
      total: number
      status: string
    }
    last_scan?: {
      total: number
      success: number
      failed: number
      timestamp: string
    }
  } | null
  created_at: string
}

export interface ConnectorWithToken extends Connector {
  auth_token: string
}
