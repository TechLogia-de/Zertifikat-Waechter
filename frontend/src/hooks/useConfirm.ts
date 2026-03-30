import { useState, useCallback, useRef } from 'react'

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
}

// Hook returning a promise-based confirm(title, message) function.
// Renders ConfirmDialog via the returned state + handler props.
//
// Usage:
//   const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
//
//   async function deleteThing() {
//     const ok = await confirm('Löschen?', 'Dieses Element wird gelöscht.')
//     if (ok) { /* proceed */ }
//   }
//
//   <ConfirmDialog
//     isOpen={confirmState.isOpen}
//     title={confirmState.title}
//     message={confirmState.message}
//     onConfirm={handleConfirm}
//     onCancel={handleCancel}
//   />
export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setConfirmState({ isOpen: true, title, message })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true)
    resolveRef.current = null
    setConfirmState({ isOpen: false, title: '', message: '' })
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    resolveRef.current = null
    setConfirmState({ isOpen: false, title: '', message: '' })
  }, [])

  return { confirmState, confirm, handleConfirm, handleCancel }
}
