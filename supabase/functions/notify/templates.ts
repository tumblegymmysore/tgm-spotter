// supabase/functions/notify/templates.ts

export const generateWelcomeEmail = (data: any) => {
  // Format Date of Birth nicely
  const dobDate = new Date(data.dob);
  const formattedDOB = dobDate.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Calculate Age
  const ageDiffMs = Date.now() - dobDate.getTime();
  const ageDate = new Date(ageDiffMs);
  const age = Math.abs(ageDate.getUTCFullYear() - 1970);

  // Marketing Badge
  const consentBadge = data.marketing_consent 
    ? `<span style="background-color: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">YES</span>` 
    : `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">NO</span>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Basic Reset */
          body { font-family: Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e4e4e7; }
          
          /* Header */
          .header { background-color: #2563eb; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }

          /* Content Body */
          .body-content { padding: 30px; line-height: 1.6; color: #374151; }
          .welcome-text { margin-bottom: 25px; font-size: 15px; }

          /* Data Tables - The Reliable Way */
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
          .info-table th { text-align: left; padding: 12px 15px; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f1f5f9; width: 35%; }
          .info-table td { padding: 12px 15px; font-size: 14px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }

          /* Section Headers */
          .section-label { font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 20px 0 8px 0; letter-spacing: 0.5px; }

          /* Next Steps Box */
          .next-steps { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin-top: 30px; border-radius: 4px; }
          .next-steps h3 { margin-top: 0; color: #1e3a8a; font-size: 16px; }
          .next-steps ul { margin-bottom: 0; padding-left: 20px; }
          .next-steps li { margin-bottom: 8px; font-size: 14px; color: #1e40af; }

          /* Declaration/Footer */
          .declaration { margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tumble Gym Mysore</h1>
            <p>Trial Request Confirmed</p>
          </div>

          <div class="body-content">
            <div class="welcome-text">
              <strong>Dear ${data.parent_name},</strong><br><br>
              Thank you for registering your child, <strong>${data.child_name}</strong>, for a trial session at The Tumble Gym, Mysore! We are excited to welcome your child and introduce them to the wonderful world of gymnastics.
            </div>

            <div class="section-label">Student Profile</div>
            <table class="info-table">
              <tr>
                <th>Child Name</th>
                <td>${data.child_name}</td>
              </tr>
              <tr>
                <th>DOB (Age)</th>
                <td>${formattedDOB} &nbsp; <strong>(${age} Yrs)</strong></td>
              </tr>
              <tr>
                <th>Gender</th>
                <td>${data.gender}</td>
              </tr>
              <tr style="background-color: #fef2f2;">
                <th style="background-color: #fee2e2; color: #991b1b;">Medical Info</th>
                <td style="color: #991b1b;">${data.medical_info || 'None'}</td>
              </tr>
            </table>

            <div class="section-label">Parent & Contact</div>
            <table class="info-table">
              <tr>
                <th>Parent Name</th>
                <td>${data.parent_name}</td>
              </tr>
              <tr>
                <th>Mobile</th>
                <td><a href="tel:+91${data.phone}" style="text-decoration:none; color:#2563eb;">+91 ${data.phone}</a></td>
              </tr>
              <tr>
                <th>Email</th>
                <td>${data.email}</td>
              </tr>
              <tr>
                <th>Address</th>
                <td>${data.address || 'N/A'}</td>
              </tr>
               <tr>
                <th>Alternate No.</th>
                <td>${data.alternate_phone || 'N/A'}</td>
              </tr>
            </table>

             <div class="section-label">Registration Details</div>
            <table class="info-table">
              <tr>
                <th>Intent/Goal</th>
                <td>${data.intent}</td>
              </tr>
              <tr>
                <th>Source</th>
                <td>${data.source}</td>
              </tr>
              <tr>
                <th>Marketing</th>
                <td>${consentBadge} (Communication Consent)</td>
              </tr>
            </table>

            <div class="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                <li><strong>Preparation:</strong> Please ensure your child wears comfortable clothing suitable for physical activity (e.g., shorts/leggings and a t-shirt).</li>
                <li><strong>Arrival:</strong> Plan to arrive 10 minutes early to settle in.</li>
              </ul>
              <p style="font-size: 13px; margin-top: 15px; color: #1e3a8a;">
                If you have any questions, contact us at <strong>+91 8618684685</strong>.
              </p>
            </div>

            <div class="declaration">
              <p><strong>Declaration & Waiver:</strong> By submitting this request, you have acknowledged the inherent risks of physical activity and released The Tumble Gym from liability as per the terms agreed upon during registration.</p>
              <p>We look forward to seeing you and your child soon!<br>Warm regards, The Tumble Gym Team</p>
            </div>

          </div>
        </div>
      </body>
    </html>
  `;
};
