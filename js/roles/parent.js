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
        return { badge: 'Assessment Ready', color: 'bg-blue-100 text-blue-700', action: `<div class="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex items-start gap-3"><div class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check text-xs"></i></div><div><h4 class="font-bold text-blue-900 text-sm">Trial Successful!</h4><p class="text-xs text-blue-700 mt-1">${txt}</p></div></div><button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button><button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Proceed to Registration</button>` };
    },
    'Enrollment Requested': (child, str) => {
        const hasAssessment = child.feedback || child.skills_rating || child.recommended_batch;
        return { badge: 'Pending Approval', color: 'bg-orange-100 text-orange-700', action: `<div class="bg-orange-50 p-4 rounded-xl mb-4 border border-orange-100 flex items-start gap-3"><div class="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-clock text-xs"></i></div><div><h4 class="font-bold text-orange-900 text-sm">Request Sent</h4><p class="text-xs text-orange-800 mt-1">Admin is verifying batch availability.</p></div></div>${hasAssessment ? `<button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button>` : ''}<button disabled class="w-full bg-orange-100 text-orange-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Admin...</button>` };
    },
    'Ready to Pay': (child, str) => {
        const finalPrice = getFinalPrice(child);
        const hasAssessment = child.feedback || child.skills_rating || child.recommended_batch;
        return { badge: 'Approved', color: 'bg-green-100 text-green-700', action: `<div class="bg-green-50 p-4 rounded-xl mb-4 border border-green-100 flex items-start gap-3"><div class="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check-double text-xs"></i></div><div><h4 class="font-bold text-green-900 text-sm">Admission Approved!</h4><p class="text-xs text-green-800 mt-1"><strong>${child.recommended_batch || 'Standard Batch'}</strong><br>Fee: ₹${finalPrice || child.package_price || '0'}</p></div></div>${hasAssessment ? `<button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button>` : ''}<button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 animate-pulse">Pay Now & Enroll</button>` };
    },
    'Registration Requested': (child, str) => {
        const hasAssessment = child.feedback || child.skills_rating || child.recommended_batch;
        return { badge: 'Verifying Payment', color: 'bg-purple-100 text-purple-700', action: `<div class="text-center p-4 bg-purple-50 rounded-xl border border-purple-100"><p class="text-xs font-bold text-purple-700 mb-2">Payment Receipt Uploaded</p>${hasAssessment ? `<button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button>` : ''}<button disabled class="bg-white text-purple-400 text-xs font-bold py-2 px-4 rounded-lg border border-purple-100">Processing...</button></div>` };
    },
    'Enrolled': (child, str) => {
        const hasAssessment = child.feedback || child.skills_rating || child.recommended_batch;
        return { badge: 'Active Student', color: 'bg-emerald-100 text-emerald-700', action: `<div class="flex items-center gap-2 mb-4 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100"><span class="w-2 h-2 bg-emerald-500 rounded-full"></span> Active</div>${hasAssessment ? `<button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button>` : ''}<button onclick="window.openRegistrationModal('${str}', true)" class="w-full border-2 border-emerald-600 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50 transition">Renew Membership</button>` };
    },
    'Follow Up': (child, str) => {
        const hasAssessment = child.feedback || child.skills_rating || child.recommended_batch;
        return { badge: 'On Hold', color: 'bg-orange-100 text-orange-700', action: `<div class="text-xs text-orange-800 bg-orange-50 p-3 rounded-lg mb-3 border border-orange-100">Follow-up: <strong>${child.follow_up_date || 'Future'}</strong></div>${hasAssessment ? `<button onclick="window.viewAssessmentDetails('${str}')" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition mb-3 flex items-center justify-center gap-2"><i class="fas fa-clipboard-check"></i> View Assessment Details</button>` : ''}<button onclick="window.openRegistrationModal('${str}', false)" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600">Resume Registration</button>` };
    }
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
    if (!batchEl) {
        console.error('Batch category element not found');
        return;
    }
    batchEl.innerHTML = '<option value="">Select Batch...</option>'; 

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
        
        // Show trainer badges if Special Needs or Personal Training recommended
        const badgesEl = document.getElementById('trainer-badges');
        if (badgesEl) {
            badgesEl.innerHTML = '';
            if (child.skills_rating?.special_needs) {
                badgesEl.innerHTML += `<span class="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-300"><i class="fas fa-heart"></i> Special Needs Recommended</span>`;
            }
            if (child.skills_rating?.personal_training) {
                badgesEl.innerHTML += `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full border border-amber-300"><i class="fas fa-dumbbell"></i> Personal Training Recommended</span>`;
            }
        }
        
        // Batch dropdown: Show recommended batch + one level above and one below
        // Special Needs and Personal Training are NOT selectable - shown as badges only
        // Clear and rebuild options
        batchEl.innerHTML = '<option value="">Select Batch...</option>';
        
        // Determine which batches to show based on recommended batch and age
        const recommendedBatch = child.recommended_batch;
        const batchesToShow = new Set();
        
        // Always include the recommended batch
        if (recommendedBatch) {
            batchesToShow.add(recommendedBatch);
        }
        
        // Add batches based on age and recommended batch
        // If recommended is Toddler (3-5 Yrs), also show Beginner (5-8 Yrs) - one above
        if (recommendedBatch === 'Toddler (3-5 Yrs)' || (age >= 3 && age <= 5 && !recommendedBatch)) {
            batchesToShow.add('Toddler (3-5 Yrs)');
            if (age >= 5 || recommendedBatch === 'Toddler (3-5 Yrs)') {
                batchesToShow.add('Beginner (5-8 Yrs)'); // One above
            }
        }
        
        // If recommended is Beginner (5-8 Yrs), show both Toddler (3-5 Yrs) - one below, and Intermediate (8+ Yrs) - one above
        if (recommendedBatch === 'Beginner (5-8 Yrs)' || (age >= 5 && age <= 8 && !recommendedBatch)) {
            batchesToShow.add('Beginner (5-8 Yrs)');
            batchesToShow.add('Toddler (3-5 Yrs)'); // One below
            if (age >= 8 || recommendedBatch === 'Beginner (5-8 Yrs)') {
                batchesToShow.add('Intermediate (8+ Yrs)'); // One above
            }
        }
        
        // If recommended is Intermediate (8+ Yrs), show Beginner (5-8 Yrs) - one below
        if (recommendedBatch === 'Intermediate (8+ Yrs)' || (age >= 8 && age < 15 && !recommendedBatch)) {
            batchesToShow.add('Intermediate (8+ Yrs)');
            batchesToShow.add('Beginner (5-8 Yrs)'); // One below
        }
        
        // Fallback: If no recommended batch, show based on age
        if (batchesToShow.size === 0) {
            if (age >= 3 && age <= 5) {
                batchesToShow.add('Toddler (3-5 Yrs)');
                if (age >= 5) batchesToShow.add('Beginner (5-8 Yrs)');
            } else if (age >= 5 && age <= 8) {
                batchesToShow.add('Toddler (3-5 Yrs)');
                batchesToShow.add('Beginner (5-8 Yrs)');
                if (age >= 8) batchesToShow.add('Intermediate (8+ Yrs)');
            } else if (age >= 8 && age < 15) {
                batchesToShow.add('Beginner (5-8 Yrs)');
                batchesToShow.add('Intermediate (8+ Yrs)');
            }
        }
        
        // Add options in order: Toddler -> Beginner -> Intermediate
        const batchOrder = ['Toddler (3-5 Yrs)', 'Beginner (5-8 Yrs)', 'Intermediate (8+ Yrs)'];
        batchOrder.forEach(batch => {
            if (batchesToShow.has(batch)) {
                batchEl.innerHTML += `<option value="${batch}">${batch}</option>`;
            }
        });
        
        // Hide morning option for 3-5 years initially (unless batch is changed to 5-8)
        if (age >= 3 && age <= 5 && recommendedBatch === 'Toddler (3-5 Yrs)') {
            const morningOption = timeEl.querySelector('option[value="Morning"]');
            if (morningOption) morningOption.style.display = 'none';
        }
        
        // Pre-select recommended batch if it's one of the standard options
        if (recommendedBatch && Array.from(batchEl.options).map(o=>o.value).includes(recommendedBatch)) {
            batchEl.value = recommendedBatch;
        } else if (batchesToShow.has('Toddler (3-5 Yrs)') && age >= 3 && age <= 5) {
            batchEl.value = "Toddler (3-5 Yrs)";
        } else if (batchesToShow.has('Beginner (5-8 Yrs)') && age >= 5 && age <= 8) {
            batchEl.value = "Beginner (5-8 Yrs)";
        } else if (batchesToShow.has('Intermediate (8+ Yrs)') && age >= 8 && age < 15) {
            batchEl.value = "Intermediate (8+ Yrs)";
        }
        
        // Add event listener to batch category to show/hide morning option and reason field
        // Use a named function to avoid duplicate listeners
        if (!batchEl.dataset.listenerAdded) {
            batchEl.dataset.listenerAdded = 'true';
            batchEl.addEventListener('change', function() {
            const currentAge = parseInt(document.getElementById('reg-child-age').innerText);
            const selectedBatch = this.value;
            const recommendedBatch = child.recommended_batch;
            const morningOption = timeEl.querySelector('option[value="Morning"]');
            const reasonSection = document.getElementById('batch-change-reason-section');
            const reasonField = document.getElementById('batch-change-reason-text');
            
            // Reset reason field
            if (reasonSection) reasonSection.classList.add('hidden');
            if (reasonField) {
                reasonField.value = '';
                reasonField.required = false;
            }
            
            // For 3-5 years: Morning batch is NOT applicable unless batch is changed to 5-8
            if (currentAge >= 3 && currentAge <= 5) {
                if (selectedBatch === 'Beginner (5-8 Yrs)') {
                    // If changing to 5-8 batch, show morning option
                    if (morningOption) morningOption.style.display = '';
                    
                    // If this is different from recommended, show reason field
                    if (recommendedBatch && recommendedBatch !== selectedBatch) {
                        if (reasonSection) reasonSection.classList.remove('hidden');
                        if (reasonField) reasonField.required = true;
                    }
                } else {
                    // If still 3-5 batch, hide morning and reset to Evening
                    if (morningOption) morningOption.style.display = 'none';
                    if (timeEl.value === 'Morning') {
                        timeEl.value = 'Evening';
                    }
                    
                    // If changing from recommended batch, show reason field
                    if (recommendedBatch && recommendedBatch !== selectedBatch && selectedBatch === 'Toddler (3-5 Yrs)') {
                        if (reasonSection) reasonSection.classList.remove('hidden');
                        if (reasonField) reasonField.required = true;
                    }
                }
            }
            
            window.checkApprovalRequirement();
            });
        }
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
        const isChangingFromRecommended = currentLeadData.recommended_batch && batchCat !== currentLeadData.recommended_batch;
        
        // If 3-5 years and trying to select morning without changing to 5-8 batch, show error
        if (is3to5 && timeSlot === 'Morning' && batchCat !== 'Beginner (5-8 Yrs)') {
            needsApproval = true;
            approvalMessage = 'Morning batch is not available for 3-5 years age group. Please select Evening/Weekend time slot or change batch to 5-8 Yrs.';
            // Reset to Evening
            document.getElementById('reg-time-slot').value = 'Evening';
            window.checkApprovalRequirement();
            return;
        }
        
        // If changing batch from recommended, need approval with reason
        if (isChangingFromRecommended) {
            needsApproval = true;
            const reasonField = document.getElementById('batch-change-reason-text');
            const reasonSection = document.getElementById('batch-change-reason-section');
            if (reasonSection) reasonSection.classList.remove('hidden');
            if (reasonField) {
                reasonField.required = true;
                if (!reasonField.value.trim()) {
                    approvalMessage = `You've selected a different batch (${batchCat}) than recommended (${currentLeadData.recommended_batch}). Please provide a reason for this change. Admin will review and confirm.`;
                } else {
                    approvalMessage = `Batch change request submitted. Admin will review your reason and confirm.`;
                }
            } else {
                approvalMessage = `You've selected a different batch (${batchCat}) than recommended (${currentLeadData.recommended_batch}). Please provide a reason for this change. Admin will review and confirm.`;
            }
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
    
    // Update session days section when package changes
    window.updateSessionDaysSection();
}

