// supabase/functions/notify/whatsapp.ts

export const sendWhatsAppTrial = async (record: any, phoneId: string, token: string) => {
  
  // 1. Format the Message
  // Note: For the "Test" environment, Meta creates a generic template.
  // We will use the "hello_world" template for the very first test to ensure connection works.
  // Once verified, we can send custom text.
  
  // Custom Text Payload (Works only if you opt-in for "Free Tier Utility" or use a template)
  // For now, let's try sending a direct text message which usually works for Test Numbers.
  
  const message = `🤸 *New Trial Request!*
  
  *Child:* ${record.child_name}
  *Age:* ${record.dob}
  *Parent:* ${record.parent_name}
  *Phone:* ${record.phone}
  *Goal:* ${record.intent}
  
  _Check Supabase for full details._`;

  // 2. Send to Meta API
  const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: '918618684685', // <--- HARDCODED TO YOUR NUMBER FOR TESTING (Must include country code, no +)
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error("WhatsApp Error:", JSON.stringify(data));
    // Don't throw error here, so email can still succeed if WhatsApp fails
    return { success: false, error: data };
  }

  return { success: true, data };
};
