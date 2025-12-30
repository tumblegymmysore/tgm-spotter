// js/roles/parent.js (v67 - Final Optimized & Fixed)
import { supabaseClient, supabaseKey, REGISTRATION_FEE, STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, ADULT_AGE_THRESHOLD, CLASS_SCHEDULE, HOLIDAYS_MYSORE, TRIAL_EXCLUDED_DAYS, MIN_ELIGIBLE_AGE, WHATSAPP_LINK } from '../config.js';
import { showView, showSuccessModal, showErrorModal, calculateAge, sanitizeInput, getFinalPrice, getPackageMetadata } from '../utils.js';

let currentRegistrationId = null;
let currentLeadData = null;

// --- 1. TRIAL SLOT LOGIC ---
window.setTrialPreference = (pref) => {
    document.getElementById('trial-pref-val').value = pref;
    const btnEve = document.getElementById('btn-pref-evening');
    const btnMorn = document.getElementById('btn-pref-morning');
    
    // Toggle UI Styles
    if (pref === 'Evening') {
        btnEve.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btnEve.classList.remove('text-slate-500', 'hover:bg-indigo-50');
        btnMorn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        btnMorn.classList.add('text-slate-500', 'hover:bg-indigo-50');
    } else {
        btnMorn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btnMorn.classList.remove('text-slate-500', 'hover:bg-indigo-50');
        btnEve.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        btnEve.classList.add('text-slate-500', 'hover:bg-indigo-50');
    }
    window.generateTrialSlots();
};

window.generateTrialSlots = () => {
    const dob = document.getElementById('dob').value;
    const pref = document.getElementById('trial-pref-val').value;
    const container = document.getElementById('slots-container');
    const adultMsg = document.getElementById('adult-message');
    const hiddenInput = document.getElementById('selected-trial-slot');

    container.innerHTML = ''; hiddenInput.value = ''; adultMsg.classList.add('hidden'); container.classList.remove('hidden');

    if (!dob) {
        container.innerHTML = `<p class="text-sm text-slate-400 col-span-3 italic text-center">Please enter Date of Birth.</p>`;
        return;
    }

    const age = calculateAge(dob);
    const ageInMonths = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    // AGE VALIDATION: Below 2.5 years not eligible
    if (ageInMonths < 30) {
        container.classList.add('hidden');
        container.innerHTML = `
            <div class="bg-gradient-to-br from-pink-50 to-rose-50 p-6 rounded-2xl border-2 border-pink-300 shadow-lg text-center col-span-3">
                <div class="text-4xl mb-3">👶</div>
                <h3 class="text-lg font-extrabold text-pink-900 mb-2">Almost There, Little Champion! 🌟</h3>
                <p class="text-sm text-pink-800 mb-4 leading-relaxed">
                    We're so excited to welcome your little one to Tumble Gym! However, our programs are designed for children who are at least <strong>2.5 years old</strong> to ensure they get the best and safest experience.
                </p>
                <p class="text-xs text-pink-700 mb-4 font-semibold">
                    Please come back when your child turns 2.5 years old - we'll be here waiting with open arms! 🎉
                </p>
                <p class="text-xs text-pink-600 mb-4">
                    Have questions or want to learn more? We'd love to chat!
                </p>
                <a href="https://wa.me/918618684685" target="_blank" class="inline-block bg-green-500 text-white px-6 py-3 rounded-full font-bold hover:bg-green-600 transform hover:scale-105 transition-all shadow-lg">
                    <i class="fab fa-whatsapp mr-2"></i> Chat with Us on WhatsApp
                </a>
            </div>
        `;
        hiddenInput.value = '';
        return;
    }

    // ADULT LOGIC (15+)
    if (age >= ADULT_AGE_THRESHOLD && pref === 'Evening') {
        container.classList.add('hidden');
        adultMsg.classList.remove('hidden');
        hiddenInput.value = 'Adult_Request'; 
        return;
    }

    const slots = [];
    let datePointer = new Date();
    datePointer.setDate(datePointer.getDate() + 1); // Start Tomorrow

    // Get admin-suppressed dates from localStorage
    const suppressedDates = JSON.parse(localStorage.getItem('admin_suppressed_dates') || '[]');
    const adminHolidays = JSON.parse(localStorage.getItem('admin_holidays') || '[]');
    const adminHolidayDates = adminHolidays.map(h => h.date);
    
    let iterations = 0;
    while (slots.length < 5 && iterations < 30) {
        const dayOfWeek = datePointer.getDay(); 
        const dateStr = datePointer.toISOString().split('T')[0];
        const isHoliday = HOLIDAYS_MYSORE.includes(dateStr) || adminHolidayDates.includes(dateStr);
        const isExcluded = TRIAL_EXCLUDED_DAYS.includes(dayOfWeek);
        const isSuppressed = suppressedDates.includes(dateStr);

        if (!isHoliday && !isExcluded && !isSuppressed) {
            let validTime = null;
            if (pref === 'Morning') {
                if (CLASS_SCHEDULE.MORNING.days.includes(dayOfWeek) && age >= CLASS_SCHEDULE.MORNING.minAge) validTime = CLASS_SCHEDULE.MORNING.time;
            } else {
                let block = (dayOfWeek === 6) ? CLASS_SCHEDULE.SATURDAY : (dayOfWeek === 0) ? CLASS_SCHEDULE.SUNDAY : CLASS_SCHEDULE.EVENING;
                if (block && block.days.includes(dayOfWeek)) {
                    // Ages below 3 show same slots as 3-5
                    const effectiveAge = age < 3 ? 3 : age;
                    const slot = block.slots.find(s => effectiveAge >= s.min && effectiveAge < s.max);
                    if (slot) validTime = slot.time;
                }
            }
            if (validTime) slots.push({ iso: dateStr, display: datePointer.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), time: validTime });
        }
        datePointer.setDate(datePointer.getDate() + 1);
        iterations++;
    }

    if (slots.length === 0) {
        container.innerHTML = `<p class="text-xs text-red-500 col-span-3 text-center font-bold">No eligible classes found in next 14 days.</p>`;
        return;
    }

    slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `p-3 rounded-xl border border-indigo-100 bg-white hover:border-indigo-500 hover:shadow-md transition text-left group`;
        btn.innerHTML = `<div class="text-xs font-bold text-slate-400 uppercase mb-1">${slot.display}</div><div class="text-indigo-900 font-bold text-sm group-hover:text-indigo-600">${slot.time}</div>`;
        btn.onclick = () => {
            document.querySelectorAll('#slots-container button').forEach(b => { b.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50'); b.classList.add('bg-white'); });
            btn.classList.remove('bg-white'); btn.classList.add('bg-indigo-50', 'ring-2', 'ring-indigo-500');
            hiddenInput.value = `${slot.iso} | ${slot.time}`; document.getElementById('slot-error').classList.add('hidden');
        };
        container.appendChild(btn);
    });
};

