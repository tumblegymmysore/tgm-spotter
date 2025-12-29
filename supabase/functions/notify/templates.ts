// supabase/functions/notify/templates.ts

// 1. WELCOME EMAIL (Updated with Trial Slot)
export const generateWelcomeEmail = (data: any) => {
  const dobDate = new Date(data.dob);
  const formattedDOB = dobDate.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  const ageDiffMs = Date.now() - dobDate.getTime();
  const age = Math.abs(new Date(ageDiffMs).getUTCFullYear() - 1970);
  const consentBadge = data.marketing_consent 
    ? `<span style="background-color: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">YES</span>` 
    : `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">NO</span>`;

  // --- NEW: Parse Trial Slot ---
  let trialInfoHTML = "";
  if (data.trial_scheduled_slot) {
      if (data.trial_scheduled_slot.includes('Adult')) {
          // Adult Case
          trialInfoHTML = `
            <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #9a3412; font-size: 16px;">Appointment Required</h3>
                <p style="margin-bottom: 5px; color: #9a3412; font-size: 14px;">Since you are enrolling as an Adult for Evening sessions, please contact us to schedule your specific PT slot.</p>
                <a href="https://wa.me/918618684685" style="display:inline-block; margin-top:10px; background:#ea580c; color:white; text-decoration:none; padding:8px 15px; border-radius:4px; font-weight:bold; font-size:12px;">Message on WhatsApp</a>
            </div>
          `;
      } else {
          // Scheduled Slot Case
          try {
            const parts = data.trial_scheduled_slot.split('|');
            const isoDate = parts[0].trim();
            const time = parts[1].trim();
            const dateObj = new Date(isoDate);
            const dateReadable = dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' });
            
            trialInfoHTML = `
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center;">
                  <div style="color: #1e3a8a; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Confirmed Trial Slot</div>
                  <div style="color: #2563eb; font-size: 20px; font-weight: bold; margin: 5px 0;">${dateReadable}</div>
                  <div style="color: #1e40af; font-size: 18px;">@ ${time}</div>
                  <div style="margin-top:10px; font-size:12px; color:#60a5fa;">Please arrive 10 minutes early!</div>
              </div>
            `;
          } catch (e) {
             console.error("Error parsing slot", e);
          }
      }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e4e4e7; }
          .header { background-color: #2563eb; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
          .body-content { padding: 30px; line-height: 1.6; color: #374151; }
          .next-steps { background-color: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 4px; border: 1px solid #e2e8f0; }
          .next-steps h3 { margin-top: 0; color: #334155; font-size: 16px; margin-bottom: 10px; }
          .next-steps ul { margin-bottom: 0; padding-left: 20px; margin-top: 0; }
          .next-steps li { margin-bottom: 8px; font-size: 14px; color: #475569; }
          .closing-text { margin: 20px 0 30px 0; font-size: 14px; color: #4b5563; }
          .closing-text a { color: #2563eb; text-decoration: none; font-weight: bold; }
          .reference-header { background-color: #f1f5f9; padding: 10px 15px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-top: 2px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-top: 10px; margin-bottom: 15px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
          .info-table th { text-align: left; padding: 10px 15px; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; width: 35%; }
          .info-table td { padding: 10px 15px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }
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
              Thank you for registering your child, <strong>${data.child_name}</strong>, for a trial session at The Tumble Gym, Mysore!
            </div>
            
            ${trialInfoHTML}

            <div class="next-steps">
              <h3>Important Instructions:</h3>
              <ul>
                <li><strong>Clothing:</strong> Comfortable sportswear (shorts/leggings & t-shirt). No zippers/buttons.</li>
                <li><strong>Water:</strong> Please bring a water bottle.</li>
                <li><strong>Arrival:</strong> Plan to arrive 10 minutes early to settle in.</li>
              </ul>
            </div>
            <div class="closing-text">
              Questions? <a href="mailto:tumblegymmysore@gmail.com">tumblegymmysore@gmail.com</a> or <a href="tel:+918618684685">+91 8618684685</a>.
              <br><br>We look forward to seeing you!<br><strong>The Tumble Gym Team</strong>
            </div>
            <div class="reference-header">Submission Reference Details</div>
            <table class="info-table">
              <tr><th>Child Name</th><td>${data.child_name}</td></tr>
              <tr><th>DOB (Age)</th><td>${formattedDOB} <strong>(${age} Yrs)</strong></td></tr>
              <tr><th>Gender</th><td>${data.gender}</td></tr>
              <tr style="background-color: #fef2f2;"><th style="background-color: #fee2e2; color: #991b1b;">Medical Info</th><td style="color: #991b1b;">${data.medical_info || 'None'}</td></tr>
            </table>
            <table class="info-table">
              <tr><th>Parent Name</th><td>${data.parent_name}</td></tr>
              <tr><th>Mobile</th><td>+91 ${data.phone}</td></tr>
              <tr><th>Email</th><td>${data.email}</td></tr>
            </table>
            <div class="declaration">
              <p><strong>Declaration:</strong> By submitting, you acknowledge inherent risks and release The Tumble Gym from liability.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// 2. TRIAL FEEDBACK EMAIL (Preserved)
export const generateFeedbackEmail = (data: any) => {
  const isSpecial = data.special_needs;
  const isPT = data.pt_recommended;
  const feedback = data.feedback && data.feedback.trim() !== "" ? data.feedback : "";

  // 1. Define Visual Blocks
  const ptBlock = `<div style="background-color:#fefce8; border:1px solid #fde047; padding:12px; margin-top:10px; border-radius:6px; color:#854d0e; font-size:14px; font-weight:bold;">✨ Personal Training Recommended</div>`;
  const specialBlock = `<div style="background-color:#f3e8ff; border:1px solid #d8b4fe; padding:12px; margin-top:10px; border-radius:6px; color:#6b21a8; font-size:14px; font-weight:bold;">🌟 Special Needs / Adapted Program</div>`;
  const batchBlock = `
    <hr style="border:0; border-top:1px solid #bbf7d0; margin:15px 0;">
    <div style="font-size:14px;">
      <strong>Recommended Batch:</strong><br>
      <span style="font-size:16px; color:#166534;">${data.recommended_batch}</span>
    </div>`;

  // 2. Logic Engine
  let recommendationHTML = "";

  if (isSpecial) {
      if (isPT) {
          recommendationHTML = specialBlock + ptBlock;
      } else {
          recommendationHTML = specialBlock + batchBlock;
      }
  } else {
      if (isPT) {
          recommendationHTML = ptBlock;
      } else {
          recommendationHTML = batchBlock;
      }
  }

  // 3. Feedback Text
  const feedbackHTML = feedback 
    ? `<p><em>"${feedback}"</em></p>`
    : `<p style="color:#64748b; font-style:italic; font-size:13px;">(Assessment completed)</p>`;

  // 4. Skills Badges
  const skills = data.skills_rating || {};
  let skillsHtml = "";
  const activeSkills = [];
  if (skills.listening) activeSkills.push("Listening");
  if (skills.flexibility) activeSkills.push("Flexibility");
  if (skills.strength) activeSkills.push("Strength");
  if (skills.balance) activeSkills.push("Balance");

  if (activeSkills.length > 0) {
     const tags = activeSkills.map(s => 
       `<span style="display:inline-block; background:white; border:1px solid #16a34a; color:#16a34a; padding:2px 8px; border-radius:12px; font-size:11px; margin-right:4px; margin-bottom:4px; font-weight:600;">${s}</span>`
     ).join("");
     skillsHtml = `<div style="margin-top:15px; padding-top:15px; border-top:1px dashed #bbf7d0;"><strong style="color:#15803d; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Strengths Observed:</strong>${tags}</div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; background: #f4f4f5; color: #333; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; }
          .header { background-color: #16a34a; padding: 30px; text-align: center; color: white; }
          .content { padding: 30px; }
          .score-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .btn-container { text-align: center; margin-top: 30px; }
          .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Trial Completed!</h1>
            <p>Great job, ${data.child_name}!</p>
          </div>
          <div class="content">
            <p><strong>Dear ${data.parent_name},</strong></p>
            <p>It was wonderful having ${data.child_name} at The Tumble Gym today! Our trainers have completed their assessment.</p>
            
            <div class="score-card">
              <h3 style="margin-top:0; color:#15803d; margin-bottom:10px;">Assessment Results</h3>
              ${feedbackHTML}
              ${skillsHtml}
              ${recommendationHTML}
            </div>

            <p>We would love to see ${data.child_name} continue their gymnastics journey with us!</p>
            
            <div class="btn-container">
                <a href="https://tumblegymmysore.github.io/tgm-spotter/" class="btn">Proceed to Registration</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};
