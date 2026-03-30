import { memo } from 'react'
// Modal form for creating a new ACME renewal order

import React from 'react'
import Modal from '../../ui/Modal'
import { ACMEAccount, getProviderInfo } from './types'

interface CreateOrderModalProps {
  isOpen: boolean
  saving: boolean
  accounts: ACMEAccount[]
  acmeAccountId: string
  domain: string
  challengeType: 'http-01' | 'dns-01'
  cloudflareConfigured: boolean
  onAccountIdChange: (id: string) => void
  onDomainChange: (domain: string) => void
  onChallengeTypeChange: (type: 'http-01' | 'dns-01') => void
  onSubmit: () => void
  onClose: () => void
}

function CreateOrderModal({
  isOpen,
  saving,
  accounts,
  acmeAccountId,
  domain,
  challengeType,
  cloudflareConfigured,
  onAccountIdChange,
  onDomainChange,
  onChallengeTypeChange,
  onSubmit,
  onClose
}: CreateOrderModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="📋 Renewal Order erstellen"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            ACME Account *
          </label>
          <select
            value={acmeAccountId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onAccountIdChange(e.target.value)}
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
          >
            <option value="">Account auswählen...</option>
            {accounts.filter(a => a.status === 'active').map(account => (
              <option key={account.id} value={account.id}>
                {getProviderInfo(account.provider).icon} {getProviderInfo(account.provider).name} - {account.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Domain *
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDomainChange(e.target.value.toLowerCase())}
            placeholder="example.com oder *.example.com"
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
          />
          <p className="text-xs text-[#64748B] mt-1">
            Für Wildcards verwende <code className="bg-[#F1F5F9] px-1 rounded">*.example.com</code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Challenge-Typ *
          </label>
          <select
            value={challengeType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChallengeTypeChange(e.target.value as any)}
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] transition-all"
          >
            <option value="dns-01">🌐 DNS-01 (für Wildcard-Zertifikate)</option>
            <option value="http-01">📡 HTTP-01 (für einzelne Domains)</option>
          </select>
          <div className="mt-2 p-3 bg-[#DBEAFE] rounded-lg text-xs text-[#1E40AF]">
            {challengeType === 'dns-01' ? (
              <span>
                💡 <strong>DNS-01:</strong> Benötigt Cloudflare API Token. Unterstützt Wildcards.
                {!cloudflareConfigured && ' ⚠️ Bitte konfiguriere erst Cloudflare oben!'}
              </span>
            ) : (
              <span>
                💡 <strong>HTTP-01:</strong> Server muss öffentlich auf Port 80 erreichbar sein. Keine Wildcards.
              </span>
            )}
          </div>
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
            disabled={saving || !acmeAccountId || !domain}
            className="flex-1 px-4 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? '⏳ Erstelle...' : '✓ Order erstellen'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default memo(CreateOrderModal)
