import { memo } from 'react'
// Success and error alert banners for the ACME page

interface AlertMessagesProps {
  success: string | null
  error: string | null
}

function AlertMessages({ success, error }: AlertMessagesProps) {
  return (
    <>
      {success && (
        <div className="bg-[#D1FAE5] border-2 border-[#10B981] text-[#065F46] px-6 py-4 rounded-xl shadow-lg animate-pulse">
          <div className="flex items-start">
            <span className="text-2xl mr-3">{'\u2705'}</span>
            <div>
              <p className="font-bold text-lg mb-1">Erfolg!</p>
              <p className="text-sm whitespace-pre-line">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FEE2E2] border-2 border-[#EF4444] text-[#991B1B] px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-start">
            <span className="text-2xl mr-3">{'\u274C'}</span>
            <div>
              <p className="font-bold text-lg mb-1">Fehler!</p>
              <p className="text-sm whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(AlertMessages)
