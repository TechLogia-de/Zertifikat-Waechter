import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingState from '../components/ui/LoadingState'
import Modal from '../components/ui/Modal'
import APIDocumentation from '../components/features/APIDocumentation'
// import type { Database } from '../types/database.types'

interface APIKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  usage_count: number
  expires_at: string | null
  created_at: string
  description: string | null
}

export default function APIKeys() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newGeneratedKey, setNewGeneratedKey] = useState('')
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: ['read'] as string[],
    scopes: ['certificates:read'] as string[],
    expires_days: 90,
  })

  useEffect(() => {
    if (user) {
      fetchCurrentTenant()
    }
  }, [user])

  useEffect(() => {
    if (currentTenantId) {
      fetchAPIKeys()
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

  async function fetchAPIKeys() {
    if (!currentTenantId) return

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApiKeys((data as any) || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createAPIKey() {
    try {
      console.log('Creating API Key...', formData)
      
      const randomKey = generateAPIKey()
      const keyHash = await hashKey(randomKey)
      const keyPrefix = randomKey.substring(0, 8)

      const expiresAt = formData.expires_days > 0
        ? new Date(Date.now() + formData.expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: currentTenantId!,
          name: formData.name,
          description: formData.description,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          permissions: formData.permissions as any,
          scopes: formData.scopes as any,
          expires_at: expiresAt,
          created_by: user?.id,
        } as any)

      if (error) throw error

      setNewGeneratedKey(randomKey)
      setShowCreateModal(false)
      setShowKeyModal(true)

      setFormData({
        name: '',
        description: '',
        permissions: ['read'],
        scopes: ['certificates:read'],
        expires_days: 90,
      })

      fetchAPIKeys()
    } catch (error: any) {
      console.error('Fehler beim Erstellen:', error)
      alert(`Fehler: ${error.message}`)
    }
  }

  async function revokeAPIKey(id: string) {
    if (!confirm('API Key wirklich widerrufen?')) return

    try {
      const { error } = await (supabase as any)
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      fetchAPIKeys()
    } catch (error) {
      console.error('Fehler:', error)
    }
  }

  async function deleteAPIKey(id: string) {
    if (!confirm('API Key endgültig löschen?')) return

    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchAPIKeys()
    } catch (error) {
      console.error('Fehler:', error)
    }
  }

  function generateAPIKey(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return 'cw_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    alert('In Zwischenablage kopiert!')
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Keys & Dokumentation</h1>
            <p className="text-gray-600 mt-2">Verwalte API-Zugänge und entdecke unsere RESTful API</p>
            
            {/* Tabs */}
            <div className="flex gap-4 mt-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('keys')}
                className={`pb-2 px-1 font-medium text-sm transition-colors ${
                  activeTab === 'keys'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🔑 API Keys
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`pb-2 px-1 font-medium text-sm transition-colors ${
                  activeTab === 'docs'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📚 API Dokumentation
              </button>
            </div>
          </div>
          {activeTab === 'keys' && (
            <button
              onClick={() => {
                console.log('Opening modal, current state:', showCreateModal)
                setShowCreateModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              + Neuer API Key
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'docs' ? (
          <APIDocumentation />
        ) : (
          <>
            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 text-xl">ℹ</span>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Wichtig zu wissen</h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>API Keys werden nur EINMAL angezeigt - sichere Speicherung erforderlich!</li>
                    <li>Verwende unterschiedliche Keys für verschiedene Anwendungen</li>
                    <li>Widerrufe Keys sofort, wenn sie kompromittiert wurden</li>
                    <li>Setze immer ein Ablaufdatum für erhöhte Sicherheit</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* API Keys Table */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nutzung</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Läuft ab</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Noch keine API Keys erstellt
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((key) => (
                        <tr key={key.id} className={!key.is_active ? 'opacity-50' : ''}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{key.name}</div>
                            {key.description && (
                              <div className="text-sm text-gray-500">{key.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {key.key_prefix}...
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {key.permissions.map((perm, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {key.is_active ? (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                Aktiv
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                                Widerrufen
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>{key.usage_count} Aufrufe</div>
                            {key.last_used_at && (
                              <div className="text-xs text-gray-500">
                                Zuletzt: {new Date(key.last_used_at).toLocaleDateString('de-DE')}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {key.expires_at ? (
                              <span className={
                                new Date(key.expires_at) < new Date() 
                                  ? 'text-red-600' 
                                  : 'text-gray-900'
                              }>
                                {new Date(key.expires_at).toLocaleDateString('de-DE')}
                              </span>
                            ) : (
                              <span className="text-gray-500">Nie</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {key.is_active && (
                                <button
                                  onClick={() => revokeAPIKey(key.id)}
                                  className="text-sm text-orange-600 hover:text-orange-700"
                                >
                                  Widerrufen
                                </button>
                              )}
                              <button
                                onClick={() => deleteAPIKey(key.id)}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                Löschen
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals außerhalb des Tab-Contents */}
      <Modal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neuer API Key"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name * <span className="text-red-600">(Pflichtfeld)</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. Monitoring System"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="space-y-2">
              {['read', 'write', 'delete'].map((perm) => (
                <label key={perm} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, permissions: [...formData.permissions, perm] })
                      } else {
                        setFormData({ ...formData, permissions: formData.permissions.filter((p) => p !== perm) })
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm capitalize">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ablauf in Tagen (0 = nie)
            </label>
            <input
              type="number"
              value={formData.expires_days}
              onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              max="365"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Abbrechen
            </button>
            <button
              onClick={createAPIKey}
              disabled={!formData.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              API Key erstellen
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showKeyModal}
        onClose={() => {
          setShowKeyModal(false)
          setNewGeneratedKey('')
        }}
        title="API Key erstellt!"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-sm text-yellow-800 font-semibold">
              ⚠ WICHTIG: Dieser Key wird nur EINMAL angezeigt!
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dein API Key:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGeneratedKey}
                readOnly
                className="flex-1 px-4 py-3 border rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(newGeneratedKey)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kopieren
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

