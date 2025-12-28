// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Import the template from the file next door
import { generateWelcomeEmail } from "./templates.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()
    
    // 1. Filter: Only send for Trial Requests
    if (record.status !== 'Pending Trial') {
        return new Response(JSON.stringify({ message: "Skipped: Not a trial request" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 2. Generate Content using the Template
    const emailHtml = generateWelcomeEmail(record);

    // 3. SEND EMAIL (Hardcoded to Admin for now)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', 
        to: ['tumblegymmysore@gmail.com'], // <--- FORCED TO ADMIN
        subject: `Welcome to The Tumble Gym, ${record.child_name}!`,
        html: emailHtml,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
        console.error("Resend Error:", JSON.stringify(data));
        throw new Error("Failed to send email");
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
