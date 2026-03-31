import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Session timeout after 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000
// Warning 2 minutes before timeout
const WARNING_BEFORE_MS = 2 * 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

interface UseSessionTimeoutOptions {
  onWarning?: (remainingMs: number) => void
  onTimeout?: () => void
  enabled?: boolean
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const { onWarning, onTimeout, enabled = true } = options
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current)
      warningRef.current = null
    }
  }, [])

  const handleTimeout = useCallback(async () => {
    clearTimers()
    if (onTimeout) {
      onTimeout()
    }
    // Sign out user
    await supabase.auth.signOut()
    window.location.href = '/login?reason=timeout'
  }, [clearTimers, onTimeout])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    clearTimers()

    if (!enabled) return

    // Set warning timer
    warningRef.current = setTimeout(() => {
      const remaining = SESSION_TIMEOUT_MS - (Date.now() - lastActivityRef.current)
      if (onWarning && remaining > 0) {
        onWarning(remaining)
      }
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Set logout timer
    timeoutRef.current = setTimeout(handleTimeout, SESSION_TIMEOUT_MS)
  }, [enabled, clearTimers, handleTimeout, onWarning])

  useEffect(() => {
    if (!enabled) return

    // Initial timer
    resetTimer()

    // Listen for user activity (throttled via passive events)
    let throttleTimer: ReturnType<typeof setTimeout> | null = null
    const throttledReset = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        throttleTimer = null
        resetTimer()
      }, 5000) // Throttle to once every 5 seconds
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, throttledReset, { passive: true })
    }

    // Also reset on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session should have already timed out
        const elapsed = Date.now() - lastActivityRef.current
        if (elapsed >= SESSION_TIMEOUT_MS) {
          handleTimeout()
        } else {
          resetTimer()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimers()
      if (throttleTimer) clearTimeout(throttleTimer)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, throttledReset)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, resetTimer, clearTimers, handleTimeout])

  return { resetTimer }
}
