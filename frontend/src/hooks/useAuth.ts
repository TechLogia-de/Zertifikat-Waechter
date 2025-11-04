import { useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { secureLog, securityLog, maskEmail } from '../utils/secureLogger'

// Globaler State für Session-Loading (verhindert Race Conditions)
let isLoadingSession = false
let cachedUser: User | null = null
let initialLoadComplete = false

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [loading, setLoading] = useState(!initialLoadComplete)
  const mountedRef = useRef(true)
  const authCompletedRef = useRef(false)

  // Auto-create tenant for OAuth users (with retry logic)
  const ensureTenantExists = async (currentUser: User, retryCount = 0) => {
    const maxRetries = 3
    const retryDelay = 1000 // 1 second
    
    try {
      // Small delay on first attempt to let session propagate
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      secureLog.debug(`Checking tenant existence (attempt ${retryCount + 1}/${maxRetries + 1})...`)
      
      // Check if user already has a membership
      const { data: existingMembership, error: membershipError } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        // If it's a network/CORS error and we have retries left, try again
        if (retryCount < maxRetries && 
            (membershipError.message?.includes('Failed to fetch') || 
             membershipError.message?.includes('502') ||
             membershipError.code === '')) {
          secureLog.warn(`⚠️ Membership check failed, retrying in ${retryDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return await ensureTenantExists(currentUser, retryCount + 1)
        }
        
        secureLog.error('❌ Error checking membership after retries:', membershipError)
        return
      }

      // User already has a tenant
      if (existingMembership) {
        secureLog.debug('✅ User already has a tenant')
        return
      }

      secureLog.info('🏢 Creating tenant for new OAuth user...')
      
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
        secureLog.error('❌ Tenant creation failed:', tenantError)
        return
      }

      if (!tenant) {
        secureLog.error('❌ Tenant could not be created')
        return
      }

      secureLog.debug('✅ Tenant created')

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
        secureLog.error('❌ Membership creation failed:', newMembershipError)
        // Cleanup: Tenant löschen
        await supabase.from('tenants').delete().eq('id', (tenant as any).id)
        return
      }

      secureLog.debug('✅ Membership created')

      // 3. Standard-Policy erstellen
      const policyInsert: Database['public']['Tables']['policies']['Insert'] = {
        tenant_id: (tenant as any).id,
        warn_days: [60, 30, 14, 7, 3, 1],
        channels: { email: true, webhook: false, slack: false, teams: false }
      }

      const { error: policyError } = await supabase
        .from('policies')
        .insert(policyInsert as any)

      if (policyError) {
        secureLog.warn('⚠️ Policy creation failed (non-critical):', policyError)
      } else {
        secureLog.debug('✅ Default policy created')
      }

      secureLog.info('🎉 Auto-created tenant and membership for OAuth user')
    } catch (error) {
      secureLog.error('❌ Unexpected error in ensureTenantExists:', error)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    authCompletedRef.current = false

    // Wenn bereits initial geladen, verwende gecachten State
    if (initialLoadComplete) {
      secureLog.debug('Using cached session state')
      setUser(cachedUser)
      setLoading(false)
      authCompletedRef.current = true
      return
    }

    // Verhindere mehrfache parallele Loads
    if (isLoadingSession) {
      secureLog.debug('Session load already in progress...')
      return
    }

    isLoadingSession = true
    let timeoutId: NodeJS.Timeout | null = null

    // Fallback-Timeout: Nach 8 Sekunden (erhöht für OAuth Redirects)
    timeoutId = setTimeout(() => {
      if (!authCompletedRef.current) {
        securityLog.sessionTimeout()
        initialLoadComplete = true
        isLoadingSession = false
        cachedUser = null
        authCompletedRef.current = true
        if (mountedRef.current) {
          setUser(null)
          setLoading(false)
        }
      }
    }, 8000)

    // Session abrufen mit Logging
    const loadSession = async () => {
      secureLog.debug('Starting initial session load...')
      const startTime = Date.now()

      try {
        secureLog.debug('Calling supabase.auth.getSession()...')
        const { data: { session }, error } = await supabase.auth.getSession()

        const duration = Date.now() - startTime
        secureLog.debug(`Session response received in ${duration}ms`)

        if (error) {
          securityLog.loginFailed(error)
          throw error
        }

        // Update global cache
        cachedUser = session?.user ?? null
        initialLoadComplete = true
        isLoadingSession = false
        authCompletedRef.current = true

        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        if (session?.user) {
          securityLog.loginSuccess(session.user.email, session.user.id)
          
          if (mountedRef.current) {
            setUser(session.user)
            setLoading(false)
          }
          
          // Tenant check asynchron im Hintergrund (blockiert nicht UI)
          secureLog.debug('Checking tenant for user in background...')
          ensureTenantExists(session.user).catch(err => {
            secureLog.error('Background tenant check failed:', err)
          })
        } else {
          secureLog.debug('No active session')
          if (mountedRef.current) {
            setUser(null)
            setLoading(false)
          }
        }
      } catch (err) {
        const duration = Date.now() - startTime
        secureLog.error(`Auth error after ${duration}ms:`, err)

        cachedUser = null
        initialLoadComplete = true
        isLoadingSession = false
        authCompletedRef.current = true

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
        secureLog.auth(`Auth event: ${event}`, { email: session?.user?.email })

        // Mark auth as completed
        authCompletedRef.current = true

        // Update global cache
        cachedUser = session?.user ?? null
        initialLoadComplete = true
        isLoadingSession = false

        // Clear timeout since we got a response
        if (timeoutId) {
          clearTimeout(timeoutId)
          secureLog.debug('Timeout cleared after auth event')
        }

        if (mountedRef.current) {
          setUser(session?.user ?? null)
          setLoading(false)
          secureLog.debug(`UI updated: user=${maskEmail(session?.user?.email)}, loading=false`)
        }

        // Auto-create tenant when user signs in via OAuth (in background)
        if (event === 'SIGNED_IN' && session?.user) {
          secureLog.info('Creating tenant for OAuth user in background...')
          ensureTenantExists(session.user).catch(err => {
            secureLog.error('Background tenant creation failed:', err)
          })
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
    const userEmail = user?.email
    await supabase.auth.signOut()
    
    // Reset global cache
    cachedUser = null
    initialLoadComplete = false
    isLoadingSession = false
    setUser(null)
    
    securityLog.logout(userEmail)
  }

  return { user, loading, signOut }
}


