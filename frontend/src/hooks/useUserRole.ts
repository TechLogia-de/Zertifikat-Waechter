import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer' | null

/**
 * Hook to fetch the current user's role from the memberships table.
 * Returns the role string and a loading flag. When the user has no
 * membership yet (or is not logged in), role will be null.
 */
export function useUserRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setRole(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchRole() {
      try {
        const { data, error } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user!.id)
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error('Failed to fetch user role:', error)
          setRole(null)
        } else {
          setRole((data?.role as UserRole) ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Unexpected error fetching user role:', err)
          setRole(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRole()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const isAdminOrOwner = role === 'admin' || role === 'owner'

  return { role, loading, isAdminOrOwner }
}