// Update session days section based on package type
export function updateSessionDaysSection() {
    const sessionDaysSection = document.getElementById('session-days-section');
    const unlimitedInfo = document.getElementById('unlimited-session-info');
    const limitedSelect = document.getElementById('limited-session-select');
    const batchCat = document.getElementById('reg-batch-category').value;
    const timeSlot = document.getElementById('reg-time-slot').value;
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const isAdult = age >= ADULT_AGE_THRESHOLD;
    const pkgSelect = document.getElementById('reg-package-select');
    const selectedPkg = pkgSelect.value;
    
    // Hide both sections initially
    if (sessionDaysSection) sessionDaysSection.classList.add('hidden');
    if (unlimitedInfo) unlimitedInfo.classList.add('hidden');
    if (limitedSelect) limitedSelect.classList.add('hidden');
    
    // Only show if package is selected and not PT
    if (!selectedPkg || batchCat === 'Personal Training') return;
    
    // Check if package is unlimited (classes = 999)
    let isUnlimited = false;
    if (isAdult && batchCat === 'Morning Batch') {
        isUnlimited = true;
    } else if (selectedPkg) {
        const pkgParts = selectedPkg.split('|');
        const classes = parseInt(pkgParts[2] || '0');
        isUnlimited = classes >= 999;
    }
    
    if (sessionDaysSection) sessionDaysSection.classList.remove('hidden');
    
    if (isUnlimited) {
        // Show unlimited info
        if (unlimitedInfo) unlimitedInfo.classList.remove('hidden');
        if (limitedSelect) limitedSelect.classList.add('hidden');
        
        // Generate session days info based on age and time preference
        const detailsEl = document.getElementById('unlimited-session-details');
        if (detailsEl) {
            let details = '';
            
            // Use CLASS_SCHEDULE to show accurate schedule based on age and time preference
            if (isAdult && batchCat === 'Morning Batch') {
                // Adults: Morning batch only (Tue-Fri, 6:15-7:15 AM)
                details = '<ul class="space-y-2 list-none"><li class="flex items-start"><span class="mr-2">📅</span><span><strong>Tuesday to Friday:</strong> 6:15 AM - 7:15 AM</span></li></ul>';
            } else if (timeSlot === 'Morning') {
                // Kids: Morning batch (5+ years) - Tue-Fri + Weekends
                details = '<ul class="space-y-2 list-none">';
                details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Tuesday to Friday:</strong> 6:15 AM - 7:15 AM</span></li>';
                // Add weekend slots based on age from CLASS_SCHEDULE
                if (age >= 3 && age <= 5) {
                    // Saturday: 11am-12pm for 3-5 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 11:00 AM - 12:00 PM</span></li>';
                    // Sunday: 11am-12pm for 3-5 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 11:00 AM - 12:00 PM</span></li>';
                } else if (age >= 6 && age <= 8) {
                    // Saturday: 3pm-4pm for 6-8 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 3:00 PM - 4:00 PM</span></li>';
                    // Sunday: 10am-11am for 6-8 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 10:00 AM - 11:00 AM</span></li>';
                } else if (age >= 8 && age < 15) {
                    // Saturday: 4pm-5pm for 8-14 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 4:00 PM - 5:00 PM</span></li>';
                    // Sunday: 12pm-1pm for 8-14 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 12:00 PM - 1:00 PM</span></li>';
                }
                details += '</ul>';
            } else {
                // Evening/Weekend schedule from CLASS_SCHEDULE
                details = '<ul class="space-y-2 list-none">';
                if (age >= 3 && age <= 5) {
                    // Evening: Wed-Fri, 4-5 PM for 3-5 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Wednesday to Friday:</strong> 4:00 PM - 5:00 PM</span></li>';
                    // Saturday: 11am-12pm for 3-5 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 11:00 AM - 12:00 PM</span></li>';
                    // Sunday: 11am-12pm for 3-5 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 11:00 AM - 12:00 PM</span></li>';
                } else if (age >= 5 && age <= 8) {
                    // Evening: Wed-Fri, 5-6 PM for 5-8 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Wednesday to Friday:</strong> 5:00 PM - 6:00 PM</span></li>';
                    // Saturday: 3pm-4pm for 6-8 yrs (note: 5-8 includes 6-8)
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 3:00 PM - 4:00 PM</span></li>';
                    // Sunday: 10am-11am for 6-8 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 10:00 AM - 11:00 AM</span></li>';
                } else if (age >= 8 && age < 15) {
                    // Evening: Wed-Fri, 6-7 PM for 8-14 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Wednesday to Friday:</strong> 6:00 PM - 7:00 PM</span></li>';
                    // Saturday: 4pm-5pm for 8-14 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Saturday:</strong> 4:00 PM - 5:00 PM</span></li>';
                    // Sunday: 12pm-1pm for 8-14 yrs
                    details += '<li class="flex items-start"><span class="mr-2">📅</span><span><strong>Sunday:</strong> 12:00 PM - 1:00 PM</span></li>';
                }
                details += '</ul>';
            }
            detailsEl.innerHTML = details;
        }
    } else {
        // Show limited package selection (2 preferred days)
        if (limitedSelect) limitedSelect.classList.remove('hidden');
        if (unlimitedInfo) unlimitedInfo.classList.add('hidden');
        
        // Reset checkboxes
        document.querySelectorAll('.session-day-checkbox').forEach(cb => cb.checked = false);
        const errorEl = document.getElementById('session-days-error');
        if (errorEl) errorEl.classList.add('hidden');
    }
};

