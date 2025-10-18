import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingState from '../components/ui/LoadingState'
import SSLHealthButton from '../components/features/SSLHealthButton'
import Badge from '../components/ui/Badge'
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

export default function Assets() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchCurrentTenant()
    }
  }, [user])

  useEffect(() => {
    if (currentTenantId) {
      fetchAssets()
    }
  }, [currentTenantId])

  async function fetchCurrentTenant() {
    if (!user?.id) return

    const { data } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single() as any

    if (data) {
      setCurrentTenantId(data.tenant_id)
    }
  }

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

      // Hole letzte SSL Checks
      const assetsWithChecks = await Promise.all(
        ((data as any) || []).map(async (asset: any) => {
          const { data: checkData } = await supabase
            .rpc('get_latest_ssl_check', { p_asset_id: asset.id } as any)

          return {
            ...asset,
            latest_ssl_check: checkData && (checkData as any).length > 0 ? (checkData as any)[0] : null
          }
        })
      )

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

  if (loading) return <LoadingState />

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Assets & SSL Checks</h1>
          <p className="text-gray-600 mt-2">Übersicht aller überwachten Assets mit SSL/TLS Status</p>
        </div>

        {/* Assets List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Aktive Assets</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zertifikat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Läuft ab</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SSL Health</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Keine Assets gefunden. Füge Assets über "Domain scannen" hinzu.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const cert = asset.certificates && asset.certificates.length > 0 ? asset.certificates[0] : null
                    const daysLeft = cert ? getDaysUntilExpiry(cert.not_after) : null

                    return (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {asset.host}
                          </div>
                          <div className="text-sm text-gray-500">
                            Port {asset.port} • {asset.proto.toUpperCase()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {cert ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{cert.subject_cn}</div>
                              <div className="text-gray-500 text-xs">{cert.id.substring(0, 8)}...</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Kein Zertifikat</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {daysLeft !== null ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
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
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {asset.latest_ssl_check ? (
                            <div>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                asset.latest_ssl_check.overall_score >= 80 ? 'text-green-600 bg-green-100' :
                                asset.latest_ssl_check.overall_score >= 60 ? 'text-yellow-600 bg-yellow-100' :
                                'text-red-600 bg-red-100'
                              }`}>
                                {asset.latest_ssl_check.overall_score}/100
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(asset.latest_ssl_check.checked_at).toLocaleDateString('de-DE')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Noch nicht geprüft</span>
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
                            onSuccess={fetchAssets}
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
    </div>
  )
}

