import Modal from '../../ui/Modal'

interface FormData {
  name: string
  scanMode: string
  scanTargets: string
  scanPorts: string
}

interface CreateConnectorModalProps {
  isOpen: boolean
  onClose: () => void
  formData: FormData
  onFormDataChange: (data: FormData) => void
  onCreateConnector: () => void
  creating: boolean
}

export default function CreateConnectorModal({
  isOpen,
  onClose,
  formData,
  onFormDataChange,
  onCreateConnector,
  creating,
}: CreateConnectorModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Neuen Agent erstellen"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-2">
            Agent-Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            placeholder="z.B. Büro-Agent oder Home-Scanner"
            className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          />
        </div>

        {/* Scan-Modus Auswahl */}
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-3">
            Scan-Modus *
          </label>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors bg-white">
              <input
                type="radio"
                name="scanMode"
                value="auto"
                checked={formData.scanMode === 'auto'}
                onChange={(e) => onFormDataChange({ ...formData, scanMode: e.target.value })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-[#0F172A] flex items-center gap-2">
                  🧠 Auto-Discovery (Empfohlen)
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-semibold">SMART</span>
                </div>
                <p className="text-sm text-[#64748B] mt-1">
                  <strong>Intelligenter Netzwerk-Scan:</strong> Der Agent scannt automatisch alle privaten IP-Bereiche
                  (192.168.x.x, 10.x.x.x), findet aktive Hosts und analysiert 25+ Standard-Ports.
                </p>
                <p className="text-xs text-[#94A3B8] mt-2">
                  <strong>Erkennt:</strong> Web-Server (80, 443, 8080, 8443), Mail (25, 465, 587, 993, 995),
                  LDAP (389, 636), Datenbanken (3306, 5432, 27017), Remote (22, 3389), File-Shares (445)
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-medium">🌐 Netzwerk-Discovery</span>
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded font-medium">🔍 Port-Scan</span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded font-medium">🏷️ Service-ID</span>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 border-[#E2E8F0] rounded-lg cursor-pointer hover:border-[#3B82F6] transition-colors bg-white">
              <input
                type="radio"
                name="scanMode"
                value="manual"
                checked={formData.scanMode === 'manual'}
                onChange={(e) => onFormDataChange({ ...formData, scanMode: e.target.value })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-[#0F172A]">
                  🎯 Manuelle Targets
                </div>
                <p className="text-sm text-[#64748B] mt-1">
                  <strong>Präzise Überwachung:</strong> Definiere exakte Hosts (Hostnamen oder IPs) und
                  Ports für gezieltes Scanning. Ideal für produktive Systeme oder wenn nur bestimmte
                  Server überwacht werden sollen.
                </p>
                <p className="text-xs text-[#94A3B8] mt-2">
                  <strong>Beispiel:</strong> mail.firma.de,ldap.intern,192.168.1.10 → Port 443,636,993
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Manuelle Targets (nur wenn Modus = manual) */}
        {formData.scanMode === 'manual' && (
          <>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Scan-Targets * (Komma-separiert)
              </label>
              <input
                type="text"
                value={formData.scanTargets}
                onChange={(e) => onFormDataChange({ ...formData, scanTargets: e.target.value })}
                placeholder="server1.intern,192.168.1.10,mail.corp"
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Hostnamen oder IP-Adressen deiner Server
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Ports (Komma-separiert)
              </label>
              <input
                type="text"
                value={formData.scanPorts}
                onChange={(e) => onFormDataChange({ ...formData, scanPorts: e.target.value })}
                placeholder="443,8443,636"
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Standard: 443 (HTTPS), 8443 (Alt-HTTPS), 636 (LDAPS)
              </p>
            </div>
          </>
        )}

        {/* Auto-Discovery Info */}
        {formData.scanMode === 'auto' && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
              <span className="text-xl">🧠</span>
              Auto-Discovery Scan-Prozess
            </h4>
            <div className="text-sm text-[#64748B] space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                <div>
                  <strong>Netzwerk-Erkennung:</strong> Scannt alle privaten IP-Bereiche
                  (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                <div>
                  <strong>Port-Scanning:</strong> 25+ Standard-Ports pro Host
                  (Web: 80/443/8080/8443 • Mail: 25/465/587/993/995 • LDAP: 389/636 • DB: 3306/5432/27017 • Remote: 22/3389 • SMB: 445)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <div>
                  <strong>Service-Identifikation:</strong> Erkennt Dienste automatisch (HTTP, HTTPS, SSH, RDP, SMTP, IMAP, LDAP, MySQL, PostgreSQL, etc.)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">4.</span>
                <div>
                  <strong>TLS-Zertifikat-Extraktion:</strong> Scannt alle TLS-fähigen Ports und extrahiert Zertifikat-Metadaten (CN, SAN, Issuer, Ablaufdatum, Fingerprint)
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-[#64748B] italic">
                💡 Tipp: Nutze manuelle Targets für produktive Umgebungen oder wenn nur bestimmte Server überwacht werden sollen.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCreateConnector}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Erstelle...' : 'Agent erstellen'}
          </button>
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F1F5F9] transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  )
}
