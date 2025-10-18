import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingState from '../components/ui/LoadingState'
import Modal from '../components/ui/Modal'

interface NotificationRule {
  id: string
  name: string
  description: string
  is_active: boolean
  priority: number
  conditions: any
  actions: any[]
  schedule: any
  throttle_minutes: number
  trigger_count: number
  last_triggered_at: string | null
  created_at: string
}

export default function NotificationRules() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    priority: 0,
    condition_field: 'days_until_expiry',
    condition_operator: '<=',
    condition_value: '30',
    action_type: 'email',
    action_recipients: '',
    throttle_minutes: 60,
  })

  useEffect(() => {
    if (user) {
      fetchCurrentTenant()
    }
  }, [user])

  useEffect(() => {
    if (currentTenantId) {
      fetchRules()
    }
  }, [currentTenantId])

  async function fetchCurrentTenant() {
    const { data } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user?.id)
      .limit(1)
      .single()

    if (data) {
      setCurrentTenantId(data.tenant_id)
    }
  }

  async function fetchRules() {
    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('priority', { ascending: false })

      if (error) throw error
      setRules(data || [])
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createRule() {
    try {
      const conditions = {
        and: [
          {
            field: formData.condition_field,
            operator: formData.condition_operator,
            value: formData.condition_value,
          }
        ]
      }

      const actions = [
        {
          type: formData.action_type,
          recipients: formData.action_recipients.split(',').map(r => r.trim()),
        }
      ]

      const { error } = await supabase
        .from('notification_rules')
        .insert({
          tenant_id: currentTenantId,
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          priority: formData.priority,
          conditions,
          actions,
          throttle_minutes: formData.throttle_minutes,
          created_by: user?.id,
        })

      if (error) throw error

      setShowCreateModal(false)
      setFormData({
        name: '',
        description: '',
        is_active: true,
        priority: 0,
        condition_field: 'days_until_expiry',
        condition_operator: '<=',
        condition_value: '30',
        action_type: 'email',
        action_recipients: '',
        throttle_minutes: 60,
      })
      fetchRules()
    } catch (error) {
      console.error('Fehler beim Erstellen:', error)
      alert('Fehler beim Erstellen der Regel')
    }
  }

  async function toggleRule(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('notification_rules')
        .update({ is_active: !currentState })
        .eq('id', id)

      if (error) throw error
      fetchRules()
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error)
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Regel wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('notification_rules')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchRules()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Benachrichtigungsregeln</h1>
            <p className="text-gray-600 mt-2">Flexible Regeln für automatische Benachrichtigungen</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Neue Regel
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl">💡</span>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Flexible Benachrichtigungen</h3>
              <p className="text-sm text-blue-800">
                Erstelle individuelle Regeln basierend auf Zertifikat-Eigenschaften, Tags, und mehr.
                Unterstützt werden E-Mail, Slack, Teams und Webhooks.
              </p>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
              Noch keine Benachrichtigungsregeln erstellt
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        rule.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rule.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      {rule.priority > 0 && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                          Priorität {rule.priority}
                        </span>
                      )}
                    </div>

                    {rule.description && (
                      <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                    )}

                    {/* Conditions */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <span className="text-gray-700 font-medium">Bedingung:</span>
                      <code className="px-2 py-1 bg-gray-100 rounded">
                        {JSON.stringify(rule.conditions)}
                      </code>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <span className="text-gray-700 font-medium">Aktionen:</span>
                      <div className="flex gap-2">
                        {rule.actions.map((action: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            {action.type}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                      <span>Ausgeführt: {rule.trigger_count}x</span>
                      {rule.last_triggered_at && (
                        <span>
                          Zuletzt: {new Date(rule.last_triggered_at).toLocaleDateString('de-DE')}
                        </span>
                      )}
                      {rule.throttle_minutes > 0 && (
                        <span>Throttle: {rule.throttle_minutes} min</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`px-3 py-1 rounded text-sm ${
                        rule.is_active
                          ? 'text-orange-600 hover:bg-orange-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {rule.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <Modal onClose={() => setShowCreateModal(false)}>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">Neue Benachrichtigungsregel</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. Warnung bei Ablauf in 30 Tagen"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Feld
                    </label>
                    <select
                      value={formData.condition_field}
                      onChange={(e) => setFormData({ ...formData, condition_field: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="days_until_expiry">Tage bis Ablauf</option>
                      <option value="key_size">Schlüsselgröße</option>
                      <option value="is_trusted">Vertrauenswürdig</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operator
                    </label>
                    <select
                      value={formData.condition_operator}
                      onChange={(e) => setFormData({ ...formData, condition_operator: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="<=">Kleiner gleich</option>
                      <option value=">=">Größer gleich</option>
                      <option value="=">Gleich</option>
                      <option value="!=">Ungleich</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wert
                    </label>
                    <input
                      type="text"
                      value={formData.condition_value}
                      onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aktion
                  </label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="email">E-Mail</option>
                    <option value="slack">Slack</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empfänger (kommagetrennt)
                  </label>
                  <input
                    type="text"
                    value={formData.action_recipients}
                    onChange={(e) => setFormData({ ...formData, action_recipients: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="admin@example.com, ops@example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priorität
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      max="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Throttle (Minuten)
                    </label>
                    <input
                      type="number"
                      value={formData.throttle_minutes}
                      onChange={(e) => setFormData({ ...formData, throttle_minutes: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Regel sofort aktivieren</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Abbrechen
                </button>
                <button
                  onClick={createRule}
                  disabled={!formData.name || !formData.action_recipients}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Regel erstellen
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

