// Cloudflare DNS-01 integration configuration form

import React from 'react'
import { CloudflareConfig } from './types'

interface CloudflareConfigSectionProps {
  config: CloudflareConfig
  configured: boolean
  saving: boolean
  testing: boolean
  onConfigChange: (config: CloudflareConfig) => void
  onSave: () => void
  onTest: () => void
}

export default function CloudflareConfigSection({
  config,
  configured,
  saving,
  testing,
  onConfigChange,
  onSave,
  onTest
}: CloudflareConfigSectionProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-[#E2E8F0] p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-lg">
            <span className="text-3xl">☁️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              Cloudflare DNS-01 Integration
              {configured && (
                <span className="text-xs bg-[#D1FAE5] text-[#065F46] px-2 py-1 rounded-full">
                  ✓ Konfiguriert
                </span>
              )}
            </h2>
            <p className="text-sm text-[#64748B]">Für Wildcard-Zertifikate (*.example.com)</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Cloudflare API Token *
          </label>
          <input
            type="password"
            value={config.api_token}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onConfigChange({ ...config, api_token: e.target.value })
            }
            placeholder="••••••••••••••••••••"
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
          />
          <p className="text-xs text-[#64748B] mt-2 flex items-start gap-1">
            <span>💡</span>
            <span>
              Erstelle einen API Token mit <code className="bg-[#F1F5F9] px-1 rounded font-mono">Zone:DNS:Edit</code> Berechtigung im{' '}
              <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener" className="text-[#3B82F6] hover:underline">
                Cloudflare Dashboard
              </a>
            </span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Zone ID (optional)
          </label>
          <input
            type="text"
            value={config.zone_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onConfigChange({ ...config, zone_id: e.target.value })
            }
            placeholder="abc123def456..."
            className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
          />
          <p className="text-xs text-[#64748B] mt-1">
            Beschleunigt DNS-Updates. Findest du im Cloudflare Dashboard → Domain → Overview (rechte Sidebar).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {saving ? '⏳ Speichere...' : '💾 Cloudflare Config speichern'}
          </button>
          <button
            onClick={onTest}
            disabled={testing || !config.api_token}
            className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {testing ? '⏳ Teste...' : '🧪 Verbindung testen'}
          </button>
        </div>
      </div>
    </div>
  )
}
