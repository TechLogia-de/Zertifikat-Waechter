// Application-level type aliases for the main database tables.
// These provide convenient interfaces that map to the Row types
// from database.types.ts, so components can use well-typed objects
// instead of `as any` casts.
//
// When the auto-generated database.types.ts is updated (via `make types`),
// review these interfaces to keep them in sync.

import type { Database, Json } from './database.types'

// ---- Row type helpers ----

type Tables = Database['public']['Tables']

export type TenantRow = Tables['tenants']['Row']
export type MembershipRow = Tables['memberships']['Row']
export type AssetRow = Tables['assets']['Row']
export type CertificateRow = Tables['certificates']['Row']
export type CheckRow = Tables['checks']['Row']
export type AlertRow = Tables['alerts']['Row']
export type PolicyRow = Tables['policies']['Row']
export type IntegrationRow = Tables['integrations']['Row']

// ---- Application interfaces ----

// Tenant / organization
export interface Tenant {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// User-to-tenant membership
export interface Membership {
  id: string
  user_id: string
  tenant_id: string
  role: string
  created_at: string
  updated_at: string
}

// Monitored host / endpoint
export interface Asset {
  id: string
  tenant_id: string
  connector_id: string | null
  host: string
  port: number
  proto: string
  labels: Json
  status: string
  created_at: string
  updated_at: string
  // Joined relation (optional, populated when queried with select)
  certificates?: Certificate[]
}

// TLS/SSL certificate
export interface Certificate {
  id: string
  tenant_id: string
  asset_id: string | null
  fingerprint: string
  subject_cn: string
  san: Json | null
  issuer: string | null
  not_before: string
  not_after: string
  key_alg: string | null
  key_size: number | null
  serial: string | null
  is_trusted: boolean
  is_self_signed: boolean
  created_at: string
  updated_at: string
  // Joined relation (optional)
  assets?: Pick<Asset, 'host' | 'port'>
}

// Expiration alert
export interface Alert {
  id: string
  certificate_id: string
  tenant_id: string
  level: 'info' | 'warning' | 'critical'
  message: string
  first_triggered_at: string
  last_notified_at: string | null
  acknowledged_by: string | null
  acknowledged_at: string | null
  created_at: string
  // Joined relation (optional)
  certificates?: Pick<Certificate, 'subject_cn' | 'not_after'> & {
    assets?: Pick<Asset, 'host' | 'port'>
  }
}

// Intranet scanner / agent connector
export interface Connector {
  id: string
  tenant_id: string
  name: string
  type: string
  status: 'active' | 'inactive' | 'error'
  last_seen: string | null
  auth_token: string | null
  config?: ConnectorConfig | null
  created_at: string
}

export interface ConnectorConfig {
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
}

// Notification integration (SMTP, Slack, Webhook, etc.)
export interface Integration {
  id: string
  tenant_id: string
  type: string
  name: string
  config: Json
  enabled: boolean
  created_at: string
  updated_at: string
}

// Audit log event
export interface Event {
  id: string
  tenant_id: string
  user_id: string | null
  type: string
  payload: Record<string, unknown>
  ts: string
  prev_hash: string
  hash: string
  created_at: string
}

// Notification policy
export interface Policy {
  id: string
  tenant_id: string
  warn_days: number[]
  channels: {
    email?: boolean
    webhook?: boolean
    slack?: boolean
    teams?: boolean
  }
  created_at: string
  updated_at: string
}

// Certificate health check result
export interface Check {
  id: string
  certificate_id: string
  ran_at: string
  status: string
  details: Json | null
  created_at: string
}

// ACME account (mirrors acme/types.ts for completeness)
export interface ACMEAccount {
  id: string
  tenant_id: string
  provider: 'letsencrypt' | 'zerossl' | 'buypass'
  email: string
  account_url: string | null
  status: 'active' | 'inactive' | 'revoked'
  created_at: string
}

// ACME renewal order
export interface ACMEOrder {
  id: string
  tenant_id: string
  acme_account_id: string
  domain: string
  challenge_type: 'http-01' | 'dns-01'
  status: 'pending' | 'processing' | 'valid' | 'invalid' | 'revoked'
  order_url: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}
