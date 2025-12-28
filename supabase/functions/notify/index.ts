// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1" // <--- Added Supabase Client
import { generateWelcomeEmail } from "./templates.ts"
import { sendWhatsAppTrial } from "./whatsapp.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const META_PHONE_ID = Deno.env.get('META_PHONE_ID')
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')

// Automatically available in Supabase Edge Functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()
    
    // ---------------------------------------------------------
    // VALIDATION 1: Phone Number (10 digits, numeric only)
    // ---------------------------------------------------------
    const cleanPhone = record.phone.replace(/\D/g, ''); // Remove non-numbers
    const isValidPhone = /^[0-9]{10}$/.test(cleanPhone);

    if (!isValidPhone) {
      console.error(`Invalid Phone: ${record.phone}`);
      return new Response(JSON.stringify({ error: "Phone number must be exactly 10 digits." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // ---------------------------------------------------------
    // VALIDATION 2: Duplicate Check (Soft Check)
    // ---------------------------------------------------------
    // We check if this child is already in the system to avoid spamming you.
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    // Note: Replace 'leads' with your actual table name if different
    const { data: duplicates } = await supabase
      .from('leads') 
      .select('id')
      .eq('child_name', record.child_name)
      .eq('dob', record.dob)
      .eq('parent_email', record.parent_email)
      .neq('id', record.id || -1) // Don't count "self" if this record is already saved
    
    if (duplicates && duplicates.length > 0) {
       console.log("Duplicate submission detected. Skipping notifications.");
       return new Response(JSON.stringify({ message: "Duplicate detected. No notification sent." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // We return 200 so the frontend doesn't crash, but we do nothing.
      });
    }

    // ---------------------------------------------------------
    // LOGIC: Only proceed for "Pending Trial"
    // ---------------------------------------------------------
    if (record.status !== 'Pending Trial') {
        return new Response(JSON.stringify({ message: "Skipped: Not a trial request" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // ---------------------------------------------------------
    // ACTION: Send Notifications
    // ---------------------------------------------------------
    
    // 1. Send Email
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

    // 2. Send WhatsApp
    const whatsappReq = sendWhatsAppTrial(record, META_PHONE_ID!, META_ACCESS_TOKEN!);

    // Wait for both
    const [emailRes, whatsappRes] = await Promise.all([emailReq, whatsappReq]);
    const emailData = await emailRes.json();

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
