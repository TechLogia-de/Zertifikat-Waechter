import { useEffect, useState, useRef } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// Module-level cache so every component shares the same resolved tenant_id
// and we avoid redundant queries across the page tree.
let cachedTenantId: string | null = null
let cachedForUserId: string | null = null

export function useTenantId(): { tenantId: string | null; loading: boolean } {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string | null>(
    user?.id === cachedForUserId ? cachedTenantId : null
  )
  const [loading, setLoading] = useState<boolean>(tenantId === null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // If the user changed, invalidate the cache
    if (user?.id !== cachedForUserId) {
      cachedTenantId = null
      cachedForUserId = null
    }

    if (!user?.id) {
      setTenantId(null)
      setLoading(false)
      return
    }

    // Return cached value immediately when available
    if (cachedTenantId && cachedForUserId === user.id) {
      setTenantId(cachedTenantId)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchTenantId() {
      try {
        const { data, error } = await supabase
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', user!.id)
          .limit(1)
          .maybeSingle()

        if (cancelled || !mountedRef.current) return

        if (error) {
          console.error('Failed to fetch tenant_id:', error)
          setLoading(false)
          return
        }

        const tid = (data as any)?.tenant_id ?? null
        cachedTenantId = tid
        cachedForUserId = user!.id
        setTenantId(tid)
      } catch (err) {
        console.error('Failed to fetch tenant_id:', err)
      } finally {
        if (mountedRef.current && !cancelled) {
          setLoading(false)
        }
      }
    }

    fetchTenantId()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [user?.id])

  return { tenantId, loading }
}
