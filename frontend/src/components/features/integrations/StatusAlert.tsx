import { memo } from 'react'
// Status alert banners for success and error messages

interface StatusAlertProps {
  success: string | null
  error: string | null
}

function StatusAlert({ success, error }: StatusAlertProps) {
  return (
    <>
      {success && (
        <div className="mb-6 bg-[#D1FAE5] border border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-start">
            <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-lg mb-1">Erfolg!</p>
              <p className="text-sm whitespace-pre-line">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-start">
            <span className="text-2xl mr-3">❌</span>
            <div className="flex-1">
              <p className="font-semibold text-lg mb-1">Fehler</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(StatusAlert)
