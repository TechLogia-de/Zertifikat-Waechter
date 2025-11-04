import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import Modal from '../components/ui/Modal'
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal'
import ACMEWizard from './ACMEWizard'

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
  const [testing, setTesting] = useState(false)
  
  // Accounts
  const [accounts, setAccounts] = useState<ACMEAccount[]>([])
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [newAccount, setNewAccount] = useState({
    provider: 'letsencrypt' as 'letsencrypt' | 'zerossl' | 'buypass',
    email: ''
  })

  // Orders
  const [orders, setOrders] = useState<ACMEOrder[]>([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)
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
  const [cloudflareConfigured, setCloudflareConfigured] = useState(false)

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

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

      if (!membership) {
        setError('❌ Kein Tenant gefunden!')
        setLoading(false)
        return
      }

      const membershipData = membership as any
      setTenantId(membershipData.tenant_id)

      // Load ACME Accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('acme_accounts')
        .select('*')
        .eq('tenant_id', membershipData.tenant_id)
        .order('created_at', { ascending: false })

      if (accountsError) {
        console.error('Failed to load accounts:', accountsError)
      } else {
        setAccounts((accountsData as ACMEAccount[]) || [])
      }

      // Load ACME Orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('acme_orders')
        .select('*')
        .eq('tenant_id', membershipData.tenant_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (ordersError) {
        console.error('Failed to load orders:', ordersError)
      } else {
        setOrders((ordersData as ACMEOrder[]) || [])
      }

      // Load Cloudflare Config
      const { data: integration } = await supabase
        .from('integrations')
        .select('config')
        .eq('tenant_id', membershipData.tenant_id)
        .eq('type', 'cloudflare')
        .maybeSingle()

      const integrationData = integration as any
      if (integrationData?.config) {
        setCloudflareConfig(integrationData.config as CloudflareConfig)
        setCloudflareConfigured(true)
      }
    } catch (err) {
      console.error('Failed to load ACME data:', err)
      setError('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  async function createAccount() {
    if (!tenantId) {
      setError('❌ Kein Tenant gefunden! Bitte neu einloggen.')
      return
    }

    if (!newAccount.email) {
      setError('❌ Bitte E-Mail-Adresse eingeben!')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newAccount.email)) {
      setError('❌ Ungültige E-Mail-Adresse!')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('Creating ACME account...', {
        tenant_id: tenantId,
        provider: newAccount.provider,
        email: newAccount.email
      })

      const { data, error: insertError } = await supabase
        .from('acme_accounts')
        .insert({
          tenant_id: tenantId,
          provider: newAccount.provider,
          email: newAccount.email,
          status: 'active'
        } as any)
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        
        // Bessere Fehlermeldungen
        if (insertError.message?.includes('permission denied') || insertError.message?.includes('policy')) {
          throw new Error('Keine Berechtigung! Führe Migration 00010 aus:\n\ncd supabase\nsupabase db push\n\nODER im SQL Editor:\nsiehe ACME-RLS-FIX.sql')
        } else if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
          throw new Error('Account mit dieser E-Mail existiert bereits!')
        }
        throw new Error(insertError.message)
      }

      console.log('Account created successfully:', data)

      setSuccess(`✅ ACME Account erfolgreich erstellt!\n📧 ${newAccount.email}\n🔒 ${getProviderInfo(newAccount.provider).name}`)
      setShowAccountModal(false)
      setNewAccount({ provider: 'letsencrypt', email: user?.email || '' })
      await loadData()
      
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      console.error('Create account error:', err)
      setError(`❌ Fehler beim Erstellen:\n\n${err.message || 'Account konnte nicht erstellt werden'}\n\nPrüfe Console (F12) für Details.`)
      setTimeout(() => setError(null), 10000)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount(accountId: string) {
    setSaving(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('acme_accounts')
        .delete()
        .eq('id', accountId)
        .eq('tenant_id', tenantId)

      if (deleteError) throw deleteError

      setSuccess('✅ Account gelöscht!')
      setDeleteAccountId(null)
      await loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(`❌ Fehler beim Löschen: ${err.message}`)
      setTimeout(() => setError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function createOrder() {
    if (!tenantId) {
      setError('❌ Kein Tenant gefunden!')
      return
    }

    if (!newOrder.acme_account_id || !newOrder.domain) {
      setError('❌ Bitte alle Felder ausfüllen!')
      return
    }

    // Domain validation
    const domainRegex = /^(\*\.)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i
    if (!domainRegex.test(newOrder.domain)) {
      setError('❌ Ungültige Domain! Format: example.com oder *.example.com')
      return
    }

    // Wildcard validation
    if (newOrder.domain.startsWith('*.') && newOrder.challenge_type === 'http-01') {
      setError('❌ Wildcard-Zertifikate benötigen DNS-01 Challenge!')
      return
    }

    // Cloudflare check for DNS-01
    if (newOrder.challenge_type === 'dns-01' && !cloudflareConfigured) {
      setError('❌ Bitte konfiguriere zuerst Cloudflare für DNS-01 Challenge!')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: insertError } = await supabase
        .from('acme_orders')
        .insert({
          tenant_id: tenantId,
          acme_account_id: newOrder.acme_account_id,
          domain: newOrder.domain,
          challenge_type: newOrder.challenge_type,
          status: 'pending'
        } as any)

      if (insertError) throw insertError

      setSuccess(`✅ Renewal Order erstellt!\n🌐 ${newOrder.domain}`)
      setShowOrderModal(false)
      setNewOrder({ acme_account_id: '', domain: '', challenge_type: 'dns-01' })
      await loadData()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(`❌ Fehler: ${err.message || 'Order konnte nicht erstellt werden'}`)
      setTimeout(() => setError(null), 8000)
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrder(orderId: string) {
    setSaving(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('acme_orders')
        .delete()
        .eq('id', orderId)
        .eq('tenant_id', tenantId)

      if (deleteError) throw deleteError

      setSuccess('✅ Order gelöscht!')
      setDeleteOrderId(null)
      await loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(`❌ Fehler beim Löschen: ${err.message}`)
      setTimeout(() => setError(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function saveCloudflareConfig() {
    if (!cloudflareConfig.api_token) {
      setError('❌ Bitte API Token eingeben!')
      return
    }

    // Token validation (basic check)
    if (cloudflareConfig.api_token.length < 20) {
      setError('❌ API Token zu kurz! Bitte prüfen.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          tenant_id: tenantId,
          type: 'cloudflare',
          name: 'Cloudflare DNS',
          config: cloudflareConfig,
          enabled: true
        } as any, { onConflict: 'tenant_id,type,name' })

      if (upsertError) {
        // Bessere Fehlermeldung
        if (upsertError.message.includes('check constraint')) {
          throw new Error('❌ Migration fehlt! Führe die SQL-Migration aus (siehe FIX-CLOUDFLARE.md)')
        }
        throw upsertError
      }

      setSuccess('✅ Cloudflare-Konfiguration gespeichert!\n\nDu kannst jetzt DNS-01 Challenge für Wildcard-Zertifikate nutzen.')
      setCloudflareConfigured(true)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
      setTimeout(() => setError(null), 10000)
    } finally {
      setSaving(false)
    }
  }

  async function testCloudflareConnection() {
    if (!cloudflareConfig.api_token) {
      setError('❌ Bitte API Token eingeben!')
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      // Test über Supabase Edge Function (umgeht CORS)
      const { data, error: functionError } = await supabase.functions.invoke('test-cloudflare', {
        body: {
          api_token: cloudflareConfig.api_token,
          zone_id: cloudflareConfig.zone_id || null
        }
      })

      if (functionError) {
        console.error('Edge function error:', functionError)
        throw new Error(functionError.message || 'Edge Function Fehler')
      }

      if (!data.success) {
        throw new Error(data.error || 'Test fehlgeschlagen')
      }

      // Success!
      setSuccess(data.message || '✅ Cloudflare Token gültig!')
      setTimeout(() => setSuccess(null), 8000)
    } catch (err: any) {
      console.error('Cloudflare test error:', err)
      
      // Prüfe ob Edge Function nicht deployed ist
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setError(`❌ Edge Function fehlt!\n\nDeploy zuerst die Function:\ncd supabase\nsupabase functions deploy test-cloudflare\n\nODER speichere einfach die Config ohne Test.`)
      } else {
        setError(`❌ Cloudflare Test fehlgeschlagen!\n\n${err.message}\n\n💡 Prüfe:\n- Token hat "Zone:DNS:Edit" Berechtigung\n- Token ist nicht abgelaufen\n- Zone ID ist korrekt (falls angegeben)`)
      }
      setTimeout(() => setError(null), 12000)
    } finally {
      setTesting(false)
    }
  }

  function getProviderInfo(provider: string) {
    switch (provider) {
      case 'letsencrypt':
        return { name: "Let's Encrypt", icon: '🔒', color: '#16A34A', url: 'https://letsencrypt.org' }
      case 'zerossl':
        return { name: 'ZeroSSL', icon: '🛡️', color: '#2563EB', url: 'https://zerossl.com' }
      case 'buypass':
        return { name: 'Buypass', icon: '🔐', color: '#7C3AED', url: 'https://www.buypass.com' }
      default:
        return { name: provider, icon: '🔑', color: '#64748B', url: '#' }
    }
  }

  function getStatusBadge(status: string) {
    const badges = {
      active: { bg: '#D1FAE5', text: '#065F46', label: '✓ Aktiv' },
      pending: { bg: '#FEF3C7', text: '#92400E', label: '⏳ Ausstehend' },
      processing: { bg: '#DBEAFE', text: '#1E40AF', label: '⚙️ Verarbeitung' },
      valid: { bg: '#D1FAE5', text: '#065F46', label: '✅ Gültig' },
      invalid: { bg: '#FEE2E2', text: '#991B1B', label: '❌ Ungültig' },
      inactive: { bg: '#F1F5F9', text: '#475569', label: '⏸ Inaktiv' },
      revoked: { bg: '#FEE2E2', text: '#991B1B', label: '🚫 Widerrufen' }
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
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
            <span className="text-xl sm:text-2xl">🔄</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">ACME Auto-Renewal</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
          Let's Encrypt • ZeroSSL • DNS-01/HTTP-01 • Auto-Renewal • Cloudflare
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-[#D1FAE5] border-2 border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg animate-pulse">
              <div className="flex items-start">
                <span className="text-2xl mr-3">✅</span>
                <div>
                  <p className="font-bold text-lg mb-1">Erfolg!</p>
                  <p className="text-sm whitespace-pre-line">{success}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#FEE2E2] border-2 border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-start">
                <span className="text-2xl mr-3">❌</span>
                <div>
                  <p className="font-bold text-lg mb-1">Fehler!</p>
                  <p className="text-sm whitespace-pre-line">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Start für Anfänger */}
          <div className="bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl p-6 shadow-lg text-white">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-6xl">🎓</div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-2">
                  Neu hier? Starte mit dem geführten Setup!
                </h2>
                <p className="text-white/90 mb-4">
                  Wir führen dich Schritt für Schritt durch die Erstellung deines ersten SSL-Zertifikats. 
                  Perfekt für Anfänger - keine Vorkenntnisse nötig!
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-8 py-3 bg-white text-[#10B981] rounded-lg font-bold hover:bg-[#F0FDF4] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🚀 Geführtes Setup starten
                </button>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-xl p-6 border-2 border-[#3B82F6] shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="text-5xl animate-bounce">🔐</div>
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
                  <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
                    <div className="font-semibold text-[#1E40AF] mb-1">✅ DNS-01 Challenge</div>
                    <div className="text-[#475569]">
                      Für Wildcard-Zertifikate (*.example.com). Benötigt Cloudflare API.
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
                    <div className="font-semibold text-[#1E40AF] mb-1">✅ HTTP-01 Challenge</div>
                    <div className="text-[#475569]">
                      Für einzelne Domains. Server muss öffentlich erreichbar sein (Port 80).
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
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-lg">
                      <span className="text-3xl">☁️</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
                        Cloudflare DNS-01 Integration
                        {cloudflareConfigured && (
                          <span className="text-xs bg-[#D1FAE5] text-[#065F46] px-2 py-1 rounded-full">
                            ✓ Konfiguriert
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-[#64748B]">Für Wildcard-Zertifikate (*.example.com)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Cloudflare API Token *
                    </label>
                    <input
                      type="password"
                      value={cloudflareConfig.api_token}
                      onChange={(e) => setCloudflareConfig({ ...cloudflareConfig, api_token: e.target.value })}
                      placeholder="••••••••••••••••••••"
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                    <p className="text-xs text-[#64748B] mt-2 flex items-start gap-1">
                      <span>💡</span>
                      <span>
                        Erstelle einen API Token mit <code className="bg-[#F1F5F9] px-1 rounded font-mono">Zone:DNS:Edit</code> Berechtigung im{' '}
                        <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener" className="text-[#3B82F6] hover:underline">
                          Cloudflare Dashboard
                        </a>
                      </span>
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
                      className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                    />
                    <p className="text-xs text-[#64748B] mt-1">
                      Beschleunigt DNS-Updates. Findest du im Cloudflare Dashboard → Domain → Overview (rechte Sidebar).
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={saveCloudflareConfig}
                      disabled={saving}
                      className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                    >
                      {saving ? '⏳ Speichere...' : '💾 Cloudflare Config speichern'}
                    </button>
                    <button
                      onClick={testCloudflareConnection}
                      disabled={testing || !cloudflareConfig.api_token}
                      className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                    >
                      {testing ? '⏳ Teste...' : '🧪 Verbindung testen'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ACME Accounts */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-r from-[#D1FAE5] to-[#DCFCE7] rounded-lg">
                      <span className="text-3xl">🔑</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">ACME Accounts</h2>
                      <p className="text-sm text-[#64748B]">Verwalte deine Certificate Authority Accounts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setNewAccount({ provider: 'letsencrypt', email: user?.email || '' })
                      setShowAccountModal(true)
                    }}
                    disabled={!tenantId}
                    className="px-4 py-2 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                  >
                    ➕ Account erstellen
                  </button>
                </div>

                {!tenantId && (
                  <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg mb-4">
                    ⚠️ Kein Tenant gefunden! Bitte melde dich neu an.
                  </div>
                )}

                {accounts.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B]">
                    <div className="text-6xl mb-4">🔑</div>
                    <p className="font-semibold mb-2 text-lg">Noch keine ACME Accounts</p>
                    <p className="text-sm">Erstelle einen Account um loszulegen!</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {accounts.map(account => {
                      const provider = getProviderInfo(account.provider)
                      return (
                        <div
                          key={account.id}
                          className="border-2 border-[#E2E8F0] rounded-lg p-4 hover:shadow-lg hover:border-[#3B82F6] transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-3xl">{provider.icon}</span>
                              <div>
                                <div className="font-bold text-[#0F172A]">{provider.name}</div>
                                <div className="text-sm text-[#64748B]">{account.email}</div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(account.status)}
                              <button
                                onClick={() => setDeleteAccountId(account.id)}
                                className="text-xs text-[#EF4444] hover:bg-[#FEE2E2] px-2 py-1 rounded transition-colors"
                                title="Account löschen"
                              >
                                🗑️ Löschen
                              </button>
                            </div>
                          </div>
                          {account.account_url && (
                            <div className="text-xs text-[#64748B] font-mono bg-[#F8FAFC] p-2 rounded mt-2 truncate">
                              {account.account_url}
                            </div>
                          )}
                          <div className="text-xs text-[#94A3B8] mt-2">
                            Erstellt: {new Date(account.created_at).toLocaleString('de-DE')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ACME Orders */}
              <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-r from-[#E0E7FF] to-[#DDD6FE] rounded-lg">
                      <span className="text-3xl">📋</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0F172A]">Renewal Orders</h2>
                      <p className="text-sm text-[#64748B]">Automatische Zertifikats-Erneuerungen</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    disabled={accounts.length === 0}
                    className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                  >
                    ➕ Order erstellen
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B]">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="font-semibold mb-2 text-lg">Keine Renewal Orders</p>
                    <p className="text-sm">
                      {accounts.length === 0 
                        ? 'Erstelle zuerst einen ACME Account!' 
                        : 'Erstelle eine Order für automatische Renewals!'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#F8FAFC] border-b-2 border-[#E2E8F0]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Domain
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Challenge
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Erstellt
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Fehler
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                            Aktion
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {orders.map(order => (
                          <tr key={order.id} className="hover:bg-[#F8FAFC] transition-colors">
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
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setDeleteOrderId(order.id)}
                                className="text-xs text-[#EF4444] hover:bg-[#FEE2E2] px-2 py-1 rounded transition-colors"
                                title="Order löschen"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
                  <div className="text-sm text-[#64748B] mb-1 font-semibold">Accounts</div>
                  <div className="text-4xl font-bold text-[#3B82F6]">{accounts.length}</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
                  <div className="text-sm text-[#64748B] mb-1 font-semibold">Aktive Orders</div>
                  <div className="text-4xl font-bold text-[#10B981]">
                    {orders.filter(o => o.status === 'valid' || o.status === 'processing').length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
                  <div className="text-sm text-[#64748B] mb-1 font-semibold">Ausstehend</div>
                  <div className="text-4xl font-bold text-[#F59E0B]">
                    {orders.filter(o => o.status === 'pending').length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow">
                  <div className="text-sm text-[#64748B] mb-1 font-semibold">Fehler</div>
                  <div className="text-4xl font-bold text-[#EF4444]">
                    {orders.filter(o => o.status === 'invalid').length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Account Modal */}
      <Modal
        isOpen={showAccountModal}
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
                className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
              >
                <option value="letsencrypt">🔒 Let's Encrypt (Empfohlen - Kostenlos)</option>
                <option value="zerossl">🛡️ ZeroSSL (Alternative)</option>
                <option value="buypass">🔐 Buypass (180 Tage Laufzeit)</option>
              </select>
              <p className="text-xs text-[#64748B] mt-2">
                💡 Let's Encrypt ist der beliebteste kostenlose ACME-Provider mit 90-Tage-Zertifikaten
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                E-Mail-Adresse *
              </label>
              <input
                type="email"
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Für Ablauf-Benachrichtigungen der Certificate Authority
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowAccountModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-3 border-2 border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={createAccount}
                disabled={saving || !newAccount.email}
                className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-md"
              >
                {saving ? '⏳ Erstelle...' : '✓ Account erstellen'}
              </button>
            </div>
          </div>
        </Modal>

      {/* Create Order Modal */}
      <Modal
        isOpen={showOrderModal}
        title="📋 Renewal Order erstellen"
        onClose={() => setShowOrderModal(false)}
      >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                ACME Account *
              </label>
              <select
                value={newOrder.acme_account_id}
                onChange={(e) => setNewOrder({ ...newOrder, acme_account_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
              >
                <option value="">Account auswählen...</option>
                {accounts.filter(a => a.status === 'active').map(account => (
                  <option key={account.id} value={account.id}>
                    {getProviderInfo(account.provider).icon} {getProviderInfo(account.provider).name} - {account.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Domain *
              </label>
              <input
                type="text"
                value={newOrder.domain}
                onChange={(e) => setNewOrder({ ...newOrder, domain: e.target.value.toLowerCase() })}
                placeholder="example.com oder *.example.com"
                className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Für Wildcards verwende <code className="bg-[#F1F5F9] px-1 rounded">*.example.com</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Challenge-Typ *
              </label>
              <select
                value={newOrder.challenge_type}
                onChange={(e) => setNewOrder({ ...newOrder, challenge_type: e.target.value as any })}
                className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
              >
                <option value="dns-01">🌐 DNS-01 (für Wildcard-Zertifikate)</option>
                <option value="http-01">📡 HTTP-01 (für einzelne Domains)</option>
              </select>
              <div className="mt-2 p-3 bg-[#DBEAFE] rounded-lg text-xs text-[#1E40AF]">
                {newOrder.challenge_type === 'dns-01' ? (
                  <span>
                    💡 <strong>DNS-01:</strong> Benötigt Cloudflare API Token. Unterstützt Wildcards.
                    {!cloudflareConfigured && ' ⚠️ Bitte konfiguriere erst Cloudflare oben!'}
                  </span>
                ) : (
                  <span>
                    💡 <strong>HTTP-01:</strong> Server muss öffentlich auf Port 80 erreichbar sein. Keine Wildcards.
                  </span>
                )}
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowOrderModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-3 border-2 border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={createOrder}
                disabled={saving || !newOrder.acme_account_id || !newOrder.domain}
                className="flex-1 px-4 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-md"
              >
                {saving ? '⏳ Erstelle...' : '✓ Order erstellen'}
              </button>
            </div>
          </div>
        </Modal>

      {/* Delete Account Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteAccountId}
        title="Account löschen?"
        message="Möchtest du diesen ACME Account wirklich löschen? Alle zugehörigen Orders werden ebenfalls gelöscht!"
        onConfirm={() => deleteAccountId && deleteAccount(deleteAccountId)}
        onClose={() => setDeleteAccountId(null)}
      />

      {/* Delete Order Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteOrderId}
        title="Order löschen?"
        message="Möchtest du diese Renewal Order wirklich löschen?"
        onConfirm={() => deleteOrderId && deleteOrder(deleteOrderId)}
        onClose={() => setDeleteOrderId(null)}
      />

      {/* Wizard for Beginners */}
      {showWizard && (
        <ACMEWizard
          tenantId={tenantId}
          existingAccounts={accounts}
          onComplete={() => {
            setShowWizard(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}
