import { memo } from 'react'
interface MfaSectionProps {
  mfaLoading: boolean
  mfaSuccess: string | null
  mfaError: string | null
  totpEnabled: boolean
  totpFactor: { id: string; factor_type: 'totp'; status: string } | null
  qrImageUrl: string | null
  totpSecret: string | null
  totpIssuer: string | null
  totpLabel: string | null
  totpUri: string | null
  verificationCode: string
  enrolling: boolean
  verifying: boolean
  disabling: boolean
  onVerificationCodeChange: (code: string) => void
  onInitiateEnrollment: () => void
  onVerify: () => void
  onCancel: () => void
  onDisable: () => void
}

/**
 * MFA/TOTP settings section: shows status, enrollment QR code, verification, and disable controls.
 */
function MfaSection({
  mfaLoading,
  mfaSuccess,
  mfaError,
  totpEnabled,
  totpFactor,
  qrImageUrl,
  totpSecret,
  totpIssuer,
  totpLabel,
  totpUri,
  verificationCode,
  enrolling,
  verifying,
  disabling,
  onVerificationCodeChange,
  onInitiateEnrollment,
  onVerify,
  onCancel,
  onDisable,
}: MfaSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#0F172A]">Sicherheit: Zwei‑Faktor‑Authentifizierung (TOTP)</h2>
        {mfaLoading && <span className="text-sm text-[#64748B]">Lade…</span>}
      </div>

      {mfaSuccess && (
        <div className="bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-4 py-3 rounded-lg mb-4">
          {mfaSuccess}
        </div>
      )}
      {mfaError && (
        <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 rounded-lg mb-4">
          ❌ {mfaError}
          {mfaError.includes('serverseitig deaktiviert') && (
            <div className="mt-2 text-[#991B1B] text-xs">
              Tipp: In `supabase/config.toml` den Block `[auth.mfa]` aktivieren und unter `[auth.mfa.totp]` `enroll_enabled=true`, `verify_enabled=true` setzen. Danach Supabase neu starten.
            </div>
          )}
        </div>
      )}

      {totpEnabled ? (
        <MfaEnabledView disabling={disabling} onDisable={onDisable} />
      ) : (qrImageUrl || totpFactor?.status === 'unverified') ? (
        <MfaEnrollmentView
          qrImageUrl={qrImageUrl}
          totpSecret={totpSecret}
          totpIssuer={totpIssuer}
          totpLabel={totpLabel}
          totpUri={totpUri}
          verificationCode={verificationCode}
          verifying={verifying}
          onVerificationCodeChange={onVerificationCodeChange}
          onVerify={onVerify}
          onCancel={onCancel}
        />
      ) : (
        <MfaStartView enrolling={enrolling} onInitiateEnrollment={onInitiateEnrollment} />
      )}
    </div>
  )
}

/** Shown when TOTP is already active. */
function MfaEnabledView({ disabling, onDisable }: { disabling: boolean; onDisable: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
        <div>
          <p className="font-semibold text-[#0F172A]">Status</p>
          <p className="text-sm text-[#64748B]">TOTP ist aktiviert für dein Konto.</p>
        </div>
        <span className="px-3 py-1 rounded bg-[#D1FAE5] text-[#065F46] text-sm font-medium">Aktiv</span>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onDisable}
          disabled={disabling}
          className="px-4 py-2 bg-[#EF4444] text-white rounded-lg font-semibold hover:bg-[#DC2626] disabled:opacity-50 transition-colors shadow-sm"
        >
          {disabling ? '⏳ Deaktiviere…' : 'MFA deaktivieren'}
        </button>
      </div>
    </div>
  )
}

