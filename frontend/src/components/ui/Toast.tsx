import { useEffect, useState, memo } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const isSuccess = toast.type === 'success'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all duration-300 ${
        isSuccess
          ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46]'
          : 'bg-[#FEE2E2] border-[#EF4444] text-[#991B1B]'
      }`}
      role="alert"
    >
      <span className="text-lg">{isSuccess ? '\u2705' : '\u274C'}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Schließen"
      >
        \u2715
      </button>
    </div>
  )
}

function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default memo(Toast)
