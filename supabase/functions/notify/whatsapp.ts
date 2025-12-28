// supabase/functions/notify/whatsapp.ts

export const sendWhatsAppTrial = async (record: any, phoneId: string, token: string) => {
  
  const adminNumbers = [
      '918618684685', // Your Verified Number
  ];

  // LOGIC: Using the "hello_world" template is the only way to guarantee delivery 
  // without the user messaging first.
  
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
          type: 'template',   // <--- SWITCHING TO TEMPLATE
          template: {
              name: 'hello_world',
              language: { code: 'en_US' }
          }
        }),
      });
      return res.json();
  });

  const results = await Promise.all(sendPromises);

  const errors = results.filter((r: any) => r.error);
  if (errors.length > 0) {
    console.error("WhatsApp Error:", JSON.stringify(errors));
    return { success: false, errors };
  }

  return { success: true, results };
};
