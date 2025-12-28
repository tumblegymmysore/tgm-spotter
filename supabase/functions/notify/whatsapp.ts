//test 
// supabase/functions/notify/whatsapp.ts

export const sendWhatsAppTrial = async (record: any, phoneId: string, token: string) => {
  
  // 1. Define your Admin Numbers here (Must be verified in Dashboard)
  // Format: Country code + Number (No + or spaces)
  const adminNumbers = [
      '919444897281', // Number 1 (Yours)
      '919886925225'  // Number 2 (Add the second verified number here)
  ];

  const message = `🤸 *New Trial Request!*
  
  *Child:* ${record.child_name}
  *Age:* ${record.dob}
  *Parent:* ${record.parent_name}
  *Phone:* ${record.phone}
  *Goal:* ${record.intent}
  
  _Check Supabase for full details._`;

  // 2. Create a "Send" promise for EACH number
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
          type: 'text',
          text: { body: message },
        }),
      });
      return res.json();
  });

  // 3. Wait for ALL messages to be sent
  const results = await Promise.all(sendPromises);

  // Check if any failed
  const errors = results.filter((r: any) => r.error);
  if (errors.length > 0) {
    console.error("Some WhatsApp messages failed:", JSON.stringify(errors));
    return { success: false, errors };
  }

  return { success: true, results };
};