// Check age eligibility and show/hide form sections
window.checkAgeEligibility = function() {
    const dob = document.getElementById('dob').value;
    if (!dob) {
        document.getElementById('age-ineligible-message').classList.add('hidden');
        enableFormSections(true);
        return;
    }
    
    const age = calculateAge(dob);
    const ageInMonths = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const isEligible = ageInMonths >= (MIN_ELIGIBLE_AGE * 12);
    
    if (!isEligible) {
        // Show ineligible message
        document.getElementById('age-ineligible-message').classList.remove('hidden');
        // Disable form sections (hide rest of form)
        enableFormSections(false);
        // Clear any selected trial slot
        document.getElementById('selected-trial-slot').value = '';
        document.getElementById('slots-container').innerHTML = '<p class="text-sm text-slate-400 col-span-3 italic">Please wait until your child is at least 2.5 years old.</p>';
    } else {
        // Hide ineligible message
        document.getElementById('age-ineligible-message').classList.add('hidden');
        // Enable form sections
        enableFormSections(true);
    }
};

function enableFormSections(enable) {
    const form = document.getElementById('intake-form');
    if (!form) return;
    
    // Get all sections (trial, parent info, medical, consent, submit)
    // NOTE: Child info section (name, DOB, gender, intent) is ALWAYS visible
    const trialSection = document.getElementById('trial-section');
    const parentSection = form.querySelector('.bg-gradient-to-br.from-slate-50');
    const medicalSection = document.getElementById('medical-section');
    const consentSection = form.querySelector('.bg-gradient-to-br.from-yellow-50');
    const submitBtn = document.getElementById('btn-submit');
    
    if (enable) {
        // Show all sections
        if (trialSection) trialSection.style.display = '';
        if (parentSection) parentSection.style.display = '';
        if (medicalSection) medicalSection.style.display = '';
        if (consentSection) consentSection.style.display = '';
        if (submitBtn) submitBtn.style.display = '';
        
        // Enable all form fields except DOB and child name (they're always enabled)
        const formFields = form.querySelectorAll('input:not(#dob):not(#k_name), select:not(#gender):not(#intent), textarea, button[type="submit"]');
        formFields.forEach(field => {
            field.disabled = false;
            field.style.opacity = '1';
            field.style.pointerEvents = 'auto';
        });
        
        // Enable gender and intent (they're always enabled)
        const genderField = document.getElementById('gender');
        const intentField = document.getElementById('intent');
        if (genderField) genderField.disabled = false;
        if (intentField) intentField.disabled = false;
    } else {
        // Hide only: trial section, parent section, medical section, consent section, submit button
        // Keep child info section visible so they can correct DOB
        if (trialSection) trialSection.style.display = 'none';
        if (parentSection) parentSection.style.display = 'none';
        if (medicalSection) medicalSection.style.display = 'none';
        if (consentSection) consentSection.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        
        // Disable all form fields except DOB, child name, gender, and intent
        // These remain enabled so parents can correct the birthdate
        const formFields = form.querySelectorAll('input:not(#dob):not(#k_name), select:not(#gender):not(#intent), textarea, button[type="submit"]');
        formFields.forEach(field => {
            field.disabled = true;
            field.style.opacity = '0.5';
            field.style.pointerEvents = 'none';
        });
        
        // Keep gender and intent enabled so they can still see/edit child info
        const genderField = document.getElementById('gender');
        const intentField = document.getElementById('intent');
        if (genderField) genderField.disabled = false;
        if (intentField) intentField.disabled = false;
    }
}

