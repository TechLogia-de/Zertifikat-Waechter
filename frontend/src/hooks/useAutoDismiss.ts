import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Hook for messages that auto-dismiss after a timeout.
 * Automatically clears pending timers on unmount to prevent memory leaks.
 */
export function useAutoDismiss(defaultMs = 5000) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setMessage(null)
  }, [])

  const show = useCallback((msg: string, ms?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage(msg)
    timerRef.current = setTimeout(() => {
      setMessage(null)
      timerRef.current = null
    }, ms ?? defaultMs)
  }, [defaultMs])

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { message, show, clear } as const
}
