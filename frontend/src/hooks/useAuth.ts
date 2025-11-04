import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

      console.log('Auto-created tenant and membership for OAuth user')
    } catch (error) {
      console.error('Error in ensureTenantExists:', error)
    }
  }

  useEffect(() => {
    // Session abrufen
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      // Check tenant for OAuth users
      if (session?.user) {
        await ensureTenantExists(session.user)
      }
      
      setLoading(false)
    })

    // Auth State Changes beobachten
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        // Auto-create tenant when user signs in via OAuth
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureTenantExists(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, signOut }
}


