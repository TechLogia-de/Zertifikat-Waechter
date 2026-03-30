import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import { supabase } from '../lib/supabase'
import LoadingState from '../components/ui/LoadingState'
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal'
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

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        .eq('tenant_id', tenantId!)

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
        .eq('tenant_id', tenantId!)

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
      setSuccess(data.message || '✅ Cloudflare Token gültig!')
      setTimeout(() => setSuccess(null), 8000)
    } catch (err: any) {
      console.error('Cloudflare test error:', err)

      // Check if Edge Function is not deployed
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

  return (
    <div className="flex flex-col h-full">
      <ACMEPageHeader />

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto space-y-6">

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
