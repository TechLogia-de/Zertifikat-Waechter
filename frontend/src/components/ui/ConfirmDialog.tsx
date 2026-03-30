import { memo } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

// Modal-based confirmation dialog replacing browser confirm().
// Usage:
//   <ConfirmDialog
//     isOpen={showConfirm}
//     title="Wirklich loeschen?"
//     message="Das kann nicht rueckgaengig gemacht werden."
//     onConfirm={handleConfirm}
//     onCancel={handleCancel}
//   />
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-[#0F172A] mb-2">{title}</h3>
          <p className="text-sm text-[#64748B] mb-6">{message}</p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg font-medium hover:bg-[#E2E8F0] transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors text-white ${
                isDanger
                  ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                  : 'bg-[#3B82F6] hover:bg-[#2563EB]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(ConfirmDialog)
