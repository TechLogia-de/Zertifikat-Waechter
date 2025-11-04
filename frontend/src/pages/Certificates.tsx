import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useScanDomain } from '../hooks/useScanDomain'
import AddDomainModal from '../components/features/AddDomainModal'
import CertificateDetailsModal from '../components/features/CertificateDetailsModal'
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal'
import LoadingState from '../components/ui/LoadingState'
import Assets from './Assets'

interface Asset {
  id: string
  host: string
  port: number
  proto: string
  status: string
  created_at: string
  certificates?: any[]
}

export default function Certificates() {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const { scanDomain, scanning } = useScanDomain()
  const [scanningAssetId, setScanningAssetId] = useState<string | null>(null)
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'certificates' | 'assets'>('certificates')

  useEffect(() => {
    loadAssets()
  }, [user])

  async function loadAssets() {
    if (!user) return

    try {
      // Get user's tenant
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (membershipError) {
        console.error('Failed to load membership:', membershipError)
        throw membershipError
      }

      if (membership) {
        setTenantId(membership.tenant_id)

        // Get assets with certificates
        const { data: assetsData, error } = await supabase
          .from('assets')
          .select(`
            *,
            certificates(
              id, 
              subject_cn, 
              not_after, 
              not_before,
              fingerprint, 
              issuer, 
              san, 
              key_alg, 
              key_size, 
              serial,
              is_trusted,
              is_self_signed
            )
          `)
          .eq('tenant_id', membership.tenant_id)
          .order('created_at', { ascending: false })

        if (error) throw error

        setAssets(assetsData || [])
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
    } finally {
      setLoading(false)
    }
  }

  async function exportData(format: 'csv' | 'json' | 'html') {
    if (!tenantId) return

    setExporting(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          tenant_id: tenantId,
          format: format,
          filters: {}
        }
      })

      if (error) throw error

      // Download the file
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/html'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `certificates-${new Date().toISOString().split('T')[0]}.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Export failed:', err)
      alert('Export fehlgeschlagen: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      active: 'bg-[#D1FAE5] text-[#065F46]',
      inactive: 'bg-[#F1F5F9] text-[#475569]',
      error: 'bg-[#FEE2E2] text-[#991B1B]',
    }
    return styles[status as keyof typeof styles] || styles.inactive
  }

  function getProtocolIcon(proto: string) {
    const icons: Record<string, string> = {
      https: '🔒',
      tls: '🔐',
      ldaps: '📁',
      smtp: '✉️',
      imap: '📧',
      pop3: '📬',
    }
    return icons[proto] || '🌐'
  }

  async function handleScanAsset(asset: Asset) {
    setScanningAssetId(asset.id)
    try {
      await scanDomain(asset.id, asset.host, asset.port)
      // Reload assets to show new certificate
      await loadAssets()
    } catch (error) {
      console.error('Scan failed:', error)
    } finally {
      setScanningAssetId(null)
    }
  }

  async function handleDeleteAsset() {
    if (!assetToDelete) return
    
    setDeleting(true)
    try {
      // Zuerst zugehörige Zertifikate löschen (CASCADE sollte das automatisch machen, aber sicher ist sicher)
      const { error: certsError } = await supabase
        .from('certificates')
        .delete()
        .eq('asset_id', assetToDelete.id)
      
      if (certsError) {
        console.error('Error deleting certificates:', certsError)
      }

      // Asset löschen
      const { error: assetError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetToDelete.id)
      
      if (assetError) throw assetError

      // Erfolg: UI aktualisieren
      setAssets(assets.filter(a => a.id !== assetToDelete.id))
      setDeleteModalOpen(false)
      setAssetToDelete(null)
    } catch (error: any) {
      console.error('Failed to delete asset:', error)
      alert('Fehler beim Löschen: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  function confirmDeleteAsset(asset: Asset) {
    setAssetToDelete(asset)
    setDeleteModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header - FIXIERT */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                <span className="text-xl sm:text-2xl">🔒</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Domains & Zertifikate</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 ml-0.5">
              SSL/TLS-Monitoring • Auto-Scans • x509-Metadaten
            </p>

            {/* Tabs */}
            <div className="flex gap-2 mt-2 ml-0.5">
              <button
                onClick={() => setActiveTab('certificates')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                  activeTab === 'certificates'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                🔒 Zertifikate
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                  activeTab === 'assets'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                🖥️ Assets & SSL Status
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
            {/* Export Dropdown */}
            <div className="relative group">
              <button
                type="button"
                disabled={exporting || assets.length === 0}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg font-medium text-sm hover:bg-slate-700 hover:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span className="text-xs">{exporting ? 'Exportiere...' : 'Export'}</span>
              </button>
              {!exporting && assets.length > 0 && (
                <div className="hidden group-hover:block absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-10 overflow-hidden">
                  <button
                    onClick={() => exportData('csv')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors flex items-center space-x-2"
                  >
                    <span>📊</span>
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={() => exportData('json')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors flex items-center space-x-2"
                  >
                    <span>📋</span>
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => exportData('html')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors flex items-center space-x-2"
                  >
                    <span>📄</span>
                    <span>HTML</span>
                  </button>
                </div>
              )}
            </div>

            {/* Add Domain Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setShowAddModal(true)
              }}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Domain hinzufügen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - SCROLLBAR */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'assets' ? (
          <Assets />
        ) : loading ? (
          <div className="py-12">
            <LoadingState size="md" text="Lade Domains..." />
          </div>
        ) : assets.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-[#F1F5F9] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] mb-2">Noch keine Domains</h3>
              <p className="text-[#64748B] mb-6">
                Füge deine erste Domain hinzu, um mit der Überwachung zu beginnen
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setShowAddModal(true)
                }}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors shadow-md cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Erste Domain hinzufügen</span>
              </button>
            </div>
          </div>
        ) : (
          /* Assets Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
              >
                {/* Asset Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">{getProtocolIcon(asset.proto)}</div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-lg break-all">
                        {asset.host}
                      </h3>
                      <p className="text-sm text-[#64748B]">
                        Port {asset.port} • {asset.proto.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${getStatusBadge(asset.status)}`}>
                    {asset.status === 'active' ? '✓ Aktiv' : asset.status}
                  </span>
                </div>

                {/* Certificate Info */}
                <div className="border-t border-[#F1F5F9] pt-4 mt-4">
                  {asset.certificates && asset.certificates.length > 0 ? (
                    (() => {
                      const cert = asset.certificates[0]
                      const now = new Date()
                      const expiryDate = new Date(cert.not_after)
                      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      const totalDays = 90 // Annahme: 90 Tage Gültigkeit
                      const percentRemaining = Math.max(0, Math.min(100, (daysUntilExpiry / totalDays) * 100))
                      
                      let statusColor = '#10B981' // Grün
                      let statusText = 'Gültig'
                      if (daysUntilExpiry < 0) {
                        statusColor = '#EF4444' // Rot
                        statusText = 'Abgelaufen'
                      } else if (daysUntilExpiry < 7) {
                        statusColor = '#EF4444' // Rot
                        statusText = 'Kritisch'
                      } else if (daysUntilExpiry < 30) {
                        statusColor = '#F59E0B' // Orange
                        statusText = 'Warnung'
                      }

                      return (
                        <div className="space-y-3">
                          {/* Zertifikat Name */}
                          <div className="bg-[#F8FAFC] rounded-lg p-3">
                            <p className="text-xs text-[#64748B] mb-1">Zertifikat</p>
                            <p className="text-sm font-semibold text-[#0F172A] break-all">
                              {cert.subject_cn}
                            </p>
                          </div>

                          {/* Aussteller */}
                          <div className="flex items-start justify-between py-2">
                            <span className="text-sm text-[#64748B]">Aussteller:</span>
                            <span className="text-sm font-medium text-[#0F172A] text-right max-w-[60%] break-words">
                              {cert.issuer || 'Unbekannt'}
                            </span>
                          </div>

                          {/* Gültigkeit */}
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-[#64748B]">Gültig bis:</span>
                            <span className="text-sm font-semibold text-[#0F172A]">
                              {expiryDate.toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit', 
                                year: 'numeric'
                              })}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div 
                            className="rounded-lg p-3 text-center"
                            style={{ backgroundColor: statusColor + '20' }}
                          >
                            <p className="text-xs font-medium mb-1" style={{ color: statusColor }}>
                              {statusText}
                            </p>
                            <p className="text-lg font-bold" style={{ color: statusColor }}>
                              {daysUntilExpiry > 0 ? `${daysUntilExpiry} Tage` : 'Abgelaufen'}
                            </p>
                            <p className="text-xs text-[#64748B] mt-1">
                              {daysUntilExpiry > 0 ? 'verbleibend' : 'seit Ablauf'}
                            </p>
                          </div>

                          {/* Progress Bar */}
                          <div className="pt-2">
                            <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner">
                              <div 
                                className="h-full rounded-full transition-all duration-500 shadow-sm" 
                                style={{ 
                                  width: `${percentRemaining}%`,
                                  backgroundColor: statusColor
                                }} 
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="text-sm text-[#94A3B8] mb-2 font-medium">Noch nicht gescannt</p>
                      <p className="text-xs text-[#CBD5E1]">
                        Klicke unten auf "🔍 Jetzt scannen"
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-2 mt-4">
                  {asset.certificates && asset.certificates.length > 0 ? (
                    <button 
                      onClick={() => {
                        setSelectedCertificate(asset.certificates![0])
                        setSelectedAsset(asset)
                      }}
                      className="flex-1 px-3 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      📋 Details anzeigen
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleScanAsset(asset)}
                      disabled={scanningAssetId === asset.id}
                      className="flex-1 px-3 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {scanningAssetId === asset.id ? '⏳ Scanne...' : '🔍 Jetzt scannen'}
                    </button>
                  )}
                  
                  {/* Refresh Button - nur wenn Zertifikat bereits vorhanden */}
                  {asset.certificates && asset.certificates.length > 0 && (
                    <button 
                      onClick={() => handleScanAsset(asset)}
                      disabled={scanningAssetId === asset.id}
                      className="px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] rounded-lg transition-colors disabled:opacity-50"
                      title="Neu scannen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                  <button 
                    onClick={() => confirmDeleteAsset(asset)}
                    className="px-3 py-2 bg-[#FEE2E2] hover:bg-[#FEE2E2] text-[#EF4444] rounded-lg transition-colors"
                    title="Domain löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Domain Modal */}
      <AddDomainModal
        isOpen={showAddModal && !!tenantId}
        onClose={() => setShowAddModal(false)}
        tenantId={tenantId || ''}
        onSuccess={() => {
          loadAssets()
          setShowAddModal(false)
        }}
      />

      {/* Certificate Details Modal */}
      {selectedCertificate && selectedAsset && (
        <CertificateDetailsModal
          isOpen={!!selectedCertificate}
          onClose={() => {
            setSelectedCertificate(null)
            setSelectedAsset(null)
          }}
          certificate={selectedCertificate}
          host={selectedAsset.host}
          port={selectedAsset.port}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setAssetToDelete(null)
        }}
        onConfirm={handleDeleteAsset}
        title="Domain löschen?"
        message="Möchtest du diese Domain wirklich löschen? Alle zugehörigen Zertifikate und Daten werden ebenfalls gelöscht."
        itemName={assetToDelete ? `${assetToDelete.host}:${assetToDelete.port}` : ''}
        loading={deleting}
      />
    </div>
  )
}


