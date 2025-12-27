// Redeploying with JWT verification disabled
// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    
    // 1. DETERMINE EMAIL TYPE
    // If it's neither a Trial nor a Registration, we skip sending an email.
    const isTrial = record.status === 'Pending Trial';
    const isRegistration = record.status === 'Registration Requested';

    if (!isTrial && !isRegistration) {
        return new Response(JSON.stringify({ message: "Skipped: Status not relevant" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 2. CUSTOMIZE CONTENT
    const subject = isTrial 
        ? `🤸 New Trial Request: ${record.child_name}` 
        : `💰 Payment Verification Needed: ${record.child_name}`;

    const emailHtml = `
      <h2>${isTrial ? "New Free Trial Request" : "New Registration Payment"}</h2>
      <p><strong>Child:</strong> ${record.child_name}</p>
      <p><strong>Parent:</strong> ${record.parent_name}</p>
      <p><strong>Phone:</strong> ${record.phone}</p>
      <p><strong>Status:</strong> ${record.status}</p>
      ${isRegistration ? `<p><strong>Plan:</strong> ${record.selected_package}</p>` : ''}
      ${isRegistration ? `<p><strong>Price:</strong> ${record.package_price}</p>` : ''}
      <br/>
      ${isRegistration ? `<a href="${record.payment_proof_url}" style="padding:10px; background:blue; color:white;">View Payment Proof</a>` : ''}
    `

    // 3. SEND EMAIL
    // IMPORTANT: 'to' must be the email you used to sign up for Resend (until you verify a domain)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', 
        to: ['TUMBLEGYMMYSORE@GMAIL.COM'], // <--- MAKE SURE THIS IS YOUR EMAIL
        subject: subject,
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
