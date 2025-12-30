// supabase/functions/notify/whatsapp.ts

export const sendWhatsAppTrial = async (record: any, phoneId: string, token: string) => {
  
  // 1. Define Admin Numbers (Must be verified in Test Mode)
  // Format: Country code + Number (No + or spaces)
  const adminNumbers = [
      '919444897281', // Number 1 (Yours)
      '919886925225'  // Number 2 (Your verified partner)
  ];

  // 2. Send WhatsApp notification with gymnastics-themed message
  // Format: Country code + Number (No + or spaces)
  
  const message = `🎉 *New Trial Request at Tumble Gym!* 🌟

👶 *Child:* ${record.child_name}
👨‍👩‍👧‍👦 *Parent:* ${record.parent_name}
📞 *Phone:* +91 ${record.phone}
📧 *Email:* ${record.email}
📅 *Trial Slot:* ${record.trial_scheduled_slot || 'To be scheduled'}

We're so excited to welcome ${record.child_name} to our gymnastics family! 🎪✨

Please review and confirm the trial slot. Let's help this little champion shine! 🏆`;

  const sendPromises = adminNumbers.map(async (number) => {
      // Try to send as text message first (if template not needed)
      try {
          const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: number,
              type: 'text',
              text: {
                body: message
              }
            }),
          });
          const result = await res.json();
          
          // If text message fails, fall back to template
          if (result.error) {
              console.log(`Text message failed, trying template for ${number}`);
              const templateRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: number, 
                  type: 'template',
                  template: {
                      name: 'hello_world',
                      language: { code: 'en_US' }
                  }
                }),
              });
              return templateRes.json();
          }
          return result;
      } catch (error) {
          console.error(`WhatsApp send error for ${number}:`, error);
          // Fallback to template
          const templateRes = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: number, 
              type: 'template',
              template: {
                  name: 'hello_world',
                  language: { code: 'en_US' }
              }
            }),
          });
          return templateRes.json();
      }
  });

  const results = await Promise.all(sendPromises);

  // 3. Log errors if any
  const errors = results.filter((r: any) => r.error);
  if (errors.length > 0) {
    console.error("WhatsApp Error:", JSON.stringify(errors));
    return { success: false, errors };
  }

  return { success: true, results };
};
