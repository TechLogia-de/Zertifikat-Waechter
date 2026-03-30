import { memo } from 'react'
import Modal from '../../ui/Modal'
import { ConnectorWithToken } from './types'
import { getDockerCommand, getDockerComposeContent, getWindowsCommand } from './utils'

interface TokenModalProps {
  isOpen: boolean
  onClose: () => void
  connector: ConnectorWithToken
  copiedIndex: number | null
  onCopyToClipboard: (text: string, index: number) => void
  selectedTab: 'docker' | 'compose' | 'windows'
  onSelectedTabChange: (tab: 'docker' | 'compose' | 'windows') => void
}

function TokenModal({
  isOpen,
  onClose,
  connector,
  copiedIndex,
  onCopyToClipboard,
  selectedTab,
  onSelectedTabChange,
}: TokenModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`✅ Agent "${connector.name}" erstellt!`}
    >
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="font-semibold text-[#0F172A] mb-1">
                Agent erfolgreich erstellt!
              </h4>
              <p className="text-sm text-[#64748B]">
                <strong>Nächster Schritt:</strong> Kopiere den Docker-Befehl unten und führe ihn auf deinem
                Server/PC aus. Der Agent verbindet sich automatisch und beginnt mit dem Scanning.
                <br /><br />
                <strong>Wichtig:</strong> Der Token bleibt in der Datenbank gespeichert und kann später
                jederzeit über "📊 Details" abgerufen werden. Bei Kompromittierung kann ein neuer Token
                generiert werden.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0]">
          <button
            onClick={() => onSelectedTabChange('docker')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'docker'
                ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            🐳 Docker Run
          </button>
          <button
            onClick={() => onSelectedTabChange('compose')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'compose'
                ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            📦 Docker Compose
          </button>
          <button
            onClick={() => onSelectedTabChange('windows')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'windows'
                ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            🪟 Windows
          </button>
        </div>

        {/* Command Output */}
        <div>
          {selectedTab === 'docker' && (
            <div className="relative">
              <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                {getDockerCommand(connector)}
              </pre>
              <button
                onClick={() => onCopyToClipboard(getDockerCommand(connector), 0)}
                className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
              >
                {copiedIndex === 0 ? '✓ Kopiert!' : '📋 Kopieren'}
              </button>
            </div>
          )}

          {selectedTab === 'compose' && (
            <div className="relative">
              <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                {getDockerComposeContent(connector)}
              </pre>
              <button
                onClick={() => onCopyToClipboard(getDockerComposeContent(connector), 1)}
                className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
              >
                {copiedIndex === 1 ? '✓ Kopiert!' : '📋 Kopieren'}
              </button>
            </div>
          )}

          {selectedTab === 'windows' && (
            <div className="relative">
              <pre className="bg-[#1E293B] rounded-lg p-4 overflow-x-auto text-sm text-white font-mono">
                {getWindowsCommand(connector)}
              </pre>
              <button
                onClick={() => onCopyToClipboard(getWindowsCommand(connector), 2)}
                className="absolute top-2 right-2 px-3 py-1 bg-[#334155] hover:bg-[#475569] text-white text-xs rounded transition-colors"
              >
                {copiedIndex === 2 ? '✓ Kopiert!' : '📋 Kopieren'}
              </button>
            </div>
          )}
        </div>

        {/* Nächste Schritte */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-[#0F172A] mb-2">🚀 Nächste Schritte:</h4>
          <ol className="text-sm text-[#64748B] space-y-1 list-decimal list-inside">
            <li>Kopiere den Docker-Befehl oben</li>
            <li>Führe ihn auf deinem Computer/Server aus</li>
            <li>Agent startet und meldet sich automatisch (Status wird 🟢 Online)</li>
            <li>Klicke "📊 Details" um Live-Ergebnisse zu sehen!</li>
          </ol>
        </div>

        {/* Wichtiger Hinweis */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex gap-2">
            <span className="text-xl">💡</span>
            <div>
              <h4 className="font-semibold text-[#0F172A] mb-1">Wichtig für Auto-Discovery!</h4>
              <p className="text-sm text-[#64748B]">
                Der Befehl verwendet <code className="bg-white px-1 rounded">--network host</code>.
                Das ist wichtig, damit der Agent dein lokales Netzwerk sehen kann!
                <br /><br />
                <strong>Windows Docker Desktop:</strong> Host-Network funktioniert nur auf Linux.
                Für Windows: Verwende manuelle Targets statt Auto-Discovery.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
        >
          Verstanden, Modal schließen
        </button>
      </div>
    </Modal>
  )
}

export default memo(TokenModal)
