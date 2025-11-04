import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
    debug: false, // Set to true if you need to debug auth issues
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
})

// Log auth state changes for debugging (uses secure logger)
if (import.meta.env.DEV) {
  import('../utils/secureLogger').then(({ secureLog, maskEmail }) => {
    supabase.auth.onAuthStateChange((event, session) => {
      secureLog.debug(`[Supabase] Auth event: ${event}`, {
        hasSession: !!session,
        hasUser: !!session?.user,
        email: maskEmail(session?.user?.email),
      })
    })
  })
}


