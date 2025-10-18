import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Process Webhook Queue
 * 
 * Diese Function wird regelmäßig per Cron ausgeführt und versendet:
 * - Alle pending Webhooks
 * - Alle Webhooks, die für Retry bereit sind
 */

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Hole alle pending und retry-bereiten Webhooks
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        integration:integrations(*)
      `)
      .in('status', ['pending', 'retrying'])
      .or(`status.eq.pending,and(status.eq.retrying,next_retry_at.lte.${new Date().toISOString()})`)
      .limit(100)

    if (deliveriesError) {
      throw new Error(`Failed to fetch deliveries: ${deliveriesError.message}`)
    }

    if (!deliveries || deliveries.length === 0) {
      console.log('No webhooks to process')
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks in queue' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${deliveries.length} webhook deliveries...`)

    let successCount = 0
    let failCount = 0

    // Verarbeite jeden Webhook
    for (const delivery of deliveries) {
      try {
        const integration = (delivery as any).integration
        if (!integration || !integration.enabled) {
          console.log(`Integration disabled for delivery ${delivery.id}, skipping`)
          continue
        }

        const config = integration.config as any
        if (!config.url) {
          console.error(`No webhook URL configured for delivery ${delivery.id}`)
          await supabase.rpc('schedule_webhook_retry', {
            p_delivery_id: delivery.id,
            p_error_message: 'No webhook URL configured',
            p_status_code: null
          })
          failCount++
          continue
        }

        console.log(`Sending webhook ${delivery.id} to ${config.url}`)

        // Rufe send-webhook Function auf
        const webhookResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-webhook`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              tenant_id: delivery.tenant_id,
              payload: delivery.payload,
              delivery_id: delivery.id
            })
          }
        )

        const result = await webhookResponse.json()

        if (webhookResponse.ok && result.success) {
          console.log(`✅ Webhook ${delivery.id} sent successfully`)
          successCount++
        } else {
          console.error(`❌ Webhook ${delivery.id} failed:`, result.error)
          failCount++
        }

      } catch (err: any) {
        console.error(`Error processing delivery ${delivery.id}:`, err.message)
        
        // Schedule Retry
        await supabase.rpc('schedule_webhook_retry', {
          p_delivery_id: delivery.id,
          p_error_message: err.message,
          p_status_code: null
        })
        
        failCount++
      }
    }

    console.log(`✅ Processed ${deliveries.length} webhooks: ${successCount} success, ${failCount} failed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: deliveries.length,
        successful: successCount,
        failed: failCount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Process webhook queue failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

