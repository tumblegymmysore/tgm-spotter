// supabase/functions/notify/whatsapp.ts

export const sendWhatsAppTrial = async (record: any, phoneId: string, token: string) => {
  
  // 1. Define Admin Numbers (Must be verified in Test Mode)
  // Format: Country code + Number (No + or spaces)
  const adminNumbers = [
      '919886925225', // Number 1 (Yours)
      '919444897281'  // Number 2 (Your verified partner)
  ];

  // 2. Loop through numbers and send the "Hello World" template
  // (We use Hello World first because it ALWAYS works. Once this pings your phone,
  // we can switch to a custom template with the child's name.)
  
  const sendPromises = adminNumbers.map(async (number) => {
      const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
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
      return res.json();
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
