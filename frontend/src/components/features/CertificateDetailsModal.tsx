import { useState } from 'react'
import Modal from '../ui/Modal'
import CertificateHistory from './CertificateHistory'
import Badge from '../ui/Badge'

interface Certificate {
  id: string
  subject_cn: string
  san: string[] | any
  issuer: string
  not_before: string
  not_after: string
  key_alg: string
  key_size: number
  serial: string
  fingerprint: string
  is_trusted: boolean
  is_self_signed: boolean
}

interface CertificateDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  certificate: Certificate
  host: string
  port: number
}

export default function CertificateDetailsModal({ 
  isOpen, 
  onClose, 
  certificate, 
  host, 
  port 
}: CertificateDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const now = new Date()
  const expiryDate = new Date(certificate.not_after)
  const startDate = new Date(certificate.not_before)
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  let statusBadge = { bg: '#D1FAE5', text: '#065F46', label: '✓ Gültig' }
  if (daysUntilExpiry < 0) {
    statusBadge = { bg: '#FEE2E2', text: '#991B1B', label: '✗ Abgelaufen' }
  } else if (daysUntilExpiry < 7) {
    statusBadge = { bg: '#FEE2E2', text: '#991B1B', label: '⚠️ Kritisch' }
  } else if (daysUntilExpiry < 30) {
    statusBadge = { bg: '#FEF3C7', text: '#92400E', label: '⚠️ Warnung' }
  }

  const sanArray = Array.isArray(certificate.san) ? certificate.san : []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔒 Zertifikat Details">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0]">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            📋 Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            📊 Scan-Historie
          </button>
        </div>

        {activeTab === 'details' ? (
          <>
        {/* Header Info */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-bold text-[#0F172A]">{host}</h3>
                <Badge variant="success" size="sm" icon="✓">
                  Echte Daten
                </Badge>
              </div>
              <p className="text-[#64748B]">Port {port} • HTTPS</p>
            </div>
            <span 
              className="px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}
            >
              {statusBadge.label}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-[#64748B] mb-1">Gültig ab</p>
              <p className="font-semibold text-[#0F172A]">
                {startDate.toLocaleDateString('de-DE')}
              </p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-[#64748B] mb-1">Läuft ab</p>
              <p className="font-semibold text-[#0F172A]">
                {expiryDate.toLocaleDateString('de-DE')}
              </p>
            </div>
          </div>

          {daysUntilExpiry >= 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#0F172A]">Verbleibende Zeit</span>
                <span className="text-sm font-bold text-[#3B82F6]">{daysUntilExpiry} Tage</span>
              </div>
              <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(100, (daysUntilExpiry / 90) * 100)}%`,
                    backgroundColor: statusBadge.text
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Certificate Details */}
        <div className="space-y-4">
          <h4 className="font-semibold text-[#0F172A] text-lg border-b border-[#E2E8F0] pb-2">
            Zertifikat Informationen
          </h4>

          {/* Subject */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">Common Name</span>
            <span className="col-span-2 text-sm text-[#0F172A] font-mono break-all">
              {certificate.subject_cn}
            </span>
          </div>

          {/* Issuer */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">Aussteller</span>
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-sm text-[#0F172A]">
                {certificate.issuer || 'Unbekannt'}
              </span>
              {certificate.issuer && (
                <Badge variant="info" size="sm">
                  CA
                </Badge>
              )}
            </div>
          </div>

          {/* SAN */}
          {sanArray.length > 0 && (
            <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
              <span className="text-sm font-medium text-[#64748B]">SAN (Alternative Namen)</span>
              <div className="col-span-2 space-y-1">
                {sanArray.slice(0, 5).map((san: string, idx: number) => (
                  <div key={idx} className="text-sm text-[#0F172A] font-mono">
                    • {san}
                  </div>
                ))}
                {sanArray.length > 5 && (
                  <p className="text-xs text-[#64748B] mt-2">
                    +{sanArray.length - 5} weitere Namen
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Serial */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">Seriennummer</span>
            <span className="col-span-2 text-sm text-[#0F172A] font-mono break-all">
              {certificate.serial}
            </span>
          </div>

          {/* Fingerprint */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">SHA-256 Fingerprint</span>
            <span className="col-span-2 text-xs text-[#0F172A] font-mono break-all">
              {certificate.fingerprint}
            </span>
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">Schlüssel-Algorithmus</span>
            <span className="col-span-2 text-sm text-[#0F172A]">
              {certificate.key_alg} ({certificate.key_size} Bit)
            </span>
          </div>

          {/* Trust Status */}
          <div className="grid grid-cols-3 gap-4 py-2 hover:bg-[#F8FAFC] px-3 rounded-lg transition">
            <span className="text-sm font-medium text-[#64748B]">Vertrauensstatus</span>
            <div className="col-span-2 space-y-1">
              <div className="flex items-center space-x-2">
                {certificate.is_trusted ? (
                  <>
                    <span className="text-[#10B981]">✓</span>
                    <span className="text-sm text-[#10B981] font-medium">Vertrauenswürdig</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#EF4444]">✗</span>
                    <span className="text-sm text-[#EF4444] font-medium">Nicht vertrauenswürdig</span>
                  </>
                )}
              </div>
              {certificate.is_self_signed && (
                <p className="text-xs text-[#F59E0B]">⚠️ Selbst-signiert</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] transition-colors"
          >
            Schließen
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(certificate.fingerprint)
              alert('Fingerprint in Zwischenablage kopiert!')
            }}
            className="px-4 py-3 bg-[#F1F5F9] text-[#64748B] rounded-lg font-semibold hover:bg-[#E2E8F0] transition-colors"
          >
            📋 Fingerprint kopieren
          </button>
        </div>
        </>
        ) : (
          <CertificateHistory certificateId={certificate.id} />
        )}
      </div>
    </Modal>
  )
}

