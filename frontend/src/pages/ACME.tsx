import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import Modal from '../components/ui/Modal'

interface ACMEAccount {
  id: string
  tenant_id: string
  provider: 'letsencrypt' | 'zerossl' | 'buypass'
  email: string
  account_url: string | null
  status: 'active' | 'inactive' | 'revoked'
  created_at: string
}

interface ACMEOrder {
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

interface CloudflareConfig {
  api_token: string
  zone_id: string
}

export default function ACME() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Accounts
  const [accounts, setAccounts] = useState<ACMEAccount[]>([])
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [newAccount, setNewAccount] = useState({
    provider: 'letsencrypt' as 'letsencrypt' | 'zerossl' | 'buypass',
    email: ''
  })

  // Orders
  const [orders, setOrders] = useState<ACMEOrder[]>([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [newOrder, setNewOrder] = useState({
    acme_account_id: '',
    domain: '',
    challenge_type: 'dns-01' as 'http-01' | 'dns-01'
  })

  // Cloudflare
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>({
    api_token: '',
    zone_id: ''
  })

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        setTenantId(membership.tenant_id)

        // Load ACME Accounts
        const { data: accountsData } = await supabase
          .from('acme_accounts')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .order('created_at', { ascending: false })

        setAccounts((accountsData as ACMEAccount[]) || [])

        // Load ACME Orders
        const { data: ordersData } = await supabase
          .from('acme_orders')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .order('created_at', { ascending: false })
          .limit(50)

        setOrders((ordersData as ACMEOrder[]) || [])

        // Load Cloudflare Config
        const { data: integration } = await supabase
          .from('integrations')
          .select('config')
          .eq('tenant_id', membership.tenant_id)
          .eq('type', 'cloudflare')
          .maybeSingle()

        if (integration?.config) {
          setCloudflareConfig(integration.config as CloudflareConfig)
        }
      }
    } catch (err) {
      console.error('Failed to load ACME data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function createAccount() {
    if (!newAccount.email) {
      setError('Bitte E-Mail-Adresse eingeben')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('acme_accounts')
        .insert({
          tenant_id: tenantId,
          provider: newAccount.provider,
          email: newAccount.email,
          status: 'active'
        })

      if (insertError) throw insertError

      setSuccess('✅ ACME Account erfolgreich erstellt!')
      setShowAccountModal(false)
      setNewAccount({ provider: 'letsencrypt', email: '' })
      loadData()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  async function createOrder() {
    if (!newOrder.acme_account_id || !newOrder.domain) {
      setError('Bitte alle Felder ausfüllen')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('acme_orders')
        .insert({
          tenant_id: tenantId,
          acme_account_id: newOrder.acme_account_id,
          domain: newOrder.domain,
          challenge_type: newOrder.challenge_type,
          status: 'pending'
        })

      if (insertError) throw insertError

      setSuccess(`✅ Renewal-Order für ${newOrder.domain} erstellt!`)
      setShowOrderModal(false)
      setNewOrder({ acme_account_id: '', domain: '', challenge_type: 'dns-01' })
      loadData()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  async function saveCloudflareConfig() {
    setSaving(true)
    setError(null)

    try {
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          tenant_id: tenantId,
          type: 'cloudflare',
          name: 'Cloudflare DNS',
          config: cloudflareConfig,
          enabled: true
        }, { onConflict: 'tenant_id,type,name' })

      if (upsertError) throw upsertError

      setSuccess('✅ Cloudflare-Konfiguration gespeichert!')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  function getProviderInfo(provider: string) {
    switch (provider) {
      case 'letsencrypt':
        return { name: "Let's Encrypt", icon: '🔒', color: '#16A34A' }
      case 'zerossl':
        return { name: 'ZeroSSL', icon: '🛡️', color: '#2563EB' }
      case 'buypass':
        return { name: 'Buypass', icon: '🔐', color: '#7C3AED' }
      default:
        return { name: provider, icon: '🔑', color: '#64748B' }
    }
  }

  function getStatusBadge(status: string) {
    const badges = {
      active: { bg: '#D1FAE5', text: '#065F46', label: 'Aktiv' },
      pending: { bg: '#FEF3C7', text: '#92400E', label: 'Ausstehend' },
      processing: { bg: '#DBEAFE', text: '#1E40AF', label: 'Verarbeitung' },
      valid: { bg: '#D1FAE5', text: '#065F46', label: 'Gültig' },
      invalid: { bg: '#FEE2E2', text: '#991B1B', label: 'Ungültig' },
      inactive: { bg: '#F1F5F9', text: '#475569', label: 'Inaktiv' },
      revoked: { bg: '#FEE2E2', text: '#991B1B', label: 'Widerrufen' }
    }

    const badge = badges[status as keyof typeof badges] || badges.pending

    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: badge.bg, color: badge.text }}
      >
        {badge.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">🔄 ACME Auto-Renewal</h1>
        <p className="text-sm md:text-base text-[#64748B] mt-1">
          Let's Encrypt • ZeroSSL • Buypass • Automatische Zertifikats-Erneuerung • DNS-01 & HTTP-01 Challenge
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl">
              <div className="flex items-center">
                <span className="text-xl mr-3">✅</span>
                <p className="font-semibold">{success}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl">
              <div className="flex items-center">
                <span className="text-xl mr-3">❌</span>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-xl p-6 border border-[#3B82F6]">
            <div className="flex items-start space-x-4">
              <div className="text-4xl">🔐</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#1E40AF] mb-2">
                  Was ist ACME Auto-Renewal?
                </h2>
                <p className="text-[#1E3A8A] leading-relaxed mb-3">
                  ACME (Automated Certificate Management Environment) ermöglicht die automatische 
                  Ausstellung und Erneuerung von SSL/TLS-Zertifikaten von Let's Encrypt, ZeroSSL 
                  und anderen Certificate Authorities.
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/80 rounded-lg p-3">
                    <div className="font-semibold text-[#1E40AF] mb-1">✅ DNS-01 Challenge</div>
                    <div className="text-[#475569]">
                      Für Wildcard-Zertifikate (*.example.com). Benötigt Cloudflare API.
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3">
                    <div className="font-semibold text-[#1E40AF] mb-1">✅ HTTP-01 Challenge</div>
                    <div className="text-[#475569]">
                      Für einzelne Domains. Server muss öffentlich erreichbar sein.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState size="lg" text="Lade ACME-Daten..." />
          ) : (
            <>
              {/* Cloudflare Config */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-[#FEF3C7] rounded-lg">
                      <span className="text-2xl">☁️</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Cloudflare DNS-01 Integration</h2>
                      <p className="text-sm text-[#64748B]">Für Wildcard-Zertifikate (*.example.com)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Cloudflare API Token
                    </label>
                    <input
                      type="password"
                      value={cloudflareConfig.api_token}
                      onChange={(e) => setCloudflareConfig({ ...cloudflareConfig, api_token: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                    <p className="text-xs text-[#64748B] mt-1">
                      💡 Erstelle einen API Token mit <code className="bg-[#F1F5F9] px-1 rounded">Zone:DNS:Edit</code> Berechtigung
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Zone ID (optional)
                    </label>
                    <input
                      type="text"
                      value={cloudflareConfig.zone_id}
                      onChange={(e) => setCloudflareConfig({ ...cloudflareConfig, zone_id: e.target.value })}
                      placeholder="abc123def456..."
                      className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
                    />
                  </div>

                  <button
                    onClick={saveCloudflareConfig}
                    disabled={saving}
                    className="px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
                  >
                    {saving ? '⏳ Speichere...' : '💾 Cloudflare Config speichern'}
                  </button>
                </div>
              </div>

              {/* ACME Accounts */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-[#D1FAE5] rounded-lg">
                      <span className="text-2xl">🔑</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">ACME Accounts</h2>
                      <p className="text-sm text-[#64748B]">Verwalte deine Certificate Authority Accounts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="px-4 py-2 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] transition-colors"
                  >
                    ➕ Account erstellen
                  </button>
                </div>

                {accounts.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B]">
                    <div className="text-6xl mb-4">🔑</div>
                    <p className="font-semibold mb-2">Noch keine ACME Accounts</p>
                    <p className="text-sm">Erstelle einen Account um loszulegen!</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {accounts.map(account => {
                      const provider = getProviderInfo(account.provider)
                      return (
                        <div
                          key={account.id}
                          className="border border-[#E2E8F0] rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{provider.icon}</span>
                              <div>
                                <div className="font-bold text-[#0F172A]">{provider.name}</div>
                                <div className="text-sm text-[#64748B]">{account.email}</div>
                              </div>
                            </div>
                            {getStatusBadge(account.status)}
                          </div>
                          {account.account_url && (
                            <div className="text-xs text-[#64748B] font-mono bg-[#F8FAFC] p-2 rounded mt-2 truncate">
                              {account.account_url}
                            </div>
                          )}
                          <div className="text-xs text-[#94A3B8] mt-2">
                            Erstellt: {new Date(account.created_at).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ACME Orders */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-[#E0E7FF] rounded-lg">
                      <span className="text-2xl">📋</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Renewal Orders</h2>
                      <p className="text-sm text-[#64748B]">Automatische Zertifikats-Erneuerungen</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    disabled={accounts.length === 0}
                    className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ➕ Order erstellen
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B]">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="font-semibold mb-2">Keine Renewal Orders</p>
                    <p className="text-sm">
                      {accounts.length === 0 
                        ? 'Erstelle zuerst einen ACME Account!' 
                        : 'Erstelle eine Order für automatische Renewals!'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase">
                            Domain
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase">
                            Challenge
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase">
                            Erstellt
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase">
                            Fehler
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {orders.map(order => (
                          <tr key={order.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#0F172A]">{order.domain}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-[#F1F5F9] text-[#475569] rounded text-xs font-medium">
                                {order.challenge_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(order.status)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#64748B]">
                              {new Date(order.created_at).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-4 py-3">
                              {order.last_error ? (
                                <div className="text-xs text-[#EF4444] max-w-xs truncate" title={order.last_error}>
                                  {order.last_error}
                                </div>
                              ) : (
                                <span className="text-xs text-[#10B981]">✓ OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="text-sm text-[#64748B] mb-1">Accounts</div>
                  <div className="text-3xl font-bold text-[#3B82F6]">{accounts.length}</div>
                </div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="text-sm text-[#64748B] mb-1">Aktive Orders</div>
                  <div className="text-3xl font-bold text-[#10B981]">
                    {orders.filter(o => o.status === 'valid' || o.status === 'processing').length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="text-sm text-[#64748B] mb-1">Ausstehend</div>
                  <div className="text-3xl font-bold text-[#F59E0B]">
                    {orders.filter(o => o.status === 'pending').length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                  <div className="text-sm text-[#64748B] mb-1">Fehler</div>
                  <div className="text-3xl font-bold text-[#EF4444]">
                    {orders.filter(o => o.status === 'invalid').length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Account Modal */}
      {showAccountModal && (
        <Modal
          title="🔑 ACME Account erstellen"
          onClose={() => setShowAccountModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Provider
              </label>
              <select
                value={newAccount.provider}
                onChange={(e) => setNewAccount({ ...newAccount, provider: e.target.value as any })}
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="letsencrypt">Let's Encrypt (Empfohlen)</option>
                <option value="zerossl">ZeroSSL</option>
                <option value="buypass">Buypass</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Für Ablauf-Benachrichtigungen der Certificate Authority
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowAccountModal(false)}
                className="flex-1 px-4 py-3 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={createAccount}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors"
              >
                {saving ? '⏳ Erstelle...' : '✓ Account erstellen'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Order Modal */}
      {showOrderModal && (
        <Modal
          title="📋 Renewal Order erstellen"
          onClose={() => setShowOrderModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                ACME Account
              </label>
              <select
                value={newOrder.acme_account_id}
                onChange={(e) => setNewOrder({ ...newOrder, acme_account_id: e.target.value })}
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="">Account auswählen...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {getProviderInfo(account.provider).name} - {account.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Domain
              </label>
              <input
                type="text"
                value={newOrder.domain}
                onChange={(e) => setNewOrder({ ...newOrder, domain: e.target.value })}
                placeholder="example.com oder *.example.com"
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Challenge-Typ
              </label>
              <select
                value={newOrder.challenge_type}
                onChange={(e) => setNewOrder({ ...newOrder, challenge_type: e.target.value as any })}
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6]"
              >
                <option value="dns-01">DNS-01 (für Wildcard-Zertifikate)</option>
                <option value="http-01">HTTP-01 (für einzelne Domains)</option>
              </select>
              <p className="text-xs text-[#64748B] mt-1">
                {newOrder.challenge_type === 'dns-01' 
                  ? '💡 Benötigt Cloudflare API Token' 
                  : '💡 Server muss öffentlich auf Port 80 erreichbar sein'}
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowOrderModal(false)}
                className="flex-1 px-4 py-3 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={createOrder}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
              >
                {saving ? '⏳ Erstelle...' : '✓ Order erstellen'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

