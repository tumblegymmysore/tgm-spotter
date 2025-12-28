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
          
          /* NEXT STEPS BOX */
          .next-steps { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .next-steps h3 { margin-top: 0; color: #1e3a8a; font-size: 16px; margin-bottom: 10px; }
          .next-steps ul { margin-bottom: 0; padding-left: 20px; margin-top: 0; }
          .next-steps li { margin-bottom: 8px; font-size: 14px; color: #1e40af; }

          /* Closing Text */
          .closing-text { margin: 20px 0 30px 0; font-size: 14px; color: #4b5563; }
          .closing-text a { color: #2563eb; text-decoration: none; font-weight: bold; }

          /* DIVIDER for Reference Section */
          .reference-header { background-color: #f1f5f9; padding: 10px 15px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-top: 2px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-top: 10px; margin-bottom: 15px; }

          /* Data Tables */
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
          .info-table th { text-align: left; padding: 10px 15px; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; width: 35%; }
          .info-table td { padding: 10px 15px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }

          /* Footer */
          .declaration { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tumble Gym Mysore</h1>
            <p>Trial Request Confirmed</p>
          </div>

          <div class="body-content">
            <div>
              <strong>Dear ${data.parent_name},</strong><br><br>
              Thank you for registering your child, <strong>${data.child_name}</strong>, for a trial session at The Tumble Gym, Mysore! We are excited to welcome your child and introduce them to the wonderful world of gymnastics.
            </div>

            <div class="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                <li><strong>Preparation:</strong> Please ensure your child wears comfortable clothing suitable for physical activity (e.g., shorts/leggings and a t-shirt).</li>
                <li><strong>Arrival:</strong> Plan to arrive 10 minutes early to settle in.</li>
              </ul>
            </div>

            <div class="closing-text">
              If you have any questions or need to reschedule, please do not hesitate to contact us at 
              <a href="mailto:tumblegymmysore@gmail.com">tumblegymmysore@gmail.com</a> or 
              <a href="tel:+918618684685">+91 8618684685</a>.
              <br><br>
              We look forward to seeing you and your child soon!
              <br><br>
              <strong>Warm regards,<br>The Tumble Gym Team</strong>
            </div>

            <div class="reference-header">Submission Reference Details</div>

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

            <table class="info-table">
              <tr>
                <th>Parent Name</th>
                <td>${data.parent_name}</td>
              </tr>
              <tr>
                <th>Mobile</th>
                <td>+91 ${data.phone}</td>
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

            <div class="declaration">
              <p><strong>Declaration & Waiver:</strong> By submitting this request, you have acknowledged the inherent risks of physical activity and released The Tumble Gym from liability as per the terms agreed upon during registration.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>

          </div>
        </div>
      </body>
    </html>
  `;
};