/** Shown during TOTP enrollment: QR code + verification input. */
function MfaEnrollmentView({
  qrImageUrl,
  totpSecret,
  totpIssuer,
  totpLabel,
  totpUri,
  verificationCode,
  verifying,
  onVerificationCodeChange,
  onVerify,
  onCancel,
}: {
  qrImageUrl: string | null
  totpSecret: string | null
  totpIssuer: string | null
  totpLabel: string | null
  totpUri: string | null
  verificationCode: string
  verifying: boolean
  onVerificationCodeChange: (code: string) => void
  onVerify: () => void
  onCancel: () => void
}) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="flex flex-col items-center">
        <div className="p-4 bg-white border-2 border-[#3B82F6] rounded-xl shadow-lg inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="TOTP QR Code" className="w-72 h-72 object-contain" />
          ) : (
            <div className="w-72 h-72 flex items-center justify-center text-[#64748B]">
              <div className="text-center">
                <div className="text-4xl mb-2">📱</div>
                <div>Kein QR‑Code verfügbar</div>
              </div>
            </div>
          )}
        </div>
        <div className="text-sm text-[#64748B] mt-4 text-center space-y-2">
          <p className="font-semibold text-[#0F172A]">✅ Kompatible Apps:</p>
          <div className="flex flex-col gap-1 text-xs">
            <span>• Microsoft Authenticator</span>
            <span>• Google Authenticator</span>
            <span>• 1Password / Authy</span>
          </div>
        </div>
        <div className="w-full mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
          <p className="text-sm font-semibold text-[#0F172A] mb-2">Manuelle Einrichtung</p>
          {totpSecret ? (
            <div className="space-y-2">
              {totpIssuer || totpLabel ? (
                <p className="text-xs text-[#64748B]">
                  {(totpIssuer && totpLabel) ? `${totpIssuer} – ${totpLabel}` : (totpIssuer || totpLabel)}
                </p>
              ) : null}
              <div className="flex gap-2">
                <input
                  readOnly
                  value={totpSecret}
                  className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => { if (totpSecret) navigator.clipboard?.writeText(totpSecret).catch(() => {}) }}
                  className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                >
                  Kopieren
                </button>
              </div>
              <p className="text-xs text-[#64748B]">In deiner Authenticator‑App „Schlüssel eingeben" wählen. Typ: TOTP, 6 Ziffern, 30s.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[#64748B]">Falls kein Schlüssel sichtbar ist, kannst du die otpauth‑URI kopieren:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={totpUri ?? ''}
                  className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded font-mono text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => { if (totpUri) navigator.clipboard?.writeText(totpUri).catch(() => {}) }}
                  className="px-3 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] text-sm"
                >
                  Kopieren
                </button>
              </div>
              <p className="text-xs text-[#64748B]">
                Wenn du den QR‑Code bereits gescannt hast, gib unten einfach den 6‑stelligen Code ein. Andernfalls kannst du die Aktivierung über „Abbrechen" und anschließend „MFA (TOTP) aktivieren" neu starten.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-[#0F172A]">6‑stelligen Code eingeben</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={verificationCode}
          onChange={(e) => onVerificationCodeChange(e.target.value.replace(/\D/g, ''))}
          className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
          placeholder="123456"
        />
        <div className="flex gap-3 pt-1">
          <button
            onClick={onVerify}
            disabled={verifying || verificationCode.length !== 6}
            className="flex-1 px-4 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#059669] disabled:opacity-50 transition-colors shadow-sm"
          >
            {verifying ? '⏳ Verifiziere…' : 'MFA aktivieren'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 border border-[#E2E8F0] text-[#64748B] rounded-lg font-semibold hover:bg-[#F8FAFC]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shown when MFA is not yet set up - initial activation button. */
function MfaStartView({ enrolling, onInitiateEnrollment }: { enrolling: boolean; onInitiateEnrollment: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748B]">
        Schütze deinen Account mit einer zusätzlichen Sicherheitsstufe. Nach der Aktivierung benötigst du bei der Anmeldung einen Code aus deiner Authenticator‑App.
      </p>

      <button
        onClick={onInitiateEnrollment}
        disabled={enrolling}
        className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-sm"
      >
        {enrolling ? '⏳ Starte…' : 'MFA (TOTP) aktivieren'}
      </button>
    </div>
  )
}

export default memo(MfaSection)