// --- 2. INTAKE FORM ---
export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    
    // A. Capture Data (with sanitization)
    const dob = document.getElementById('dob').value;
    if (!dob) {
        return showErrorModal("Date of Birth Required", "Please enter your child's date of birth.");
    }
    
    // Check age eligibility FIRST - before any other validation
    const ageInMonths = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (ageInMonths < (MIN_ELIGIBLE_AGE * 12)) {
        return showErrorModal(
            "Age Requirement Not Met 👶", 
            `Your little one needs to be at least ${MIN_ELIGIBLE_AGE} years old to join our gymnastics classes. We'd love to welcome them when they're ready! Please reach out to us on WhatsApp if you have any questions: ${WHATSAPP_LINK}`
        );
    }
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    const phone = document.getElementById('phone').value.trim().replace(/\D/g, ''); 
    const altPhone = document.getElementById('alt_phone').value.trim().replace(/\D/g, ''); 
    const trialSlot = document.getElementById('selected-trial-slot').value;
    
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    // B. Validation (Using Beautiful Modals)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return showErrorModal("Invalid Email", "Please enter a valid email address.");
    if (phone.length !== 10) return showErrorModal("Check Mobile Number", "Primary Mobile Number must be exactly 10 digits.");
    
    // Flexible Landline Logic
    const isLandline = altPhone.startsWith('0');
    if (isLandline) {
        if (altPhone.length < 10 || altPhone.length > 12) return showErrorModal("Check Alternate Number", "Landline numbers must include STD code (starting with 0) and be 10-12 digits.");
    } else {
        if (altPhone.length !== 10) return showErrorModal("Check Alternate Number", "Emergency Contact Number must be exactly 10 digits.");
    }

    if (!trialSlot) { 
        document.getElementById('slot-error').classList.remove('hidden'); 
        return showErrorModal("Trial Slot Required", "Please select a preferred date and time for the trial class."); 
    }
    if (!sourceVal) return showErrorModal("Source Required", "Please let us know how you heard about us.");

    btn.innerText = "Processing..."; btn.disabled = true;

    // C. Construct Data Payloads
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;

    // 1. DB Data (Strict Schema)
    const dbData = {
        parent_name: document.getElementById('p_name').value.trim(), 
        child_name: document.getElementById('k_name').value.trim(),
        phone: phone, email: email, 
        address: document.getElementById('address').value.trim(),
        dob: document.getElementById('dob').value, 
        gender: document.getElementById('gender').value,
        intent: intentVal, 
        medical_info: document.getElementById('medical').value.trim(), 
        how_heard: sourceVal, 
        alternate_phone: altPhone,
        marketing_consent: document.getElementById('marketing_check').checked,
        trial_scheduled_slot: trialSlot,
        is_trial: true, status: 'Pending Trial', submitted_at: new Date()
    };

    try {
        // Auth Sign Up
        const { data: authData } = await supabaseClient.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            const { data: roleData } = await supabaseClient.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) await supabaseClient.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
        }
        
        // DB Insert
        const { error } = await supabaseClient.from('leads').insert([dbData]);
        if (error) {
            if (error.code === '23505') throw new Error("Welcome Back! It looks like you are already registered. Please check your email or contact support.");
            throw error;
        }
        
        // 2. Email Data (Enriched for Template)
        const declarationsBlock = `Declarations Accepted:\n1. Parent/Guardian Confirmation\n2. Risk Acknowledgement & Liability Waiver\n3. Medical Fitness Declaration\n4. Media Consent Agreement\n5. Policy & Non-Refundable Fee Agreement\n\nAccepted on: ${new Date().toLocaleDateString('en-IN')}`;

        const emailData = {
            ...dbData,
            source: sourceVal, 
            terms_accepted: true,
            legal_declarations: declarationsBlock,
            instructions: "Please arrive on time. Wear comfortable dress (e.g., shorts/leggings and a t-shirt)."
        };

        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { 
            method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseKey}`}, body: JSON.stringify({record: emailData}) 
        });

        // D. Success Message (Customized)
        if (trialSlot === 'Adult_Request') {
            showSuccessModal("Request Received", "For Adults, we schedule sessions by appointment.\nPlease contact us on WhatsApp to confirm.", () => { 
                window.open("https://wa.me/918618684685", "_blank"); 
                window.location.reload(); 
            });
        } else {
            showSuccessModal("Account Created!", 
                "Your trial slot is confirmed!\n\n" +
                "📋 Important Instructions:\n" +
                "• Wear comfortable clothes (shorts/t-shirt) and arrive on time\n" +
                "• Food: Avoid heavy meals 2-3 hours before class\n" +
                "• No milk or dairy products 1 hour before class\n" +
                "• Minimal liquids 30 minutes before class\n" +
                "• Bring a water bottle for after class", 
                () => window.location.reload());
        }
        
        e.target.reset(); document.getElementById('age-display').classList.add('hidden');
        document.getElementById('slots-container').innerHTML = ''; 
    } catch (err) { showErrorModal("Submission Failed", err.message); } finally { btn.innerText = originalText; btn.disabled = false; }
}

// --- 3. PARENT DASHBOARD (Optimized) ---
export async function loadParentDashboard(email) {
    showView('parent-portal');
    const container = document.getElementById('parent-content');
    container.innerHTML = `<div class="animate-pulse space-y-4"><div class="h-40 bg-slate-100 rounded-3xl"></div><div class="h-40 bg-slate-100 rounded-3xl"></div></div>`;
    container.className = "space-y-6 max-w-lg mx-auto";

    const { data, error } = await supabaseClient.from('leads').select('*').eq('email', email).order('created_at', { ascending: false });

    if (error) { 
        container.innerHTML = `<p class="text-red-500 text-center">Error: ${sanitizeInput(error.message)}</p>`; 
        return; 
    }
    if (!data || data.length === 0) { 
        container.innerHTML = `<div class="text-center p-8 bg-white rounded-3xl border border-slate-100 mt-10"><h3 class="font-bold text-slate-800">No Students Yet</h3><button onclick="window.location.reload()" class="btn-primary mt-4">Register Now</button></div>`; 
        return; 
    }

    // Optimize: Batch fetch all unread message counts in one query
    const childIds = data.map(c => c.id);
    const { data: messageCounts } = await supabaseClient
        .from('messages')
        .select('lead_id')
        .in('lead_id', childIds)
        .eq('sender_role', 'trainer')
        .eq('is_read', false);
    
    const countMap = {};
    if (messageCounts) {
        messageCounts.forEach(msg => {
            countMap[msg.lead_id] = (countMap[msg.lead_id] || 0) + 1;
        });
    }

    container.innerHTML = '';
    for (const child of data) {
        const count = countMap[child.id] || 0;
        container.innerHTML += generateStudentCard(child, count);
    }
}

// --- DASHBOARD HELPERS ---
const STATUS_STRATEGIES = {
    'Pending Trial': (child) => {
        if (child.trial_scheduled_slot) {
            if (child.trial_scheduled_slot.includes('Adult')) return {
                badge: 'Trial Pending', color: 'bg-yellow-100 text-yellow-700',
                action: `<div class="bg-indigo-50 p-4 rounded-xl mb-4 border border-indigo-100 text-center"><p class="text-xs font-bold text-indigo-900 mb-2">Appointment Needed</p><a href="https://wa.me/918618684685" target="_blank" class="inline-block bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-600"><i class="fab fa-whatsapp mr-1"></i> Contact Trainer</a></div>`
            };
            const [d, t] = child.trial_scheduled_slot.split('|');
            return {
                badge: 'Trial Scheduled', color: 'bg-indigo-100 text-indigo-700',
                action: `<div class="bg-indigo-50 p-4 rounded-xl mb-4 border border-indigo-100 flex items-start gap-3"><div class="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">${new Date(d).getDate()}</div><div><h4 class="font-bold text-indigo-900 text-sm">Scheduled Trial</h4><p class="text-xs text-indigo-700 mt-0.5">${new Date(d).toLocaleDateString('en-GB',{month:'short',day:'numeric'})} @ ${t}</p><p class="text-[10px] text-indigo-400 mt-1">Please arrive on time.</p></div></div>`
            };
        }
        return { badge: 'Trial Pending', color: 'bg-yellow-100 text-yellow-700', action: `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>` };
    },
    'Trial Completed': (child, str) => {
        let txt = `Trainer recommends: <strong>${child.recommended_batch || 'Standard'}</strong>`;
        if (child.skills_rating?.personal_training) txt += ` <br>(Personal Training Advised)`;
        return { badge: 'Assessment Ready', color: 'bg-blue-100 text-blue-700', action: `<div class="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex items-start gap-3"><div class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check text-xs"></i></div><div><h4 class="font-bold text-blue-900 text-sm">Trial Successful!</h4><p class="text-xs text-blue-700 mt-1">${txt}</p></div></div><button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Proceed to Registration</button>` };
    },
    'Enrollment Requested': () => ({ badge: 'Pending Approval', color: 'bg-orange-100 text-orange-700', action: `<div class="bg-orange-50 p-4 rounded-xl mb-4 border border-orange-100 flex items-start gap-3"><div class="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-clock text-xs"></i></div><div><h4 class="font-bold text-orange-900 text-sm">Request Sent</h4><p class="text-xs text-orange-800 mt-1">Admin is verifying batch availability.</p></div></div><button disabled class="w-full bg-orange-100 text-orange-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Admin...</button>` }),
    'Ready to Pay': (child, str) => {
        const finalPrice = getFinalPrice(child);
        return { badge: 'Approved', color: 'bg-green-100 text-green-700', action: `<div class="bg-green-50 p-4 rounded-xl mb-4 border border-green-100 flex items-start gap-3"><div class="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check-double text-xs"></i></div><div><h4 class="font-bold text-green-900 text-sm">Admission Approved!</h4><p class="text-xs text-green-800 mt-1"><strong>${child.recommended_batch || 'Standard Batch'}</strong><br>Fee: ₹${finalPrice || child.package_price || '0'}</p></div></div><button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 animate-pulse">Pay Now & Enroll</button>` };
    },
    'Registration Requested': () => ({ badge: 'Verifying Payment', color: 'bg-purple-100 text-purple-700', action: `<div class="text-center p-4 bg-purple-50 rounded-xl border border-purple-100"><p class="text-xs font-bold text-purple-700 mb-2">Payment Receipt Uploaded</p><button disabled class="bg-white text-purple-400 text-xs font-bold py-2 px-4 rounded-lg border border-purple-100">Processing...</button></div>` }),
    'Enrolled': (child, str) => ({ badge: 'Active Student', color: 'bg-emerald-100 text-emerald-700', action: `<div class="flex items-center gap-2 mb-4 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100"><span class="w-2 h-2 bg-emerald-500 rounded-full"></span> Active</div><button onclick="window.openRegistrationModal('${str}', true)" class="w-full border-2 border-emerald-600 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50 transition">Renew Membership</button>` }),
    'Follow Up': (child, str) => ({ badge: 'On Hold', color: 'bg-orange-100 text-orange-700', action: `<div class="text-xs text-orange-800 bg-orange-50 p-3 rounded-lg mb-3 border border-orange-100">Follow-up: <strong>${child.follow_up_date || 'Future'}</strong></div><button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600">Resume Registration</button>` })
};

