import { memo } from 'react'
// Modal form for creating a new ACME account

import React from 'react'
import Modal from '../../ui/Modal'

interface CreateAccountModalProps {
  isOpen: boolean
  saving: boolean
  provider: 'letsencrypt' | 'zerossl' | 'buypass'
  email: string
  onProviderChange: (provider: 'letsencrypt' | 'zerossl' | 'buypass') => void
  onEmailChange: (email: string) => void
  onSubmit: () => void
  onClose: () => void
}

function CreateAccountModal({
  isOpen,
  saving,
  provider,
  email,
  onProviderChange,
  onEmailChange,
  onSubmit,
  onClose
}: CreateAccountModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="🔑 ACME Account erstellen"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onProviderChange(e.target.value as any)}
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
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEmailChange(e.target.value)}
            placeholder="admin@example.com"
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
          />
          <p className="text-xs text-[#64748B] mt-1">
            Für Ablauf-Benachrichtigungen der Certificate Authority
          </p>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 border-2 border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC] transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !email}
            className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? '⏳ Erstelle...' : '✓ Account erstellen'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default memo(CreateAccountModal)
