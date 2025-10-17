import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select(`
        *,
        certificate:certificates(*)
      `)
      .is('acknowledged_at', null)
      .order('first_triggered_at', { ascending: true })

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`)
    }

    console.log(`Found ${alerts?.length || 0} pending alerts`)

    // TODO: Implement alert sending logic
    // 1. Group alerts by tenant
    // 2. Get tenant notification preferences (email, slack, teams)
    // 3. Send notifications
    // 4. Update last_notified_at timestamp

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_alerts: alerts?.length || 0 
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Send alerts failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})


