// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { generateWelcomeEmail } from "./templates.ts"
import { sendWhatsAppTrial } from "./whatsapp.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const META_PHONE_ID = Deno.env.get('META_PHONE_ID')
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()
    
    // ---------------------------------------------------------
    // VALIDATION 1: Phone Number (Strict 10 Digits)
    // ---------------------------------------------------------
    // We strip all non-numbers (spaces, dashes, +91) to check the core digits
    const cleanPhone = record.phone.replace(/\D/g, ''); 
    
    // Regex: Start(^) to End($) must be exactly 10 digits [0-9]
    const isValidPhone = /^[0-9]{10}$/.test(cleanPhone);

    if (!isValidPhone) {
      console.error(`Invalid Phone: ${record.phone}`);
      return new Response(JSON.stringify({ 
        error: "Invalid Phone Number. Please enter exactly 10 digits without spaces or code." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // ---------------------------------------------------------
    // VALIDATION 2: Duplicate Check (The "Gatekeeper")
    // ---------------------------------------------------------
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    // Check if this specific child (Name + DOB + Parent Email) exists
    // We exclude the current record ID (if it was just inserted) to avoid false positives
    const { data: duplicates, error: dbError } = await supabase
      .from('leads') 
      .select('id')
      .eq('child_name', record.child_name)
      .eq('dob', record.dob)
      .eq('parent_email', record.parent_email)
      .neq('id', record.id || -1) 
    
    if (duplicates && duplicates.length > 0) {
       console.log("Duplicate submission detected.");
       
       // 409 Conflict - The Frontend should display this message in Red
       return new Response(JSON.stringify({ 
         error: "This student info is already registered. You cannot take an additional trial session. Please check with Admin, or Login/Register if you have already completed the trial." 
       }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, 
      });
    }

    // ---------------------------------------------------------
    // LOGIC: Only proceed for "Pending Trial"
    // ---------------------------------------------------------
    if (record.status !== 'Pending Trial') {
        return new Response(JSON.stringify({ message: "Skipped: Not a trial request" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // ---------------------------------------------------------
    // ACTION: Send Notifications (If validations pass)
    // ---------------------------------------------------------
    
    // 1. Send Email (To You/Admin)
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
        subject: `New Trial Request: ${record.child_name}`,
        html: emailHtml,
      }),
    });

    // 2. Send WhatsApp (To You/Admin)
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