function generateStudentCard(child, count) {
    const str = encodeURIComponent(JSON.stringify(child));
    const strategy = STATUS_STRATEGIES[child.status] || STATUS_STRATEGIES['Pending Trial'];
    const ui = strategy(child, str);
    const badge = count > 0 ? `<span id="msg-badge-${child.id}" class="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>` : '';

    return `
    <div class="relative rounded-3xl p-6 shadow-sm border border-slate-100 bg-white mb-4 hover:shadow-md transition-all duration-300">
        <div class="flex justify-between items-start mb-4">
            <div class="flex gap-4 items-center">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg">${child.child_name.charAt(0)}</div>
                <div><h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3><p class="text-xs font-bold text-slate-400 uppercase mt-0.5">${calculateAge(child.dob)} Yrs • ${child.intent}</p></div>
            </div>
            <span class="${ui.color} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">${ui.badge}</span>
        </div>
        ${ui.action}
        <div class="flex gap-3 mt-4 pt-4 border-t border-slate-50">
            <button onclick="window.openParentChat('${str}')" class="flex-1 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 relative py-2.5 rounded-lg border border-blue-200 transition"><i class="fas fa-comment-alt mr-2"></i>Chat with Coach ${badge}</button>
            <button onclick="window.openEditModal('${str}')" class="w-12 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-lg border border-slate-300 transition flex items-center justify-center"><i class="fas fa-pen"></i></button>
        </div>
    </div>`;
}

