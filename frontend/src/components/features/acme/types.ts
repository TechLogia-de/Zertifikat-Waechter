// Shared types for ACME sub-components

export interface ACMEAccount {
  id: string
  tenant_id: string
  provider: 'letsencrypt' | 'zerossl' | 'buypass'
  email: string
  account_url: string | null
  status: 'active' | 'inactive' | 'revoked'
  created_at: string
}

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

export interface CloudflareConfig {
  api_token: string
  zone_id: string
}

// Provider info returned by getProviderInfo helper
export interface ProviderInfo {
  name: string
  icon: string
  color: string
  url: string
}

// Helper to get provider display information
export function getProviderInfo(provider: string): ProviderInfo {
  switch (provider) {
    case 'letsencrypt':
      return { name: "Let's Encrypt", icon: '\u{1F512}', color: '#16A34A', url: 'https://letsencrypt.org' }
    case 'zerossl':
      return { name: 'ZeroSSL', icon: '\u{1F6E1}\uFE0F', color: '#2563EB', url: 'https://zerossl.com' }
    case 'buypass':
      return { name: 'Buypass', icon: '\u{1F510}', color: '#7C3AED', url: 'https://www.buypass.com' }
    default:
      return { name: provider, icon: '\u{1F511}', color: '#64748B', url: '#' }
  }
}

// Helper to render a status badge
export function getStatusBadgeProps(status: string) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: '#D1FAE5', text: '#065F46', label: '\u2713 Aktiv' },
    pending: { bg: '#FEF3C7', text: '#92400E', label: '\u23F3 Ausstehend' },
    processing: { bg: '#DBEAFE', text: '#1E40AF', label: '\u2699\uFE0F Verarbeitung' },
    valid: { bg: '#D1FAE5', text: '#065F46', label: '\u2705 G\u00FCltig' },
    invalid: { bg: '#FEE2E2', text: '#991B1B', label: '\u274C Ung\u00FCltig' },
    inactive: { bg: '#F1F5F9', text: '#475569', label: '\u23F8 Inaktiv' },
    revoked: { bg: '#FEE2E2', text: '#991B1B', label: '\u{1F6AB} Widerrufen' }
  }

  return badges[status] || badges.pending
}
