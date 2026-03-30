import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import LoadingState from '../components/ui/LoadingState'
import SSLHealthButton from '../components/features/SSLHealthButton'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
// import type { Database } from '../types/database.types'

interface Asset {
  id: string
  host: string
  port: number
  proto: string
  status: string
  labels: any
  created_at: string
  certificates?: Array<{
    id: string
    subject_cn: string
    not_after: string
  }>
  latest_ssl_check?: {
    overall_score: number
    checked_at: string
  }
}

// Simple domain validation regex
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

export default function Assets() {
  const { user } = useAuth()
  const { tenantId: currentTenantId } = useTenantId()
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])

  // Bulk add state
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Bulk select/delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (currentTenantId) {
      fetchAssets()
    }
  }, [currentTenantId])

  // Subscribe to realtime changes on assets table to refresh after mutations
  useEffect(() => {
    if (!currentTenantId) return

    const channel = supabase
      .channel('assets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: `tenant_id=eq.${currentTenantId}`
        },
        () => {
          // Refetch assets when any change occurs (insert, update, delete)
          refreshAssets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentTenantId])

  // Batch-fetch latest SSL checks for a list of assets (avoids N+1 RPC calls)
  async function attachSSLChecks(assets: any[]): Promise<Asset[]> {
    if (!assets || assets.length === 0) return []

    const assetIds = assets.map((a: any) => a.id)
    const { data: checks } = await supabase
      .from('ssl_checks')
      .select('asset_id, overall_score, checked_at')
      .in('asset_id', assetIds)
      .order('checked_at', { ascending: false })

    // Build a map of asset_id → latest check (first occurrence since ordered desc)
    const latestByAsset = new Map<string, any>()
    for (const check of (checks || [])) {
      if (!latestByAsset.has(check.asset_id)) {
        latestByAsset.set(check.asset_id, check)
      }
    }

    return assets.map((asset: any) => ({
      ...asset,
      latest_ssl_check: latestByAsset.get(asset.id) || null
    }))
  }

  // Refresh without showing loading spinner (for background updates)
  const refreshAssets = useCallback(async () => {
    if (!currentTenantId) return

    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          certificates (
            id,
            subject_cn,
            not_after
          )
        `)
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const assetsWithChecks = await attachSSLChecks(data || [])
      setAssets(assetsWithChecks as any)
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error)
    }
  }, [currentTenantId])

  async function fetchAssets() {
    if (!currentTenantId) return

    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          certificates (
            id,
            subject_cn,
            not_after
          )
        `)
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Batch-fetch latest SSL checks (single query instead of N RPC calls)
      const assetsWithChecks = await attachSSLChecks(data || [])

      setAssets(assetsWithChecks as any)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  function getDaysUntilExpiry(notAfter: string): number {
    const expiry = new Date(notAfter)
    const now = new Date()
    const diff = expiry.getTime() - now.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  // Parse and validate domains from textarea, return valid domains and errors
  function parseDomains(text: string): { valid: string[]; errors: string[] } {
    const lines = text
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0)

    const valid: string[] = []
    const errors: string[] = []
    const seen = new Set<string>()

    for (const line of lines) {
      if (seen.has(line)) {
        errors.push(`Duplikat: ${line}`)
        continue
      }
      seen.add(line)

      if (DOMAIN_REGEX.test(line)) {
        valid.push(line)
      } else {
        errors.push(`Ungültige Domain: ${line}`)
      }
    }

    return { valid, errors }
  }

  // Batch insert multiple domains as assets
  async function handleBulkAdd() {
    if (!currentTenantId) return

    const { valid, errors } = parseDomains(bulkText)
    setBulkErrors(errors)

    if (valid.length === 0) {
      if (errors.length === 0) {
        setBulkErrors(['Bitte mindestens eine Domain eingeben.'])
      }
      return
    }

    setBulkLoading(true)
    try {
      const rows = valid.map((host) => ({
        tenant_id: currentTenantId,
        host,
        port: 443,
        proto: 'https',
        status: 'active',
      }))

      const { error } = await supabase.from('assets').insert(rows as any)
      if (error) throw error

      // Success - close modal and refresh
      setBulkAddOpen(false)
      setBulkText('')
      setBulkErrors([])
      await refreshAssets()
    } catch (error: any) {
      console.error('Fehler beim Hinzufügen:', error)
      setBulkErrors((prev) => [...prev, `Fehler: ${error.message || 'Unbekannter Fehler'}`])
    } finally {
      setBulkLoading(false)
    }
  }

  // Toggle selection of a single asset
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Toggle select all / deselect all
  function toggleSelectAll() {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)))
    }
  }

  // Bulk delete selected assets
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return

    const confirmed = window.confirm(
      `${selectedIds.size} Asset(s) wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
    )
    if (!confirmed) return

    setDeleteLoading(true)
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .in('id', Array.from(selectedIds))

      if (error) throw error

      setSelectedIds(new Set())
      await refreshAssets()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) return <LoadingState />

  const allSelected = assets.length > 0 && selectedIds.size === assets.length

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Assets & SSL Checks</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Übersicht aller überwachten Assets mit SSL/TLS Status</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleteLoading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                Ausgewählte löschen ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setBulkAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mehrere Domains hinzufügen
            </button>
          </div>
        </div>

        {/* Assets List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Aktive Assets</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Host</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zertifikat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Läuft ab</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SSL Health</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Keine Assets gefunden. Füge Assets über "Domain scannen" oder "Mehrere Domains hinzufügen" hinzu.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const cert = asset.certificates && asset.certificates.length > 0 ? asset.certificates[0] : null
                    const daysLeft = cert ? getDaysUntilExpiry(cert.not_after) : null

                    return (
                      <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.id)}
                            onChange={() => toggleSelect(asset.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`${asset.host} auswählen`}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {asset.host}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Port {asset.port} • {asset.proto.toUpperCase()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {cert ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{cert.subject_cn}</div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">{cert.id.substring(0, 8)}...</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Kein Zertifikat</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {daysLeft !== null ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {new Date(cert!.not_after).toLocaleDateString('de-DE')}
                              </div>
                              <Badge
                                variant={
                                  daysLeft < 0 ? 'error' :
                                  daysLeft < 7 ? 'error' :
                                  daysLeft < 30 ? 'warning' :
                                  'success'
                                }
                                size="sm"
                              >
                                {daysLeft < 0 ? 'Abgelaufen' : `${daysLeft} Tage`}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {asset.latest_ssl_check ? (
                            <div>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                asset.latest_ssl_check.overall_score >= 80 ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' :
                                asset.latest_ssl_check.overall_score >= 60 ? 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                                'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                              }`}>
                                {asset.latest_ssl_check.overall_score}/100
                              </span>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(asset.latest_ssl_check.checked_at).toLocaleDateString('de-DE')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Noch nicht geprüft</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={asset.status === 'active' ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {asset.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <SSLHealthButton
                            assetId={asset.id}
                            host={asset.host}
                            port={asset.port}
                            onSuccess={refreshAssets}
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={bulkAddOpen}
        onClose={() => {
          setBulkAddOpen(false)
          setBulkText('')
          setBulkErrors([])
        }}
        title="Mehrere Domains hinzufügen"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Geben Sie eine Domain pro Zeile ein. Jede Domain wird als neues Asset mit Port 443 (HTTPS) angelegt.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"beispiel.de\nwww.beispiel.de\napi.beispiel.de"}
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />

          {/* Validation errors */}
          {bulkErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Fehler:</p>
              <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-0.5">
                {bulkErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setBulkAddOpen(false)
                setBulkText('')
                setBulkErrors([])
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleBulkAdd}
              disabled={bulkLoading || bulkText.trim().length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {bulkLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Hinzufügen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