// --- 4. REGISTRATION & UTILS (All Functionality Preserved) ---
export function openRegistrationModal(leadString, isRenewal) {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    currentLeadData = child;
    
    // Reset payment mode
    const paymentModeEl = document.getElementById('payment-mode');
    if (paymentModeEl) {
        paymentModeEl.value = '';
        document.getElementById('upi-payment-section').classList.add('hidden');
        document.getElementById('cash-payment-section').classList.add('hidden');
        const paymentProof = document.getElementById('payment-proof');
        if (paymentProof) paymentProof.required = false;
    }
    
    // Reset batch change reason field
    const reasonField = document.getElementById('batch-change-reason');
    if (reasonField) {
        reasonField.classList.add('hidden');
        const reasonText = document.getElementById('batch-change-reason-text');
        if (reasonText) {
            reasonText.value = '';
            reasonText.required = false;
        }
    }
    
    const age = calculateAge(child.dob);

    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('reg-child-age').innerText = age;
    document.getElementById('is-renewal').value = isRenewal;
    document.getElementById('reg-modal').classList.remove('hidden');

    const timeEl = document.getElementById('reg-time-slot');
    const batchEl = document.getElementById('reg-batch-category');
    batchEl.innerHTML = ''; 

    if (age >= ADULT_AGE_THRESHOLD) {
        // Adults: Personal Training is primary, Morning Batch is secondary option
        timeEl.value = "Morning"; 
        timeEl.disabled = true; 
        batchEl.innerHTML = `
            <option value="">Select Option...</option>
            <option value="Personal Training">Personal Training</option>
            <option value="Morning Batch">Morning Batch (Unlimited - Tue-Fri)</option>
        `;
        // Pre-select PT if recommended
        if (child.recommended_batch === 'Adult Fitness' || child.skills_rating?.personal_training) {
            batchEl.value = "Personal Training";
        }
        // Hide day selection for adults (not needed for morning batch)
        document.getElementById('session-days-section')?.classList.add('hidden');
    } else {
        timeEl.disabled = false; 
        timeEl.value = "Evening"; 
        
        // For 3-5 years: Morning batch is NOT applicable initially
        // Morning option will only be shown if batch is changed to 5-8
        if(age <= 5) {
            batchEl.innerHTML += `<option value="Toddler (3-5 Yrs)">Toddler (3-5 Yrs)</option>`;
            // Remove morning option from time slot for 3-5 years
            const morningOption = timeEl.querySelector('option[value="Morning"]');
            if (morningOption) morningOption.style.display = 'none';
        }
        if(age >= 5 && age <= 8) {
            batchEl.innerHTML += `<option value="Beginner (5-8 Yrs)">Beginner (5-8 Yrs)</option>`;
        }
        if(age >= 8 && age < 15) {
            batchEl.innerHTML += `<option value="Intermediate (8+ Yrs)">Intermediate (8+ Yrs)</option>`;
        }
        batchEl.innerHTML += `<option value="Special Needs">Special Needs</option><option value="Personal Training">Personal Training</option><option value="Other">Other</option>`;
        
        if (child.skills_rating?.personal_training) batchEl.value = "Personal Training";
        else if (child.special_needs) batchEl.value = "Special Needs";
        else if (child.recommended_batch && Array.from(batchEl.options).map(o=>o.value).includes(child.recommended_batch)) batchEl.value = child.recommended_batch;
        
        // Add event listener to batch category to show/hide morning option
        batchEl.addEventListener('change', function() {
            const currentAge = parseInt(document.getElementById('reg-child-age').innerText);
            const selectedBatch = this.value;
            const morningOption = timeEl.querySelector('option[value="Morning"]');
            
            // If 3-5 years and changing to 5-8 batch, show morning option
            if (currentAge <= 5 && selectedBatch === 'Beginner (5-8 Yrs)') {
                if (morningOption) morningOption.style.display = '';
            } else if (currentAge <= 5) {
                // If still 3-5 batch, hide morning and reset to Evening
                if (morningOption) morningOption.style.display = 'none';
                if (timeEl.value === 'Morning') {
                    timeEl.value = 'Evening';
                    showErrorModal("Morning Not Available", "Morning batch is not available for 3-5 years age group. Please select Evening/Weekend time slot.");
                }
            }
            window.checkApprovalRequirement();
        });
    }
    
    window.checkApprovalRequirement();

    // Check if package is admin-locked (from metadata or direct field)
    const meta = getPackageMetadata(child);
    const isPackageLocked = meta?.package_locked === true || child.package_locked === true;
    
    if (child.status === 'Ready to Pay' || isPackageLocked) {
        document.getElementById('reg-program-display').innerText = child.recommended_batch || 'Standard Batch';
        const finalPrice = getFinalPrice(child);
        document.getElementById('total-price').innerText = finalPrice || child.package_price || 0;
        
        // Lock all fields if package is admin-locked
        if (isPackageLocked) {
            timeEl.disabled = true;
            batchEl.disabled = true;
            document.getElementById('reg-package-select').disabled = true;
            document.getElementById('reg-pt-level').disabled = true;
            document.getElementById('reg-pt-sessions').disabled = true;
            
            // Show admin lock notice
            const approvalNotice = document.getElementById('approval-notice');
            approvalNotice.innerHTML = `
                <div class="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
                    <i class="fas fa-lock text-purple-600 mt-0.5"></i>
                    <div class="text-xs text-purple-800 leading-relaxed">
                        <strong>Admin-Locked Package:</strong> This package has been set by Admin and cannot be modified. 
                        Please contact Admin if you need to make changes.
                        <br><strong>Package:</strong> ${meta?.selected_package || child.selected_package || 'Not Set'}
                        <br><strong>Price:</strong> ₹${getFinalPrice(child) || meta?.package_price || child.package_price || 0}
                    </div>
                </div>
            `;
            approvalNotice.classList.remove('hidden');
            document.getElementById('btn-submit-request').classList.add('hidden');
        }
        
        // If Ready to Pay (not just locked), show payment section
        if (child.status === 'Ready to Pay') {
            document.getElementById('payment-section').classList.remove('hidden');
            document.getElementById('btn-submit-pay').classList.remove('hidden');
            document.getElementById('btn-submit-request').classList.add('hidden');
            if (!isPackageLocked) {
                document.getElementById('approval-notice').classList.add('hidden');
            }
        }
    } else {
        document.getElementById('reg-program-display').innerText = child.recommended_batch || (child.special_needs ? "Special Needs" : "Standard Batch");
    }
}

