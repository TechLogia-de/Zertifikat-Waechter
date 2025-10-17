import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'

interface AddDomainModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  onSuccess: () => void
}

const commonPorts = [
  { value: 443, label: 'HTTPS (443)', icon: '🔒' },
  { value: 8443, label: 'HTTPS Alt (8443)', icon: '🔐' },
  { value: 636, label: 'LDAPS (636)', icon: '📁' },
  { value: 993, label: 'IMAPS (993)', icon: '📧' },
  { value: 995, label: 'POP3S (995)', icon: '📬' },
  { value: 465, label: 'SMTPS (465)', icon: '✉️' },
]

export default function AddDomainModal({ isOpen, onClose, tenantId, onSuccess }: AddDomainModalProps) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(443)
  const [customPort, setCustomPort] = useState('')
  const [useCustomPort, setUseCustomPort] = useState(false)
  const [protocol, setProtocol] = useState<'https' | 'tls' | 'ldaps' | 'smtp' | 'imap' | 'pop3'>('https')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Validierung
      if (!tenantId) {
        throw new Error('Tenant ID fehlt. Bitte lade die Seite neu.')
      }

      if (!host.trim()) {
        throw new Error('Bitte gib eine Domain/Host ein')
      }

      const finalPort = useCustomPort ? parseInt(customPort) : port
      
      if (isNaN(finalPort) || finalPort < 1 || finalPort > 65535) {
        throw new Error('Ungültiger Port (1-65535)')
      }

      console.log('Creating asset:', {
        tenant_id: tenantId,
        host: host.trim(),
        port: finalPort,
        proto: protocol
      })

      // Asset erstellen
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          tenant_id: tenantId,
          host: host.trim(),
          port: finalPort,
          proto: protocol,
          status: 'active',
          labels: {}
        })
        .select()

      if (assetError) {
        console.error('Asset creation error:', assetError)
        throw assetError
      }

      console.log('Asset created successfully:', assetData)

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1500)

    } catch (err: any) {
      setError(err.message || 'Fehler beim Hinzufügen')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setHost('')
    setPort(443)
    setCustomPort('')
    setUseCustomPort(false)
    setProtocol('https')
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="🌐 Domain hinzufügen">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {success && (
          <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Domain erfolgreich hinzugefügt!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg">
            ❌ {error}
          </div>
        )}

        {/* Host/Domain Input */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Domain / Hostname / IP
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com oder 192.168.1.100"
            className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition"
            required
          />
          <p className="mt-2 text-sm text-[#64748B]">
            💡 Beispiele: example.com, mail.example.com, 192.168.1.100
          </p>
        </div>

        {/* Protocol Selection */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Protokoll
          </label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as any)}
            className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition"
          >
            <option value="https">HTTPS (Standard)</option>
            <option value="tls">TLS (Generic)</option>
            <option value="ldaps">LDAPS</option>
            <option value="smtp">SMTPS</option>
            <option value="imap">IMAPS</option>
            <option value="pop3">POP3S</option>
          </select>
        </div>

        {/* Port Selection */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-3">
            Port
          </label>
          
          {!useCustomPort ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {commonPorts.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPort(p.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      port === p.value
                        ? 'border-[#3B82F6] bg-[#DBEAFE] shadow-md'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{p.icon}</span>
                      <div>
                        <p className="font-medium text-[#0F172A] text-sm">{p.label}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                type="button"
                onClick={() => setUseCustomPort(true)}
                className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
              >
                + Anderen Port verwenden
              </button>
            </>
          ) : (
            <div className="flex space-x-2">
              <input
                type="number"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value)}
                placeholder="Port (1-65535)"
                min="1"
                max="65535"
                className="flex-1 px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition"
              />
              <button
                type="button"
                onClick={() => {
                  setUseCustomPort(false)
                  setCustomPort('')
                }}
                className="px-4 py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] rounded-lg transition"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-[#64748B]">
              <p className="font-medium text-[#0F172A] mb-1">Was passiert als nächstes?</p>
              <p>Nach dem Hinzufügen wird die Domain für automatische Scans markiert. Der erste Scan kann einige Minuten dauern.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={loading || success}
            className="flex-1 bg-[#3B82F6] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {loading ? '⏳ Wird hinzugefügt...' : success ? '✅ Erfolgreich!' : '🚀 Domain hinzufügen'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-3 bg-[#F1F5F9] text-[#64748B] rounded-lg font-semibold hover:bg-[#E2E8F0] transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </Modal>
  )
}

