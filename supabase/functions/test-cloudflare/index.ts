// Supabase Edge Function: Test Cloudflare API Token
// Umgeht CORS-Problem im Browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { api_token, zone_id } = await req.json()

    if (!api_token) {
      throw new Error('API Token fehlt')
    }

    // Test 1: Token Verification
    console.log('Testing Cloudflare token...')
    const verifyResponse = await fetch(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${api_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const verifyResult = await verifyResponse.json()

    if (!verifyResponse.ok || !verifyResult.success) {
      console.error('Token verification failed:', verifyResult)
      throw new Error('Token ungültig oder keine Berechtigung')
    }

    console.log('Token verified successfully')

    // Test 2: Zone ID Check (optional)
    let zoneInfo = null
    if (zone_id) {
      console.log(`Testing zone ID: ${zone_id}`)
      const zoneResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${api_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const zoneResult = await zoneResponse.json()

      if (zoneResult.success && zoneResult.result) {
        zoneInfo = {
          name: zoneResult.result.name,
          status: zoneResult.result.status,
          id: zoneResult.result.id
        }
        console.log('Zone verified:', zoneInfo.name)
      } else {
        console.warn('Zone verification failed:', zoneResult)
      }
    }

    // Success Response
    const response = {
      success: true,
      token_status: verifyResult.result?.status || 'active',
      zone_info: zoneInfo,
      message: zoneInfo 
        ? `✅ Token gültig!\n🌐 Zone: ${zoneInfo.name}\n📊 Status: ${verifyResult.result?.status || 'active'}`
        : `✅ Token gültig!\n📊 Status: ${verifyResult.result?.status || 'active'}\n\n💡 Tipp: Füge Zone ID hinzu für schnellere DNS-Updates`
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Cloudflare test error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unbekannter Fehler',
        message: `❌ Cloudflare Test fehlgeschlagen!\n\n${error.message}\n\n💡 Prüfe:\n- Token hat "Zone:DNS:Edit" Berechtigung\n- Token ist nicht abgelaufen\n- Zone ID ist korrekt (falls angegeben)`
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

