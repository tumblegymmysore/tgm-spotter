// supabase/functions/notify/templates.ts

// ==========================================
// 1. WELCOME EMAIL (Fixed: Dress Code, Time, Legal)
// ==========================================
export const generateWelcomeEmail = (data: any) => {
  const dobDate = new Date(data.dob);
  const formattedDOB = dobDate.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
  const ageDiffMs = Date.now() - dobDate.getTime();
  const age = Math.abs(new Date(ageDiffMs).getUTCFullYear() - 1970);
  
  // Consent Badge
  const consentBadge = data.marketing_consent 
    ? `<span style="background-color: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">YES</span>` 
    : `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">NO</span>`;

  // Trial Slot Display Logic
  let trialInfoHTML = "";
  if (data.trial_scheduled_slot) {
      if (data.trial_scheduled_slot.includes('Adult')) {
          // Case: Adult / Appointment Required
          trialInfoHTML = `
            <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #9a3412; font-size: 16px;">Appointment Required</h3>
                <p style="margin-bottom: 5px; color: #9a3412; font-size: 14px;">Since you are enrolling as an Adult, please contact us to schedule your specific slot.</p>
                <a href="https://wa.me/918618684685" style="display:inline-block; margin-top:10px; background:#ea580c; color:white; text-decoration:none; padding:8px 15px; border-radius:4px; font-weight:bold; font-size:12px;">Message on WhatsApp</a>
            </div>`;
      } else {
          // Case: Specific Slot Selected
          try {
            const parts = data.trial_scheduled_slot.split('|');
            const isoDate = parts[0].trim();
            const time = parts[1].trim();
            const dateObj = new Date(isoDate);
            const dateReadable = dateObj.toLocaleDateString("en-IN", { weekday: 'long', day: 'numeric', month: 'long' });
            
            trialInfoHTML = `
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center;">
                  <div style="color: #1e3a8a; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Confirmed Trial Slot</div>
                  <div style="color: #2563eb; font-size: 20px; font-weight: bold; margin: 5px 0;">${dateReadable}</div>
                  <div style="color: #1e40af; font-size: 18px;">@ ${time}</div>
                  <div style="margin-top:10px; font-size:12px; color:#60a5fa;">Please arrive on time.</div>
              </div>`;
          } catch (e) { console.error("Error parsing slot", e); }
      }
  }

  // Handle Declarations Block
  // Uses the formatted string from frontend if available, else a default message.
  const declarationsBlock = data.legal_declarations 
    ? `<pre style="font-family: inherit; font-size: 11px; color: #64748b; white-space: pre-wrap; margin: 0; line-height: 1.4;">${data.legal_declarations}</pre>`
    : `<p><strong>Declaration:</strong> By submitting, you acknowledge inherent risks and release The Tumble Gym from liability.</p>`;

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
          .next-steps { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .next-steps h3 { margin-top: 0; color: #1e3a8a; font-size: 16px; margin-bottom: 10px; }
          .next-steps ul { margin-bottom: 0; padding-left: 20px; margin-top: 0; }
          .next-steps li { margin-bottom: 8px; font-size: 14px; color: #1e40af; }
          .closing-text { margin: 20px 0 30px 0; font-size: 14px; color: #4b5563; }
          .closing-text a { color: #2563eb; text-decoration: none; font-weight: bold; }
          .reference-header { background-color: #f1f5f9; padding: 10px 15px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-top: 2px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-top: 10px; margin-bottom: 15px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
          .info-table th { text-align: left; padding: 10px 15px; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; width: 35%; }
          .info-table td { padding: 10px 15px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }
          .declaration-box { margin-top: 30px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; }
          .declaration-title { font-size: 12px; font-weight: bold; color: #475569; margin-bottom: 8px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 900; position: relative; z-index: 1;">🎉 Welcome to Tumble Gym! 🌟</h1>
            <p style="margin: 10px 0 0; font-size: 18px; position: relative; z-index: 1;">Your Trial Request is Confirmed! ✨</p>
          </div>
          <div class="body-content">
            <div style="font-size: 15px; line-height: 1.7;">
              <p style="font-size: 16px; color: #1e40af; font-weight: bold; margin-bottom: 15px;">Dear ${data.parent_name},</p>
              <p>Thank you so much for registering <strong>${data.child_name}</strong> for a trial session at The Tumble Gym, Mysore! 🎪 We are absolutely <em>thrilled</em> to welcome your little champion and introduce them to the amazing world of gymnastics! 🌈</p>
            </div>
            
            ${trialInfoHTML}

            <div class="next-steps" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 5px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 12px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);">
              <h3 style="margin-top: 0; color: #1e3a8a; font-size: 18px; font-weight: 900; margin-bottom: 15px;">🎯 Important Reminders for Your First Class:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>👕 Dress Code:</strong> Please wear comfortable clothing (shorts/leggings and a t-shirt). No zippers or buttons.</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>⏰ Timing:</strong> Please arrive on time for the session - we can't wait to get started! 🚀</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>💧 Water:</strong> Bring a water bottle to stay hydrated during the fun!</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>🍽️ Food:</strong> Avoid heavy meals 2-3 hours before class. No milk/dairy 1 hour before, and minimal liquids 30 minutes before.</li>
              </ul>
            </div>
            
            <div style="background-color: #fef3c7; border: 2px solid #fcd34d; padding: 20px; margin: 25px 0; border-radius: 12px; text-align: center;">
              <h3 style="margin-top: 0; color: #92400e; font-size: 18px; font-weight: bold;">📍 Find Us at Tumble Gym Mysore!</h3>
              <p style="color: #854d0e; font-size: 14px; margin: 10px 0;">Click below to get directions and navigate to our location:</p>
              <a href="https://maps.google.com/?q=Tumble+Gym+Mysore" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-top: 10px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                🗺️ Open in Google Maps
              </a>
            </div>
            
            <div class="closing-text">
              <p style="font-size: 15px; color: #1e40af; font-weight: bold; margin-bottom: 10px;">🎉 We're so excited to meet ${data.child_name}!</p>
              <p>If you have any questions or need to reschedule, please do not hesitate to contact us at <a href="mailto:tumblegymmysore@gmail.com">tumblegymmysore@gmail.com</a> or <a href="tel:+918618684685">+91 8618684685</a>.</p>
              <p style="margin-top: 15px;">We look forward to seeing you and your little champion soon! 🌟</p>
              <p style="margin-top: 15px;"><strong>Warm regards,<br>The Tumble Gym Team 🏆</strong></p>
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
              <tr><th>Address</th><td>${data.address || 'N/A'}</td></tr>
              <tr><th>Alternate No.</th><td>${data.alternate_phone || 'N/A'}</td></tr>
            </table>
            <table class="info-table">
              <tr><th>Intent</th><td>${data.intent}</td></tr>
              <tr><th>Source</th><td>${data.source || data.how_heard || 'Web'}</td></tr>
              <tr><th>Marketing</th><td>${consentBadge}</td></tr>
            </table>
            
            <div class="declaration-box">
              <div class="declaration-title">Legal Declarations & Consent</div>
              ${declarationsBlock}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// ==========================================
// 2. TRIAL FEEDBACK EMAIL (Original Logic)
// ==========================================
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
          // Case: Special Needs + PT -> Show Both (Usually implies customized attention)
          recommendationHTML = specialBlock + ptBlock;
      } else {
          // Case: Special Needs + Batch -> Show Both
          recommendationHTML = specialBlock + batchBlock;
      }
  } else {
      // Case: Regular Kid
      if (isPT) {
          // Case: PT Only (Hide Batch per instruction)
          recommendationHTML = ptBlock;
      } else {
          // Case: Regular Batch
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
  const activeSkills: string[] = [];
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
          .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%); padding: 35px 30px; text-align: center; color: white; position: relative; overflow: hidden; }
          .header::before { content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 30px 30px; animation: float 20s infinite linear; }
          @keyframes float { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(-30px, -30px) rotate(360deg); } }
          .content { padding: 30px; }
          .score-card { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1); }
          .btn-container { text-align: center; margin-top: 30px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: transform 0.2s; }
          .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 900; position: relative; z-index: 1;">🎉 Trial Completed! 🌟</h1>
            <p style="margin: 10px 0 0; font-size: 18px; position: relative; z-index: 1;">Amazing job, ${data.child_name}! You're a star! ⭐</p>
          </div>
          <div class="content">
            <p style="font-size: 16px; color: #1e40af; font-weight: bold; margin-bottom: 15px;">Dear ${data.parent_name},</p>
            <p style="font-size: 15px; line-height: 1.7;">It was absolutely wonderful having <strong>${data.child_name}</strong> at The Tumble Gym today! 🌈 Our trainers have completed their assessment and we're so excited to share the results with you!</p>
            
            <div class="score-card">
              <h3 style="margin-top:0; color:#15803d; margin-bottom:15px; font-size:20px; font-weight:900;">🏆 Assessment Results</h3>
              ${feedbackHTML}
              ${skillsHtml}
              ${recommendationHTML}
            </div>

            <p style="font-size: 15px; line-height: 1.7; color: #1e293b; margin-top: 20px;">We would absolutely <strong>love</strong> to see ${data.child_name} continue their amazing gymnastics journey with us! 🎯✨</p>
            <p style="font-size: 14px; color: #64748b; margin-top: 10px;">Ready to enroll? Click below to complete registration and secure your spot!</p>
            
            <div class="btn-container">
                <a href="https://tumblegymmysore.github.io/tgm-spotter/" class="btn">Proceed to Registration</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};
