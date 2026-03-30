import { memo } from 'react'
// Informational box explaining what ACME Auto-Renewal is

function ACMEInfoBox() {
  return (
    <div className="bg-gradient-to-r from-[#DBEAFE] to-[#E0E7FF] rounded-xl p-6 border-2 border-[#3B82F6] shadow-lg">
      <div className="flex items-start space-x-4">
        <div className="text-5xl animate-bounce">🔐</div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#1E40AF] mb-2">
            Was ist ACME Auto-Renewal?
          </h2>
          <p className="text-[#1E3A8A] leading-relaxed mb-3">
            ACME (Automated Certificate Management Environment) ermöglicht die automatische
            Ausstellung und Erneuerung von SSL/TLS-Zertifikaten von Let's Encrypt, ZeroSSL
            und anderen Certificate Authorities.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
              <div className="font-semibold text-[#1E40AF] mb-1">✅ DNS-01 Challenge</div>
              <div className="text-[#475569]">
                Für Wildcard-Zertifikate (*.example.com). Benötigt Cloudflare API.
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-[#3B82F6]/20">
              <div className="font-semibold text-[#1E40AF] mb-1">✅ HTTP-01 Challenge</div>
              <div className="text-[#475569]">
                Für einzelne Domains. Server muss öffentlich erreichbar sein (Port 80).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(ACMEInfoBox)