export function updatePackageOptions() {
    const timeSlot = document.getElementById('reg-time-slot').value;
    const batchCat = document.getElementById('reg-batch-category').value;
    const pkgSelect = document.getElementById('reg-package-select');
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const isAdult = age >= ADULT_AGE_THRESHOLD;
    
    pkgSelect.innerHTML = '<option value="" disabled selected>Select a Package...</option>';
    
    // Morning batch - same rate ₹5500 for all
    if (timeSlot === 'Morning') {
        const morningPkg = MORNING_PACKAGES.CHILD; // Same for all now
        pkgSelect.innerHTML += `<option value="${morningPkg.id}|${morningPkg.price}|${morningPkg.classes}|${morningPkg.months}">Morning Unlimited - ₹${morningPkg.price}</option>`;
    } else {
        // Evening/Weekend packages
        STANDARD_PACKAGES.forEach(p => pkgSelect.innerHTML += `<option value="${p.id}|${p.price}|${p.classes}|${p.months}">${p.label} - ₹${p.price}</option>`);
    }
    window.calculateTotal();
}

export function checkApprovalRequirement() {
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const batchCat = document.getElementById('reg-batch-category').value;
    const timeSlot = document.getElementById('reg-time-slot').value;
    const isAdult = age >= ADULT_AGE_THRESHOLD;
    
    // UI Toggle
    const isPT = batchCat === 'Personal Training';
    const isAdultMorning = isAdult && batchCat === 'Morning Batch';
    const isKidsMorning = !isAdult && timeSlot === 'Morning';
    
    // Show/hide PT options (different for adults vs kids)
    document.getElementById('reg-package-select').parentElement.classList.toggle('hidden', isPT || isAdultMorning || isKidsMorning);
    document.getElementById('group-pt-options').classList.toggle('hidden', !isPT || !isAdult); // Adult PT only
    const kidsPTOptions = document.getElementById('group-pt-options-kids');
    if (kidsPTOptions) {
        kidsPTOptions.classList.toggle('hidden', !isPT || isAdult); // Kids PT only
    }
    document.getElementById('adult-morning-info').classList.toggle('hidden', !isAdultMorning);
    document.getElementById('kids-morning-info').classList.toggle('hidden', !isKidsMorning);
    
    // Set minimum date for PT start date (tomorrow) - only for adults
    if (isPT && isAdult) {
        const ptStartDateEl = document.getElementById('reg-pt-start-date');
        if (ptStartDateEl) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            ptStartDateEl.min = tomorrow.toISOString().split('T')[0];
        }
    }
    
    if(!isPT && !isAdultMorning && !isKidsMorning) window.updatePackageOptions();

    // Logic for approval requirement
    let needsApproval = false;
    let approvalMessage = '';
    
    if (isAdult) {
        // Adults: Approval needed only when changing FROM group TO PT
        // If recommendation was PT but they chose morning - can proceed
        const recommendedPT = currentLeadData.recommended_batch === 'Adult Fitness' || currentLeadData.skills_rating?.personal_training;
        
        if (isPT) {
            // If changing from group to PT, need approval
            if (!recommendedPT) {
                needsApproval = true;
                approvalMessage = 'Since you\'ve selected Personal Training, please discuss with admin regarding session details, rate, and validity period before proceeding with payment.';
            } else {
                // If PT was recommended, hide approval notice (PT details box already covers it)
                needsApproval = false;
            }
        } else if (isAdultMorning) {
            // Morning batch for adults - can proceed directly (unlimited, fixed schedule)
            needsApproval = false;
        }
    } else {
        // Kids logic
        // For 3-5 years: Morning batch is NOT applicable unless batch is changed to 5-8
        const is3to5 = age >= 3 && age <= 5;
        const isChangingTo5to8 = batchCat === 'Beginner (5-8 Yrs)' && currentLeadData.recommended_batch === 'Toddler (3-5 Yrs)';
        
        // If 3-5 years and trying to select morning, show error
        if (is3to5 && timeSlot === 'Morning' && !isChangingTo5to8) {
            needsApproval = true;
            approvalMessage = 'Morning batch is not available for 3-5 years age group. Please select Evening/Weekend time slot.';
            // Reset to Evening
            document.getElementById('reg-time-slot').value = 'Evening';
            window.checkApprovalRequirement();
            return;
        }
        
        // If changing from 3-5 to 5-8 and selecting morning, need approval with reason
        if (isChangingTo5to8 && timeSlot === 'Morning') {
            needsApproval = true;
            // Show reason field for batch change
            const reasonField = document.getElementById('batch-change-reason');
            if (reasonField) {
                reasonField.classList.remove('hidden');
                reasonField.required = true;
            }
            approvalMessage = 'You\'ve selected a different batch (5-8 Yrs) and morning time slot. Please provide a reason for this change. Admin will review and confirm.';
        }
        
        needsApproval = needsApproval || (batchCat === 'Other' || (age < ADULT_AGE_THRESHOLD && timeSlot === 'Morning' && !isChangingTo5to8));
        
        // If changing batch (e.g., 3-5 to 5-8), need approval
        if (batchCat !== 'Other' && !isPT && currentLeadData.recommended_batch && batchCat !== currentLeadData.recommended_batch && !isChangingTo5to8) {
            needsApproval = true;
            approvalMessage = `You've selected a different batch (${batchCat}) than recommended (${currentLeadData.recommended_batch}). Please reach out to admin to confirm before proceeding with payment.`;
        }
        
        // If changing to PT from group, need approval
        if (isPT && !currentLeadData.skills_rating?.personal_training) {
            needsApproval = true;
            approvalMessage = 'Since you\'ve selected Personal Training, please discuss with admin regarding session details, rate, and validity period before proceeding with payment.';
        }
        
        // Other cases
        if (needsApproval && !approvalMessage) {
            approvalMessage = 'Please submit a request; our Admin will review and approve shortly.';
        }
    }

    // Update approval notice message if custom message provided
    const approvalNotice = document.getElementById('approval-notice');
    if (approvalMessage && needsApproval) {
        const noticeText = approvalNotice.querySelector('div') || approvalNotice.querySelector('p');
        if (noticeText) {
            noticeText.innerHTML = `<strong>Approval Required:</strong> ${approvalMessage}`;
        }
    }
    
    approvalNotice.classList.toggle('hidden', !needsApproval);
    document.getElementById('btn-submit-pay').classList.toggle('hidden', needsApproval);
    document.getElementById('btn-submit-request').classList.toggle('hidden', !needsApproval);
    document.getElementById('payment-section').classList.toggle('hidden', needsApproval);
    window.calculateTotal(); 
}