// Limit session days selection to 2
export function limitSessionDays() {
    const checkboxes = document.querySelectorAll('.session-day-checkbox:checked');
    const errorEl = document.getElementById('session-days-error');
    
    if (checkboxes.length > 2) {
        // Uncheck the last one
        checkboxes[checkboxes.length - 1].checked = false;
        if (errorEl) errorEl.classList.remove('hidden');
        setTimeout(() => {
            if (errorEl) errorEl.classList.add('hidden');
        }, 3000);
    } else if (checkboxes.length === 2) {
        if (errorEl) errorEl.classList.add('hidden');
    } else if (checkboxes.length < 2) {
        // Show error if less than 2 selected
        if (errorEl) errorEl.classList.remove('hidden');
    }
};

// Toggle payment mode (UPI/Cash) and show/hide relevant sections
export function togglePaymentMode() {
    const paymentMode = document.getElementById('payment-mode').value;
    const upiSection = document.getElementById('upi-payment-section');
    const cashSection = document.getElementById('cash-payment-section');
    const paymentProof = document.getElementById('payment-proof');
    
    if (paymentMode === 'UPI') {
        if (upiSection) upiSection.classList.remove('hidden');
        if (cashSection) cashSection.classList.add('hidden');
        if (paymentProof) {
            paymentProof.required = true;
            // Load appropriate QR code based on registration number
            const regNumber = currentRegistrationId;
            if (regNumber) {
                const qrImage = document.getElementById('qr-code-image');
                if (qrImage) {
                    // Odd registration number = QR1, Even = QR2
                    const qrFile = (regNumber % 2 === 1) ? 'qr1.png' : 'qr2.png';
                    qrImage.src = qrFile;
                }
            }
        }
    } else if (paymentMode === 'Cash') {
        if (upiSection) upiSection.classList.add('hidden');
        if (cashSection) cashSection.classList.remove('hidden');
        if (paymentProof) {
            paymentProof.required = false;
            paymentProof.value = ''; // Clear file input
        }
    } else {
        // No selection
        if (upiSection) upiSection.classList.add('hidden');
        if (cashSection) cashSection.classList.add('hidden');
        if (paymentProof) {
            paymentProof.required = false;
            paymentProof.value = '';
        }
    }
};

