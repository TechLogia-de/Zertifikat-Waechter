import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { useAutoDismiss } from '../hooks/useAutoDismiss'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal'
import PageInfoBox from '../components/ui/PageInfoBox'
import ACMEWizard from './ACMEWizard'
import {
  ACMEPageHeader,
  AlertMessages,
  ACMEQuickStart,
  ACMEInfoBox,
  CloudflareConfigSection,
  ACMEAccountList,
  ACMEOrderTable,
  ACMEStatsGrid,
  CreateAccountModal,
  CreateOrderModal,
} from '../components/features/acme'
import type { ACMEAccount, ACMEOrder, CloudflareConfig } from '../components/features/acme'
import { getProviderInfo } from '../components/features/acme/types'

export default function ACME() {
  const { user } = useAuth()
  const { tenantId } = useTenantId()
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

  const { message: success, show: showSuccess, clear: clearSuccess } = useAutoDismiss()
  const { message: error, show: showError, clear: clearError } = useAutoDismiss()
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (tenantId) {
      loadData()
    }
  }, [tenantId])

  async function loadData() {
    if (!tenantId) return

    try {
      // Fire all independent queries in parallel
      const [
        { data: accountsData, error: accountsError },
        { data: ordersData, error: ordersError },
        { data: integration },
      ] = await Promise.all([
        supabase
          .from('acme_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('acme_orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('integrations')
          .select('config')
          .eq('tenant_id', tenantId)
          .eq('type', 'cloudflare')
          .maybeSingle(),
      ])

      if (accountsError) {
        console.error('Failed to load accounts:', accountsError)
      } else {
        setAccounts((accountsData as ACMEAccount[]) || [])
      }

      if (ordersError) {
        console.error('Failed to load orders:', ordersError)
      } else {
        setOrders((ordersData as ACMEOrder[]) || [])
      }

      const integrationData = integration as any
      if (integrationData?.config) {
        setCloudflareConfig(integrationData.config as CloudflareConfig)
        setCloudflareConfigured(true)
      }
    } catch (err) {
      console.error('Failed to load ACME data:', err)
      showError('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  async function createAccount() {
    if (!tenantId) {
      showError('❌ Kein Tenant gefunden! Bitte neu einloggen.')
      return
    }

    if (!newAccount.email) {
      showError('❌ Bitte E-Mail-Adresse eingeben!')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newAccount.email)) {
      showError('❌ Ungültige E-Mail-Adresse!')
      return
    }

    setSaving(true)
    clearError()
    clearSuccess()

    try {
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

      showSuccess(`✅ ACME Account erfolgreich erstellt!\n📧 ${newAccount.email}\n🔒 ${getProviderInfo(newAccount.provider).name}`, 5000)
      setShowAccountModal(false)
      setNewAccount({ provider: 'letsencrypt', email: user?.email || '' })
      await loadData()
    } catch (err: any) {
      console.error('Create account error:', err)
      showError(`❌ Fehler beim Erstellen:\n\n${err.message || 'Account konnte nicht erstellt werden'}\n\nPrüfe Console (F12) für Details.`, 10000)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount(accountId: string) {
    setSaving(true)
    clearError()

    try {
      const { error: deleteError } = await supabase
        .from('acme_accounts')
        .delete()
        .eq('id', accountId)
        .eq('tenant_id', tenantId!)

      if (deleteError) throw deleteError

      showSuccess('✅ Account gelöscht!', 3000)
      setDeleteAccountId(null)
      await loadData()
    } catch (err: any) {
      showError(`❌ Fehler beim Löschen: ${err.message}`, 5000)
    } finally {
      setSaving(false)
    }
  }

  async function createOrder() {
    if (!tenantId) {
      showError('❌ Kein Tenant gefunden!')
      return
    }

    if (!newOrder.acme_account_id || !newOrder.domain) {
      showError('❌ Bitte alle Felder ausfüllen!')
      return
    }

    // Domain validation
    const domainRegex = /^(\*\.)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i
    if (!domainRegex.test(newOrder.domain)) {
      showError('❌ Ungültige Domain! Format: example.com oder *.example.com')
      return
    }

    // Wildcard validation
    if (newOrder.domain.startsWith('*.') && newOrder.challenge_type === 'http-01') {
      showError('❌ Wildcard-Zertifikate benötigen DNS-01 Challenge!')
      return
    }

    // Cloudflare check for DNS-01
    if (newOrder.challenge_type === 'dns-01' && !cloudflareConfigured) {
      showError('❌ Bitte konfiguriere zuerst Cloudflare für DNS-01 Challenge!')
      return
    }

    setSaving(true)
    clearError()
    clearSuccess()

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

      showSuccess(`✅ Renewal Order erstellt!\n🌐 ${newOrder.domain}`, 5000)
      setShowOrderModal(false)
      setNewOrder({ acme_account_id: '', domain: '', challenge_type: 'dns-01' })
      await loadData()
    } catch (err: any) {
      showError(`❌ Fehler: ${err.message || 'Order konnte nicht erstellt werden'}`, 8000)
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrder(orderId: string) {
    setSaving(true)
    clearError()

    try {
      const { error: deleteError } = await supabase
        .from('acme_orders')
        .delete()
        .eq('id', orderId)
        .eq('tenant_id', tenantId!)

      if (deleteError) throw deleteError

      showSuccess('✅ Order gelöscht!', 3000)
      setDeleteOrderId(null)
      await loadData()
    } catch (err: any) {
      showError(`❌ Fehler beim Löschen: ${err.message}`, 5000)
    } finally {
      setSaving(false)
    }
  }

  async function saveCloudflareConfig() {
    if (!cloudflareConfig.api_token) {
      showError('❌ Bitte API Token eingeben!')
      return
    }

    // Token validation (basic check)
    if (cloudflareConfig.api_token.length < 20) {
      showError('❌ API Token zu kurz! Bitte prüfen.')
      return
    }

    setSaving(true)
    clearError()
    clearSuccess()

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

      showSuccess('✅ Cloudflare-Konfiguration gespeichert!\n\nDu kannst jetzt DNS-01 Challenge für Wildcard-Zertifikate nutzen.', 5000)
      setCloudflareConfigured(true)
    } catch (err: any) {
      showError(err.message || 'Fehler beim Speichern', 10000)
    } finally {
      setSaving(false)
    }
  }

  async function testCloudflareConnection() {
    if (!cloudflareConfig.api_token) {
      showError('❌ Bitte API Token eingeben!')
      return
    }

    setTesting(true)
    clearError()
    clearSuccess()

    try {
      // Test via Supabase Edge Function (bypasses CORS)
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
      showSuccess(data.message || '✅ Cloudflare Token gültig!', 8000)
    } catch (err: any) {
      console.error('Cloudflare test error:', err)

      // Check if Edge Function is not deployed
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        showError(`❌ Edge Function fehlt!\n\nDeploy zuerst die Function:\ncd supabase\nsupabase functions deploy test-cloudflare\n\nODER speichere einfach die Config ohne Test.`, 12000)
      } else {
        showError(`❌ Cloudflare Test fehlgeschlagen!\n\n${err.message}\n\n💡 Prüfe:\n- Token hat "Zone:DNS:Edit" Berechtigung\n- Token ist nicht abgelaufen\n- Zone ID ist korrekt (falls angegeben)`, 12000)
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ACMEPageHeader />

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto space-y-6">

          <PageInfoBox title="ACME-Protokoll und automatische Zertifikatserneuerung" variant="info" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-[#1E3A5F]">
                Das ACME-Protokoll (Automatic Certificate Management Environment) ermoeglicht die vollautomatische Ausstellung und Erneuerung von TLS/SSL-Zertifikaten. Unterstuetzt werden Let's Encrypt, ZeroSSL und Buypass als Zertifizierungsstellen.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Challenge-Typen</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>DNS-01: Verifizierung ueber DNS-TXT-Record (benoetigt Cloudflare-Integration)</li>
                    <li>HTTP-01: Verifizierung ueber HTTP-Datei auf dem Webserver</li>
                    <li>DNS-01 ist erforderlich fuer Wildcard-Zertifikate (*.domain.de)</li>
                    <li>HTTP-01 eignet sich fuer einzelne Domains ohne DNS-Zugriff</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E40AF] mb-1">Cloudflare-Integration</h4>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>API-Token mit "Zone:DNS:Edit"-Berechtigung erforderlich</li>
                    <li>Automatisches Setzen und Aufraumen von DNS-TXT-Records</li>
                    <li>Zone-ID optional: automatische Erkennung moeglich</li>
                    <li>Verbindungstest prueft Token-Gueltigkeit vor der Nutzung</li>
                  </ul>
                </div>
              </div>
            </div>
          </PageInfoBox>

          <AlertMessages success={success} error={error} />

          <ACMEQuickStart onStartWizard={() => setShowWizard(true)} />

          <ACMEInfoBox />

          {loading ? (
            <LoadingState size="lg" text="Lade ACME-Daten..." />
          ) : (
            <>
              <CloudflareConfigSection
                config={cloudflareConfig}
                configured={cloudflareConfigured}
                saving={saving}
                testing={testing}
                onConfigChange={setCloudflareConfig}
                onSave={saveCloudflareConfig}
                onTest={testCloudflareConnection}
              />

              <ACMEAccountList
                accounts={accounts}
                tenantId={tenantId || ''}
                onCreateAccount={() => {
                  setNewAccount({ provider: 'letsencrypt', email: user?.email || '' })
                  setShowAccountModal(true)
                }}
                onDeleteAccount={(id) => setDeleteAccountId(id)}
              />

              <ACMEOrderTable
                orders={orders}
                accountCount={accounts.length}
                onCreateOrder={() => setShowOrderModal(true)}
                onDeleteOrder={(id) => setDeleteOrderId(id)}
              />

              <ACMEStatsGrid
                accountCount={accounts.length}
                orders={orders}
              />
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateAccountModal
        isOpen={showAccountModal}
        saving={saving}
        provider={newAccount.provider}
        email={newAccount.email}
        onProviderChange={(provider) => setNewAccount({ ...newAccount, provider })}
        onEmailChange={(email) => setNewAccount({ ...newAccount, email })}
        onSubmit={createAccount}
        onClose={() => setShowAccountModal(false)}
      />

      <CreateOrderModal
        isOpen={showOrderModal}
        saving={saving}
        accounts={accounts}
        acmeAccountId={newOrder.acme_account_id}
        domain={newOrder.domain}
        challengeType={newOrder.challenge_type}
        cloudflareConfigured={cloudflareConfigured}
        onAccountIdChange={(id) => setNewOrder({ ...newOrder, acme_account_id: id })}
        onDomainChange={(domain) => setNewOrder({ ...newOrder, domain })}
        onChallengeTypeChange={(type) => setNewOrder({ ...newOrder, challenge_type: type })}
        onSubmit={createOrder}
        onClose={() => setShowOrderModal(false)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteAccountId}
        title="Account löschen?"
        message="Möchtest du diesen ACME Account wirklich löschen? Alle zugehörigen Orders werden ebenfalls gelöscht!"
        onConfirm={() => deleteAccountId && deleteAccount(deleteAccountId)}
        onClose={() => setDeleteAccountId(null)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteOrderId}
        title="Order löschen?"
        message="Möchtest du diese Renewal Order wirklich löschen?"
        onConfirm={() => deleteOrderId && deleteOrder(deleteOrderId)}
        onClose={() => setDeleteOrderId(null)}
      />

      {showWizard && (
        <ACMEWizard
          tenantId={tenantId || ''}
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
