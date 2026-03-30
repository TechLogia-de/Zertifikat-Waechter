import { memo } from 'react'
import Modal from '../../ui/Modal'
import { Connector } from './types'

interface EditConnectorModalProps {
  isOpen: boolean
  onClose: () => void
  connector: Connector
  onSave: (connectorId: string, newSettings: any) => void
}

function EditConnectorModal({
  isOpen,
  onClose,
  connector,
  onSave,
}: EditConnectorModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`⚙️ Einstellungen: ${connector.name}`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-2">
            Scan-Targets (Komma-separiert)
          </label>
          <input
            type="text"
            defaultValue={connector.config?.scan_targets?.join(',') || ''}
            id="edit-targets"
            className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            placeholder="server1.intern,mail.corp"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-2">
            Ports (Komma-separiert)
          </label>
          <input
            type="text"
            defaultValue={connector.config?.scan_ports?.join(',') || '443'}
            id="edit-ports"
            className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            placeholder="443,8443,636"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-2">
            Scan-Intervall (Minuten)
          </label>
          <select
            id="edit-interval"
            defaultValue="60"
            className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          >
            <option value="5">5 Minuten</option>
            <option value="15">15 Minuten</option>
            <option value="30">30 Minuten</option>
            <option value="60">1 Stunde</option>
            <option value="120">2 Stunden</option>
            <option value="360">6 Stunden</option>
            <option value="1440">24 Stunden</option>
          </select>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-[#64748B]">
            ⚠️ <strong>Wichtig:</strong> Nach dem Speichern musst du den Agent neu starten,
            damit die Änderungen wirksam werden!
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              const targets = (document.getElementById('edit-targets') as HTMLInputElement)?.value
              const ports = (document.getElementById('edit-ports') as HTMLInputElement)?.value
              const interval = (document.getElementById('edit-interval') as HTMLSelectElement)?.value

              const newSettings = {
                ...connector.config,
                scan_targets: targets.split(',').map(t => t.trim()).filter(t => t),
                scan_ports: ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p)),
                scan_interval: parseInt(interval) * 60
              }

              onSave(connector.id, newSettings)
            }}
            className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
          >
            💾 Speichern
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F1F5F9] transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default memo(EditConnectorModal)
