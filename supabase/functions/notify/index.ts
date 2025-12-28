// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { generateWelcomeEmail } from "./templates.ts"
import { sendWhatsAppTrial } from "./whatsapp.ts"
import { validatePhone, MESSAGES } from "./utils.ts" // <--- Import your tools

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()
    
// Import the new functions
import { validateMobile, validateAnyPhone, MESSAGES } from "./utils.ts" 

// ... inside serve(async (req) => { ...

    // ---------------------------------------------------------
    // 1. VALIDATION: Phone Numbers
    // ---------------------------------------------------------
    
    // A. Primary Mobile (Strict)
    if (!validateMobile(record.phone)) {
      console.error(`Invalid Mobile: ${record.phone}`);
      return new Response(JSON.stringify({ error: MESSAGES.MOBILE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // B. Alternate Phone (Flexible) - Only check if it exists
    if (record.alternate_phone && !validateAnyPhone(record.alternate_phone)) {
      console.error(`Invalid Alternate Phone: ${record.alternate_phone}`);
      return new Response(JSON.stringify({ error: MESSAGES.ALTERNATE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // ---------------------------------------------------------
    // 2. VALIDATION: Duplicate Check
    // ---------------------------------------------------------
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { data: duplicates } = await supabase
      .from('leads') 
      .select('id')
      .eq('child_name', record.child_name)
      .eq('dob', record.dob)
      .eq('email', record.email) // Ensure this matches your DB Column
      .neq('id', record.id || -1) 
    
    if (duplicates && duplicates.length > 0) {
       console.log("Duplicate submission detected.");
       return new Response(JSON.stringify({ error: MESSAGES.DUPLICATE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, 
      });
    }

    // ---------------------------------------------------------
    // 3. LOGIC: Trial Only
    // ---------------------------------------------------------
    if (record.status !== 'Pending Trial') {
        return new Response(JSON.stringify({ message: MESSAGES.NOT_TRIAL }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // ---------------------------------------------------------
    // 4. ACTION: Send Notifications
    // ---------------------------------------------------------
    const emailHtml = generateWelcomeEmail(record);
    
    // Send Email
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

    // Send WhatsApp
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
