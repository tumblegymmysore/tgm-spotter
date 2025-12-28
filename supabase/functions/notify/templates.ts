// supabase/functions/notify/templates.ts

export const generateWelcomeEmail = (data: any) => {
  // Format Date of Birth nicely
  const dobDate = new Date(data.dob);
  const formattedDOB = dobDate.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Calculate Age roughly
  const ageDiffMs = Date.now() - dobDate.getTime();
  const ageDate = new Date(ageDiffMs);
  const age = Math.abs(ageDate.getUTCFullYear() - 1970);

  // Marketing Badge Logic
  const consentBadge = data.marketing_consent 
    ? `<span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 99px; font-size: 12px; font-weight: bold;">✅ Communication Allowed</span>` 
    : `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 99px; font-size: 12px; font-weight: bold;">❌ No Marketing</span>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
          
          /* Compact Contact Bar */
          .contact-bar { background: #eff6ff; padding: 12px; text-align: center; font-size: 14px; color: #1e3a8a; border-bottom: 1px solid #dbeafe; font-weight: 600; }
          .contact-bar span { margin: 0 8px; }

          .content { padding: 30px; }
          .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 8px; margin-top: 20px; }
          .data-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
          .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .label { font-weight: 600; color: #64748b; font-size: 14px; }
          .value { font-weight: 500; color: #0f172a; font-size: 14px; text-align: right; }

          .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background-color: #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.child_name}</h1>
            <p>New Trial Request</p>
          </div>

          <div class="contact-bar">
             ${data.parent_name} <span>•</span> <a href="https://wa.me/91${data.phone}" style="text-decoration:none; color:#1e3a8a;">+91 ${data.phone}</a> <span>•</span> ${data.email}
          </div>

          <div class="content">
            <div class="section-title">Child Details</div>
            <div class="data-box">
              <div class="row"><span class="label">Age</span> <span class="value">${age} Years</span></div>
              <div class="row"><span class="label">Date of Birth</span> <span class="value">${formattedDOB}</span></div>
              <div class="row"><span class="label">Gender</span> <span class="value">${data.gender}</span></div>
            </div>

            <div class="section-title">Contact & Address</div>
            <div class="data-box">
              <div class="row">
                <span class="label">Alternate No.</span> 
                <span class="value">${data.alternate_phone || 'None'}</span>
              </div>
              <div class="row" style="flex-direction:column; gap:4px; text-align:left;">
                <span class="label">Address</span> 
                <span class="value" style="text-align:left; line-height:1.4;">${data.address || 'Not Provided'}</span>
              </div>
            </div>

            <div class="section-title">Marketing Data</div>
            <div class="data-box">
              <div class="row"><span class="label">Source</span> <span class="value">${data.source || 'Unknown'}</span></div>
              <div class="row"><span class="label">Intent</span> <span class="value">${data.intent || 'Not Specified'}</span></div>
              <div class="row"><span class="label">Consent</span> <span class="value">${consentBadge}</span></div>
            </div>

            <div class="section-title" style="color:#ef4444;">Medical Info</div>
            <div class="data-box" style="background:#fef2f2; border-color:#fecaca;">
              <p style="margin:0; font-size:14px; color:#991b1b;">${data.medical_info || 'None'}</p>
            </div>

          </div>
          <div class="footer">
            Sent automatically by Tumble Gym Spotter System
          </div>
        </div>
      </body>
    </html>
  `
}
