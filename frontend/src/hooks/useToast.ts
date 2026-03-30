import { useState, useCallback } from 'react'
import type { ToastMessage } from '../components/ui/Toast'

let nextId = 0
const MAX_TOASTS = 5

// Simple toast notification hook.
// Usage:
//   const { toasts, showSuccess, showError, dismissToast } = useToast()
//   showSuccess('Gespeichert!')
//   showError('Fehler beim Laden')
//   <Toast toasts={toasts} onDismiss={dismissToast} />
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${++nextId}`
    setToasts((prev) => {
      const next = [...prev, { id, type, message }]
      // Drop oldest toasts when exceeding the cap
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
  }, [])

  const showSuccess = useCallback((message: string) => addToast('success', message), [addToast])
  const showError = useCallback((message: string) => addToast('error', message), [addToast])

  return { toasts, showSuccess, showError, dismissToast }
}
