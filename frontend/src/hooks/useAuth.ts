import { useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

// Globaler State für Session-Loading (verhindert Race Conditions)
let isLoadingSession = false
let cachedUser: User | null = null
let initialLoadComplete = false

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [loading, setLoading] = useState(!initialLoadComplete)
  const mountedRef = useRef(true)

  // Auto-create tenant for OAuth users
  const ensureTenantExists = async (currentUser: User) => {
    try {
      // Check if user already has a membership
      const { data: existingMembership, error: membershipError } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        console.error('Error checking membership:', membershipError)
        return
      }

      // User already has a tenant
      if (existingMembership) {
        return
      }

      // OAuth User ohne Tenant → automatisch erstellen
      const email = currentUser.email || 'Unbekannt'
      const tenantName = email.split('@')[0] + ' Organisation'

      // 1. Tenant erstellen
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name: tenantName } as any)
        .select()
        .single()

      if (tenantError) {
        console.error('Tenant creation failed:', tenantError)
        return
      }

      if (!tenant) {
        console.error('Tenant could not be created')
        return
      }

      // 2. Membership erstellen
      const membershipInsert: Database['public']['Tables']['memberships']['Insert'] = {
        user_id: currentUser.id,
        tenant_id: (tenant as any).id,
        role: 'owner'
      }

      const { error: newMembershipError } = await supabase
        .from('memberships')
        .insert(membershipInsert as any)

      if (newMembershipError) {
        console.error('Membership creation failed:', newMembershipError)
        // Cleanup: Tenant löschen
        await supabase.from('tenants').delete().eq('id', (tenant as any).id)
        return
      }

      // 3. Standard-Policy erstellen
      const policyInsert: Database['public']['Tables']['policies']['Insert'] = {
        tenant_id: (tenant as any).id,
        warn_days: [60, 30, 14, 7, 3, 1],
        channels: { email: true, webhook: false, slack: false, teams: false }
      }

      await supabase
        .from('policies')
        .insert(policyInsert as any)

      console.log('✅ Auto-created tenant and membership for OAuth user')
    } catch (error) {
      console.error('Error in ensureTenantExists:', error)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    
    // Wenn bereits initial geladen, verwende gecachten State
    if (initialLoadComplete) {
      console.log('🚀 Using cached session state')
      setUser(cachedUser)
      setLoading(false)
      return
    }

    // Verhindere mehrfache parallele Loads
    if (isLoadingSession) {
      console.log('⏸️ Session load already in progress...')
      return
    }

    isLoadingSession = true
    let timeoutId: NodeJS.Timeout | null = null

    // Fallback-Timeout: Nach 5 Sekunden (verlängert von 3s)
    timeoutId = setTimeout(() => {
      if (!initialLoadComplete) {
        console.warn('⏱️ Session load timeout (5s) - continuing without session')
        initialLoadComplete = true
        isLoadingSession = false
        cachedUser = null
        if (mountedRef.current) {
          setUser(null)
          setLoading(false)
        }
      }
    }, 5000)

    // Session abrufen mit Logging
    const loadSession = async () => {
      console.log('🔍 Starting initial session load...')
      const startTime = Date.now()

      try {
        console.log('📡 Calling supabase.auth.getSession()...')
        const { data: { session }, error } = await supabase.auth.getSession()

        const duration = Date.now() - startTime
        console.log(`✅ Session response received in ${duration}ms`)

        if (error) {
          console.error('❌ Session error:', error)
          throw error
        }

        // Update global cache
        cachedUser = session?.user ?? null
        initialLoadComplete = true
        isLoadingSession = false

        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        if (session?.user) {
          console.log('👤 User found:', session.user.email)
          
          if (mountedRef.current) {
            setUser(session.user)
            setLoading(false)
          }
          
          // Tenant check asynchron (blockiert nicht UI)
          console.log('🔐 Checking tenant for user...')
          await ensureTenantExists(session.user)
          console.log('✅ Auth complete - user logged in')
        } else {
          console.log('👋 No active session')
          if (mountedRef.current) {
            setUser(null)
            setLoading(false)
          }
        }
      } catch (err) {
        const duration = Date.now() - startTime
        console.error(`❌ Auth error after ${duration}ms:`, err)

        cachedUser = null
        initialLoadComplete = true
        isLoadingSession = false

        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        if (mountedRef.current) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    loadSession()

    // Auth State Changes beobachten
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth event:', event)
        
        // Update global cache
        cachedUser = session?.user ?? null
        
        if (mountedRef.current) {
          setUser(session?.user ?? null)
        }

        // Auto-create tenant when user signs in via OAuth
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureTenantExists(session.user)
        }
      }
    )

    return () => {
      mountedRef.current = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    // Reset global cache
    cachedUser = null
    initialLoadComplete = false
    isLoadingSession = false
    setUser(null)
  }

  return { user, loading, signOut }
}


