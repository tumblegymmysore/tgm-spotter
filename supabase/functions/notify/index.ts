// supabase/functions/notify/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { generateWelcomeEmail, generateFeedbackEmail } from "./templates.ts" // Added Feedback Template
import { sendWhatsAppTrial } from "./whatsapp.ts"
import { validateMobile, validateAnyPhone, MESSAGES } from "./utils.ts" 

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
    
    // =========================================================
    // SCENARIO A: REGISTRATION NOTIFICATION (New Payment)
    // =========================================================
    if (record.type === 'registration_notification') {
        console.log(`Processing Registration Notification for: ${record.child_name}`);
        
        const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; background: #f4f4f5; color: #333; }
              .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e4e4e7; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%); padding: 30px; text-align: center; color: white; }
              .content { padding: 30px; }
              .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🎉 New Registration Payment!</h1>
              </div>
              <div class="content">
                <p><strong>Dear Admin,</strong></p>
                <p>A new registration payment has been submitted and requires your verification!</p>
                <div class="info-box">
                  <p><strong>Child:</strong> ${record.child_name}</p>
                  <p><strong>Parent:</strong> ${record.parent_name}</p>
                  <p><strong>Phone:</strong> +91 ${record.phone}</p>
                  <p><strong>Email:</strong> ${record.email}</p>
                  <p><strong>Package:</strong> ${record.package}</p>
                  <p><strong>Amount:</strong> ₹${record.total_amount}</p>
                  <p><strong>Payment Mode:</strong> ${record.payment_mode}</p>
                </div>
                <p>Please log in to the admin dashboard to verify and approve this registration.</p>
              </div>
            </div>
          </body>
        </html>
        `;
        
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: ['tumblegymmysore@gmail.com'],
            subject: `💰 New Registration Payment: ${record.child_name}`,
            html: emailHtml,
          }),
        });
        
        const emailData = await emailRes.json();
        return new Response(JSON.stringify({ message: "Notification Sent", data: emailData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    
    // =========================================================
    // SCENARIO B: TRAINER FEEDBACK (Skip Validations)
    // =========================================================
    if (record.type === 'feedback_email') {
        console.log(`Processing Feedback Email for: ${record.child_name}`);

        const emailHtml = generateFeedbackEmail(record);
        
        // Send Feedback Email ONLY (No WhatsApp for now)
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev', 
            to: ['tumblegymmysore@gmail.com'], // Hardcoded as per your request
            subject: `Trial Feedback: ${record.child_name} 🤸`,
            html: emailHtml,
          }),
        });

        const emailData = await emailRes.json();
        return new Response(JSON.stringify({ message: "Feedback Sent", data: emailData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // =========================================================
    // SCENARIO B: NEW REGISTRATION (Run Strict Validations)
    // =========================================================

    // 1. VALIDATION: Phone Numbers
    // ---------------------------------------------------------
    // A. Primary Mobile (Strict 10 digits)
    if (!validateMobile(record.phone)) {
      console.error(`Invalid Mobile: ${record.phone}`);
      return new Response(JSON.stringify({ error: MESSAGES.MOBILE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // B. Alternate Phone (Flexible: 10 digits OR 11 digits with 0)
    if (record.alternate_phone && !validateAnyPhone(record.alternate_phone)) {
      console.error(`Invalid Alternate Phone: ${record.alternate_phone}`);
      return new Response(JSON.stringify({ error: MESSAGES.ALTERNATE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 2. VALIDATION: Duplicate Check
    // ---------------------------------------------------------
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { data: duplicates } = await supabase
      .from('leads') 
      .select('id')
      .eq('child_name', record.child_name)
      .eq('dob', record.dob)
      .eq('email', record.email)
      .neq('id', record.id || -1) 
    
    if (duplicates && duplicates.length > 0) {
       console.log("Duplicate submission detected.");
       return new Response(JSON.stringify({ error: MESSAGES.DUPLICATE_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, 
      });
    }

    // 3. LOGIC: Ensure it is a Pending Trial
    // ---------------------------------------------------------
    // We only send the "Welcome" email if the status is strictly 'Pending Trial'
    if (record.status !== 'Pending Trial') {
        return new Response(JSON.stringify({ message: MESSAGES.NOT_TRIAL }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // 4. ACTION: Send Welcome Notifications
    // ---------------------------------------------------------
    const emailHtml = generateWelcomeEmail(record);
    
    // Send Welcome Email to Parent AND Admin
    const emailReq = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', 
        to: [record.email, 'tumblegymmysore@gmail.com'], // Send to parent AND admin
        subject: `🎉 Trial Confirmed! Welcome to Tumble Gym, ${record.child_name}!`,
        html: emailHtml,
      }),
    });

    // Send Welcome WhatsApp
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