export function calculateTotal() {
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    const batchCat = document.getElementById('reg-batch-category').value;
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const isAdult = age >= ADULT_AGE_THRESHOLD;
    let total = 0;
    
    if (batchCat === 'Personal Training') {
        // PT pricing - admin will set, show 0 for now or estimate
        // For adults, this goes to admin for approval anyway
        total = 0; // Will be set by admin
    } else if (isAdult && batchCat === 'Morning Batch') {
        // Adult morning batch - unlimited package (₹5500)
        const morningPkg = MORNING_PACKAGES.CHILD; // Same rate for all
        total = morningPkg.price;
    } else {
        const val = document.getElementById('reg-package-select').value;
        if (val) total = parseInt(val.split('|')[1]);
    }
    
    if (!isRenewal && total > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total;
}

export async function submitRegistration(actionType) {
    const batchCat = document.getElementById('reg-batch-category').value;
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const isAdult = age >= ADULT_AGE_THRESHOLD;
    const total = document.getElementById('total-price').innerText;
    let pkgLabel = "";
    let ptDetails = null;

    if (batchCat === 'Personal Training') {
        // For adults, collect PT details for admin approval
        if (isAdult) {
            const startDate = document.getElementById('reg-pt-start-date').value;
            if (!startDate) {
                return showErrorModal("Date Required", "Please select a preferred start date for Personal Training.");
            }
            ptDetails = {
                preferred_start_date: startDate,
                notes: document.getElementById('reg-pt-notes').value.trim() || null,
                type: 'adult_pt_request'
            };
            pkgLabel = `Personal Training - Start: ${new Date(startDate).toLocaleDateString('en-IN')}`;
        } else {
            // Kids PT (existing logic)
            pkgLabel = `PT (${document.getElementById('reg-pt-level').value}) - ${document.getElementById('reg-pt-sessions').value} Classes`;
        }
    } else if (isAdult && batchCat === 'Morning Batch') {
        // Adult morning batch - unlimited
        pkgLabel = `Morning Batch (Unlimited) - Tue-Fri`;
    } else {
        const val = document.getElementById('reg-package-select').value;
        if (!val) return showErrorModal("Selection Missing", "Please select a package.");
        pkgLabel = document.querySelector(`#reg-package-select option[value="${val}"]`).text;
    }

    if (actionType === 'REQUEST') {
        let note = `Request: ${document.getElementById('reg-time-slot').value} - ${batchCat}. Plan: ${pkgLabel}`;
        
        // Add batch change reason if provided
        const reasonField = document.getElementById('batch-change-reason-text');
        if (reasonField && !reasonField.classList.contains('hidden') && reasonField.value.trim()) {
            note += `\nBatch Change Reason: ${reasonField.value.trim()}`;
        }
        
        if (ptDetails) {
            note += `\nPT Details: Start Date: ${ptDetails.preferred_start_date}`;
            if (ptDetails.notes) note += `\nNotes: ${ptDetails.notes}`;
        }
        
        // Store final_price and PT details in parent_note metadata
        const existingNote = currentLeadData?.parent_note || '';
        const metadata = { final_price: total };
        if (ptDetails) {
            metadata.pt_request = ptDetails;
        }
        const metaNote = `[PACKAGE_META]${JSON.stringify(metadata)}[/PACKAGE_META]`;
        const cleanedNote = existingNote.replace(/\[PACKAGE_META\].*?\[\/PACKAGE_META\]/g, '').trim();
        const updatedNote = cleanedNote ? `${cleanedNote}\n${metaNote}` : metaNote;
        
        await supabaseClient.from('leads').update({ 
            status: 'Enrollment Requested', 
            parent_note: `${note}\n${updatedNote}` 
        }).eq('id', currentRegistrationId);
        
        document.getElementById('reg-modal').classList.add('hidden');
        const message = isAdult && batchCat === 'Personal Training' 
            ? "Your Personal Training request has been sent! Admin will review and confirm the rate, sessions, and validity period."
            : "Admin will review your custom plan request.";
        showSuccessModal("Request Sent!", message, () => window.location.reload());
        return;
    }

    const paymentMode = document.getElementById('payment-mode').value;
    if (!paymentMode) return showErrorModal("Payment Mode Required", "Please select a payment mode (UPI or Cash).");
    
    const fileInput = document.getElementById('payment-proof');
    let paymentProofUrl = null;
    
    // Only require and upload proof for UPI payments
    if (paymentMode === 'UPI') {
        if (fileInput.files.length === 0) return showErrorModal("Proof Required", "Please upload payment screenshot for UPI payment.");
        
        const file = fileInput.files[0];
        const fileName = `${currentRegistrationId}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: err } = await supabaseClient.storage.from('payment-proofs').upload(fileName, file);
        if(err) throw err;
        const { data: { publicUrl } } = supabaseClient.storage.from('payment-proofs').getPublicUrl(fileName);
        paymentProofUrl = publicUrl;
    }
    
    const btn = document.getElementById('btn-submit-pay'); btn.innerText = "Submitting..."; btn.disabled = true;

    try {
        const updateData = {
            status: 'Registration Requested',
            selected_package: pkgLabel,
            package_price: total,
            start_date: document.getElementById('reg-date').value,
            session_days: Array.from(document.querySelectorAll('input[name="session_days"]:checked')).map(cb => cb.value),
            payment_status: 'Verification Pending',
            payment_mode: paymentMode
        };
        
        // Only add payment_proof_url if it exists (UPI payments)
        if (paymentProofUrl) {
            updateData.payment_proof_url = paymentProofUrl;
        }

        await supabaseClient.from('leads').update(updateData).eq('id', currentRegistrationId);
        
        // Send notification to admin about new registration
        try {
            await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({
                    record: {
                        type: 'registration_notification',
                        child_name: currentLeadData.child_name,
                        parent_name: currentLeadData.parent_name,
                        phone: currentLeadData.phone,
                        email: currentLeadData.email,
                        payment_mode: paymentMode,
                        total_amount: total,
                        package: pkgLabel,
                        lead_id: currentRegistrationId
                    }
                })
            });
        } catch (notifyErr) {
            console.error('Notification error:', notifyErr);
            // Don't block submission if notification fails
        }

        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Submitted!", "Registration & Payment info sent to Admin.", () => window.location.reload());
    } catch (e) { showErrorModal("Upload Error", e.message); btn.disabled = false; btn.innerText = "Pay & Enroll"; }
}

export function openParentChat(str) { 
    const lead = JSON.parse(decodeURIComponent(str));
    document.getElementById(`msg-badge-${lead.id}`)?.classList.add('hidden');
    window.openChat(str); 
}
export function openEditModal(str) {
    const lead = JSON.parse(decodeURIComponent(str));
    document.getElementById('edit-lead-id').value = lead.id;
    document.getElementById('read-child-name').value = lead.child_name;
    document.getElementById('read-dob').value = lead.dob;
    document.getElementById('update-medical').value = lead.medical_info || '';
    document.getElementById('update-alt-phone').value = lead.alternate_phone || '';
    document.getElementById('update-address').value = lead.address || '';
    document.getElementById('edit-modal').classList.remove('hidden');
}
export async function saveChildInfo() {
    const leadId = document.getElementById('edit-lead-id').value;
    const medical = document.getElementById('update-medical').value.trim();
    const altPhone = document.getElementById('update-alt-phone').value.trim().replace(/\D/g, '');
    const address = document.getElementById('update-address').value.trim();
    
    // Validation
    if (!leadId) return showErrorModal("Error", "Invalid record ID.");
    
    const isLandline = altPhone.startsWith('0');
    if (isLandline) {
        if (altPhone.length < 10 || altPhone.length > 12) {
            return showErrorModal("Check Alternate Number", "Landline numbers must include STD code (starting with 0) and be 10-12 digits.");
        }
    } else if (altPhone && altPhone.length !== 10) {
        return showErrorModal("Check Alternate Number", "Emergency Contact Number must be exactly 10 digits.");
    }
    
    const btn = document.getElementById('btn-save-info');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Saving...";
    
    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({
                medical_info: medical,
                alternate_phone: altPhone || null,
                address: address
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        document.getElementById('edit-modal').classList.add('hidden');
        showSuccessModal("Updated!", "Child information has been saved.", () => window.location.reload());
    } catch (e) {
        showErrorModal("Save Failed", e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
// View assessment details
window.viewAssessment = function(leadString) {
    const child = JSON.parse(decodeURIComponent(leadString));
    const feedback = child.feedback || 'No feedback provided.';
    const skills = child.skills_rating || {};
    const activeSkills = [];
    if (skills.listening) activeSkills.push('Listening');
    if (skills.flexibility) activeSkills.push('Flexibility');
    if (skills.strength) activeSkills.push('Strength');
    if (skills.balance) activeSkills.push('Balance');
    
    const skillsText = activeSkills.length > 0 ? activeSkills.join(', ') : 'None noted';
    
    showSuccessModal(
        `Assessment for ${child.child_name} 📝`,
        `Trainer Feedback:\n${feedback}\n\nStrengths Observed: ${skillsText}\n\nRecommended Batch: ${child.recommended_batch || 'Standard'}`,
        null
    );
};

export function openFeedbackModal(id) { document.getElementById('feedback-lead-id').value = id; document.getElementById('feedback-modal').classList.remove('hidden'); }
export async function submitParentFeedback() { 
    const id = document.getElementById('feedback-lead-id').value;
    const reason = document.getElementById('feedback-reason').value;
    if (!reason) return showErrorModal("Feedback Missing", "Please select a reason.");
    try {
        await supabaseClient.from('leads').update({ status: 'Follow Up', feedback_reason: reason, follow_up_date: document.getElementById('feedback-date').value || null, parent_note: document.getElementById('feedback-note').value }).eq('id', id);
        showSuccessModal("Feedback Saved", "We will contact you later.", () => window.location.reload());
        document.getElementById('feedback-modal').classList.add('hidden');
    } catch (e) { showErrorModal("Error", e.message); }
}
export function handlePackageChange() { window.calculateTotal(); }
