// Initial deployment trigger
// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS (Browser security)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    
    // 1. Check if this is a "Registration Requested" event
    // We only want to send email when status changes to this
    if (record.status !== 'Registration Requested') {
        return new Response(JSON.stringify({ message: "Skipped: Not a registration request" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 2. Prepare Email Content
    const emailHtml = `
      <h2>New Registration Request!</h2>
      <p><strong>Child:</strong> ${record.child_name}</p>
      <p><strong>Parent:</strong> ${record.parent_name}</p>
      <p><strong>Plan:</strong> ${record.selected_package}</p>
      <p><strong>Price:</strong> ${record.package_price}</p>
      <p><strong>Phone:</strong> ${record.phone}</p>
      <br/>
      <a href="${record.payment_proof_url}">View Payment Proof</a>
    `

    // 3. Send via Resend
    // Note: 'to' must be YOUR email for testing until you verify a domain on Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', 
        to: ['TUMBLEGYMMYSORE@GMAIL.COM'], // <--- CHANGE THIS TO YOUR EMAIL
        subject: `New Student: ${record.child_name}`,
        html: emailHtml,
      }),
    })

    const data = await res.json()

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