export async function submitRegistration(actionType) {
    // Validation in field order: Time Preference -> Batch Category -> Package -> Session Days -> Start Date -> Payment Mode -> UPI Upload
    const timeSlot = document.getElementById('reg-time-slot').value;
    if (!timeSlot) return showErrorModal("Time Preference Required", "Please select a time preference (Evening/Weekend or Morning).");
    
    const batchCat = document.getElementById('reg-batch-category').value;
    if (!batchCat) return showErrorModal("Batch Category Required", "Please select a batch category.");
    
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
                return showErrorModal("Start Date Required", "Please select a preferred start date for Personal Training.");
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
        if (!val) return showErrorModal("Package Selection Required", "Please select a package.");
        pkgLabel = document.querySelector(`#reg-package-select option[value="${val}"]`).text;
        
        // Check session days for limited packages
        const pkgParts = val.split('|');
        const classes = parseInt(pkgParts[2] || '0', 10);
        const isUnlimited = classes >= 999;
        
        // Only validate session days if it's a limited package AND the session days section is visible
        if (!isUnlimited) {
            const sessionDaysSection = document.getElementById('session-days-section');
            const limitedSelect = document.getElementById('limited-session-select');
            
            // Only validate if the limited session select section is visible
            if (sessionDaysSection && !sessionDaysSection.classList.contains('hidden') && 
                limitedSelect && !limitedSelect.classList.contains('hidden')) {
                const selectedDays = Array.from(document.querySelectorAll('.session-day-checkbox:checked'));
                if (selectedDays.length !== 2) {
                    return showErrorModal("Session Days Required", "Please select exactly 2 preferred days for planning purposes.");
                }
            }
        }
    }
    
    // Start Date validation
    const startDate = document.getElementById('reg-date').value;
    if (!startDate) return showErrorModal("Start Date Required", "Please select a start date for your package.");

    if (actionType === 'REQUEST') {
        let note = `Request: ${document.getElementById('reg-time-slot').value} - ${batchCat}. Plan: ${pkgLabel}`;
        
        // Add batch change reason if provided
        const reasonField = document.getElementById('batch-change-reason-text');
        const reasonSection = document.getElementById('batch-change-reason-section');
        if (reasonSection && !reasonSection.classList.contains('hidden') && reasonField && reasonField.value.trim()) {
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

    // Payment Mode validation
    const paymentMode = document.getElementById('payment-mode').value;
    if (!paymentMode) return showErrorModal("Payment Mode Required", "Please select a payment mode (UPI or Cash).");
    
    const fileInput = document.getElementById('payment-proof');
    let paymentProofUrl = null;
    
    // Only require and upload proof for UPI payments
    if (paymentMode === 'UPI') {
        if (!fileInput || fileInput.files.length === 0) {
            return showErrorModal("UPI Payment Confirmation Required", "Please upload your UPI payment confirmation screenshot.");
        }
        
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
// View assessment details - Enhanced with Tumble Gym theme
window.viewAssessmentDetails = function(leadString) {
    const child = JSON.parse(decodeURIComponent(leadString));
    const feedback = child.feedback || 'No detailed feedback provided yet.';
    const skills = child.skills_rating || {};
    const activeSkills = [];
    const skillIcons = {
        listening: '👂',
        flexibility: '🤸',
        strength: '💪',
        balance: '⚖️'
    };
    
    if (skills.listening) activeSkills.push({ name: 'Listening', icon: skillIcons.listening });
    if (skills.flexibility) activeSkills.push({ name: 'Flexibility', icon: skillIcons.flexibility });
    if (skills.strength) activeSkills.push({ name: 'Strength', icon: skillIcons.strength });
    if (skills.balance) activeSkills.push({ name: 'Balance', icon: skillIcons.balance });
    
    const recommendedBatch = child.recommended_batch || 'Standard Batch';
    const isPTRecommended = skills.personal_training || false;
    const isSpecialNeeds = skills.special_needs || false;
    
    // Create assessment modal HTML
    const modal = document.createElement('div');
    modal.id = 'parent-assessment-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <div class="sticky top-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 p-6 rounded-t-2xl text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-extrabold flex items-center gap-2">
                            <span class="text-3xl">📊</span>
                            <span>Assessment Report</span>
                        </h2>
                        <p class="text-purple-100 text-sm mt-1">${child.child_name}'s Trial Assessment</p>
                    </div>
                    <button onclick="document.getElementById('parent-assessment-modal').remove()" class="text-white hover:text-purple-200 transition text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20">
                        ×
                    </button>
                </div>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- Recommended Program -->
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-2 border-blue-200">
                    <h3 class="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <span class="text-2xl">🌟</span>
                        <span>Recommended Program</span>
                    </h3>
                    <div class="bg-white p-4 rounded-lg border border-blue-100">
                        <p class="text-2xl font-extrabold text-blue-700 mb-2">${recommendedBatch}</p>
                        ${isPTRecommended ? `<p class="text-sm text-purple-700 font-bold mt-2 flex items-center gap-2"><i class="fas fa-dumbbell"></i> Personal Training Recommended</p>` : ''}
                        ${isSpecialNeeds ? `<p class="text-sm text-amber-700 font-bold mt-2 flex items-center gap-2"><i class="fas fa-heart"></i> Special Needs Support Available</p>` : ''}
                    </div>
                </div>
                
                <!-- Trainer Feedback -->
                <div class="bg-gradient-to-br from-yellow-50 to-amber-50 p-5 rounded-xl border-2 border-yellow-200">
                    <h3 class="text-lg font-bold text-yellow-900 mb-3 flex items-center gap-2">
                        <span class="text-2xl">💬</span>
                        <span>Trainer's Feedback</span>
                    </h3>
                    <div class="bg-white p-4 rounded-lg border border-yellow-100">
                        <p class="text-slate-700 leading-relaxed whitespace-pre-wrap">${sanitizeInput(feedback)}</p>
                    </div>
                </div>
                
                <!-- Strengths Observed -->
                ${activeSkills.length > 0 ? `
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border-2 border-green-200">
                    <h3 class="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                        <span class="text-2xl">✨</span>
                        <span>Strengths Observed</span>
                    </h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        ${activeSkills.map(skill => `
                            <div class="bg-white p-3 rounded-lg border border-green-100 text-center">
                                <div class="text-3xl mb-2">${skill.icon}</div>
                                <p class="text-xs font-bold text-green-800">${skill.name}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : `
                <div class="bg-slate-50 p-5 rounded-xl border-2 border-slate-200 text-center">
                    <p class="text-slate-500 text-sm">No specific strengths noted yet.</p>
                </div>
                `}
                
                <!-- Next Steps -->
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border-2 border-purple-200">
                    <h3 class="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                        <span class="text-2xl">🚀</span>
                        <span>Next Steps</span>
                    </h3>
                    <div class="bg-white p-4 rounded-lg border border-purple-100">
                        <p class="text-sm text-purple-800 mb-3">Ready to continue your gymnastics journey? Click below to proceed with registration!</p>
                        <button onclick="window.openRegistrationModal('${leadString}', false); document.getElementById('parent-assessment-modal').remove();" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-105">
                            Proceed to Registration 🎯
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
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
