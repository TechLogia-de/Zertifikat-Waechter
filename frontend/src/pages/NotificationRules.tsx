import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenantId } from '../hooks/useTenantId'
import LoadingState from '../components/ui/LoadingState'
import Modal from '../components/ui/Modal'
import PageInfoBox from '../components/ui/PageInfoBox'

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
  const { tenantId: currentTenantId } = useTenantId()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  const defaultFormData = {
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
  }

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
    if (currentTenantId) {
      fetchRules()
    }
  }, [currentTenantId])

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

  // Save a rule: insert if new, update if editing an existing one
  async function saveRule() {
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

      if (editingRuleId) {
        // Update existing rule
        const { error } = await supabase
          .from('notification_rules')
          .update({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
            priority: formData.priority,
            conditions,
            actions,
            throttle_minutes: formData.throttle_minutes,
          })
          .eq('id', editingRuleId)

        if (error) throw error
      } else {
        // Insert new rule
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
      }

      closeModal()
      fetchRules()
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern der Regel')
    }
  }

  // Open the modal pre-filled with rule data for editing
  function editRule(rule: NotificationRule) {
    const condition = rule.conditions?.and?.[0] || {}
    const action = rule.actions?.[0] || {}

    setEditingRuleId(rule.id)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      priority: rule.priority,
      condition_field: condition.field || 'days_until_expiry',
      condition_operator: condition.operator || '<=',
      condition_value: condition.value || '30',
      action_type: action.type || 'email',
      action_recipients: (action.recipients || []).join(', '),
      throttle_minutes: rule.throttle_minutes,
    })
    setShowCreateModal(true)
  }

  // Reset modal state
  function closeModal() {
    setShowCreateModal(false)
    setEditingRuleId(null)
    setFormData({ ...defaultFormData })
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

        <PageInfoBox title="Benachrichtigungsregeln konfigurieren" variant="info" collapsible defaultOpen={false}>
          <div className="space-y-3">
            <p className="text-[#1E3A5F]">
              Erstellen Sie individuelle Regeln, die automatisch Benachrichtigungen auslösen, wenn bestimmte Bedingungen erfüllt sind. Regeln werden in der Reihenfolge ihrer Priorität ausgewertet.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Bedingungen</h4>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li><strong>Ablauf-Tage:</strong> Benachrichtigung bei X Tagen bis zum Ablauf</li>
                  <li><strong>SSL Health Score:</strong> Warnung bei Score unter einem Schwellenwert</li>
                  <li><strong>Zertifikats-Typ:</strong> Regeln für bestimmte Issuer oder Key-Typen</li>
                  <li><strong>Tags/Labels:</strong> Filterung nach Asset-Kategorien</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#1E40AF] mb-1">Aktionen & Kanäle</h4>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li><strong>E-Mail:</strong> An einzelne Empfänger oder Verteilerlisten</li>
                  <li><strong>Slack/Teams:</strong> Nachrichten in konfigurierte Channels</li>
                  <li><strong>Webhooks:</strong> HTTP-Callbacks an externe Systeme</li>
                  <li><strong>Throttling:</strong> Verhindert Benachrichtigungs-Überflutung (einstellbar in Minuten)</li>
                </ul>
              </div>
            </div>
          </div>
        </PageInfoBox>

        {/* Rules List */}
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Noch keine Benachrichtigungsregeln</h3>
              <p className="text-gray-500 mb-2 max-w-md mx-auto">
                Erstelle Regeln, um automatisch benachrichtigt zu werden, wenn Zertifikate ablaufen oder Sicherheitsprobleme erkannt werden.
              </p>
              <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                Du kannst Bedingungen wie "Tage bis Ablauf", Schlüsselgröße oder Vertrauensstatus verwenden
                und Benachrichtigungen per E-Mail, Slack, Teams oder Webhook senden.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                + Erste Regel erstellen
              </button>
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
                      onClick={() => editRule(rule)}
                      aria-label={`Regel "${rule.name}" bearbeiten`}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                    >
                      ⚙️ Bearbeiten
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      aria-label={`Regel "${rule.name}" löschen`}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                    >
                      🗑️ Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <Modal onClose={closeModal}>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingRuleId ? 'Benachrichtigungsregel bearbeiten' : 'Neue Benachrichtigungsregel'}
              </h2>

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
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveRule}
                  disabled={!formData.name || !formData.action_recipients}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingRuleId ? 'Regel speichern' : 'Regel erstellen'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

