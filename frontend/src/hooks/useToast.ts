import { useState, useCallback } from 'react'
import type { ToastMessage } from '../components/ui/Toast'

let nextId = 0

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

  const showSuccess = useCallback((message: string) => {
    const id = `toast-${++nextId}`
    setToasts((prev) => [...prev, { id, type: 'success', message }])
  }, [])

  const showError = useCallback((message: string) => {
    const id = `toast-${++nextId}`
    setToasts((prev) => [...prev, { id, type: 'error', message }])
  }, [])

  return { toasts, showSuccess, showError, dismissToast }
}
