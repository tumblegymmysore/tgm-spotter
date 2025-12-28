// supabase/functions/notify/templates.ts

export const generateWelcomeEmail = (record: any) => {
  // 1. Receipt Section (The Data)
  const receiptHtml = `
    <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-family: sans-serif; font-size: 14px; color: #475569;">
      <h3 style="margin-top: 0; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px;">📋 Submission Receipt</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 5px 0; font-weight: bold;">Reference ID:</td><td>${record.id}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Child Name:</td><td>${record.child_name}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Date of Birth:</td><td>${record.dob}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Gender:</td><td>${record.gender}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Parent Name:</td><td>${record.parent_name}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Goal:</td><td>${record.intent}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Medical Info:</td><td>${record.medical_info}</td></tr>
        <tr><td style="padding: 5px 0; font-weight: bold;">Source:</td><td>${record.how_heard}</td></tr>
      </table>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cbd5e1;">
        <p style="margin: 0; font-weight: bold; color: #059669;">✅ Declarations Accepted</p>
        <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 12px; color: #64748b;">
          <li>Parent/Guardian Confirmation</li>
          <li>Risk Acknowledgement & Liability Waiver</li>
          <li>Medical Fitness Declaration</li>
          <li>Media Consent Agreement</li>
          <li>Policy & Non-Refundable Fee Agreement</li>
        </ul>
        <p style="margin-top: 10px; font-size: 12px;">Accepted on: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;

  // 2. Main Email Body (The Message)
  return `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #e11d48;">Welcome to The Tumble Gym!</h2>
      </div>
      
      <p>Dear ${record.parent_name},</p>
      
      <p>Thank you for registering your child, <strong>${record.child_name}</strong>, for a trial session at The Tumble Gym, Mysore! We are excited to welcome your child and introduce them to the wonderful world of gymnastics.</p>
      
      <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 15px; margin: 20px 0;">
        <strong style="color: #9f1239;">Next Steps:</strong>
        <ul style="margin-bottom: 0;">
          <li><strong>Preparation:</strong> Please ensure your child wears comfortable clothing suitable for physical activity (e.g., shorts/leggings and a t-shirt).</li>
          <li><strong>Arrival:</strong> Plan to arrive 10 minutes early to settle in.</li>
        </ul>
      </div>

      <p>If you have any questions or need to reschedule, please do not hesitate to contact us at <a href="mailto:tumblegymmysore@gmail.com" style="color: #e11d48;">tumblegymmysore@gmail.com</a> or <strong>+91 8618684685</strong>.</p>
      
      <p>We look forward to seeing you and your child soon!</p>
      
      <p>Warm regards,<br/>
      <strong>The Tumble Gym Team</strong></p>
      
      ${receiptHtml}
      
      <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 30px;">
        This message was sent to ${record.email} as part of your registration.
      </p>
    </div>
  `;
};
