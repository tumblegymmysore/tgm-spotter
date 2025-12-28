// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { generateWelcomeEmail } from "./templates.ts"
import { sendWhatsAppTrial } from "./whatsapp.ts" // <--- Import the new tool

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const META_PHONE_ID = Deno.env.get('META_PHONE_ID')
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')

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

    // 2. SEND EMAIL (To Admin/You)
    const emailHtml = generateWelcomeEmail(record);
    const emailReq = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', 
        to: ['tumblegymmysore@gmail.com'], 
        subject: `Welcome to The Tumble Gym, ${record.child_name}!`,
        html: emailHtml,
      }),
    });

    // 3. SEND WHATSAPP (To Admin/You)
    // We pass the keys securely
    const whatsappReq = sendWhatsAppTrial(record, META_PHONE_ID!, META_ACCESS_TOKEN!);

    // 4. Wait for BOTH to finish
    const [emailRes, whatsappRes] = await Promise.all([emailReq, whatsappReq]);
    
    const emailData = await emailRes.json();
    console.log("Email Status:", emailRes.status);
    console.log("WhatsApp Status:", whatsappRes.success ? "Sent" : "Failed");

    return new Response(JSON.stringify({ email: emailData, whatsapp: whatsappRes }), {
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
