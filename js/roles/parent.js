// js/roles/parent.js (v60 - RESTORED Full Logic: PT, Special Needs, Validation)
import { supabaseClient, REGISTRATION_FEE, STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, ADULT_AGE_THRESHOLD } from '../config.js';
import { showView, showSuccessModal, calculateAge } from '../utils.js';

let currentRegistrationId = null;
let currentLeadData = null;

// --- 1. INTAKE FORM (With Strict Validation) ---
export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    
    // 1. Capture & Sanitize
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim().replace(/\D/g, ''); 
    const altPhone = document.getElementById('alt_phone').value.trim().replace(/\D/g, ''); 

    // 2. Strict Validation
    if (phone.length !== 10) { alert("Primary Mobile Number must be exactly 10 digits."); return; }
    if (altPhone.length !== 10) { alert("Emergency Contact Number must be exactly 10 digits."); return; }

    btn.innerText = "Processing..."; btn.disabled = true;

    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const formData = {
        parent_name: document.getElementById('p_name').value.trim(), 
        child_name: document.getElementById('k_name').value.trim(),
        phone: phone, email: email, 
        address: document.getElementById('address').value.trim(),
        dob: document.getElementById('dob').value, gender: document.getElementById('gender').value,
        intent: intentVal, medical_info: document.getElementById('medical').value.trim(), 
        how_heard: sourceVal, alternate_phone: altPhone,
        marketing_consent: document.getElementById('marketing_check').checked,
        is_trial: true, status: 'Pending Trial', submitted_at: new Date()
    };

    try {
        const { data: authData } = await supabaseClient.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            const { data: roleData } = await supabaseClient.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) {
                await supabaseClient.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
            }
        }
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if (error) throw error;
        
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { 
            method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseClient.supabaseKey}`}, body: JSON.stringify({record: formData}) 
        });

        document.getElementById('success-modal').classList.remove('hidden');
        document.querySelector('#success-modal h3').innerText = "Account Created!";
        document.querySelector('#success-modal p').innerText = "Your trial request has been submitted successfully.";
        
        e.target.reset(); document.getElementById('age-display').classList.add('hidden');
    } catch (err) { alert("Error: " + err.message); } finally { btn.innerText = originalText; btn.disabled = false; }
}

// --- 2. PARENT DASHBOARD ---
export async function loadParentDashboard(email) {
    showView('parent-portal');
    const container = document.getElementById('parent-content');
    container.innerHTML = `<div class="animate-pulse space-y-4"><div class="h-40 bg-slate-100 rounded-3xl"></div><div class="h-40 bg-slate-100 rounded-3xl"></div></div>`;
    container.className = "space-y-6 max-w-lg mx-auto";

    const { data, error } = await supabaseClient.from('leads').select('*').eq('email', email).order('created_at', { ascending: false });

    if (error) { container.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`; return; }
    if (!data || data.length === 0) { 
        container.innerHTML = `<div class="text-center p-8 bg-white rounded-3xl border border-slate-100 mt-10"><h3 class="font-bold text-slate-800">No Students Yet</h3><button onclick="window.location.reload()" class="btn-primary mt-4">Register Now</button></div>`; return; 
    }

    let html = '';
    for (const child of data) {
        const leadString = encodeURIComponent(JSON.stringify(child));
        const age = calculateAge(child.dob);
        let statusBadge = 'Trial Pending', statusColor = 'bg-yellow-100 text-yellow-700';
        let actionArea = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>`;

        if (child.status === 'Trial Completed') {
            statusBadge = 'Assessment Ready'; statusColor = 'bg-blue-100 text-blue-700';
            const rec = child.recommended_batch || 'Standard';
            // Logic to show "Special Needs" or "PT" in the card text if applicable
            let subText = `Trainer recommends: <strong>${rec}</strong>`;
            if (child.special_needs) subText = `<strong>Special Needs Program</strong> recommended.`;
            if (child.skills_rating?.personal_training) subText += ` <br>(Personal Training Advised)`;

            actionArea = `
                <div class="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex items-start gap-3">
                    <div class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check text-xs"></i></div>
                    <div><h4 class="font-bold text-blue-900 text-sm">Trial Successful!</h4><p class="text-xs text-blue-700 mt-1">${subText}</p></div>
                </div>
                <button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Proceed to Registration</button>`;
        }
        else if (child.status === 'Enrollment Requested') {
            statusBadge = 'Pending Approval'; statusColor = 'bg-orange-100 text-orange-700';
            actionArea = `<div class="bg-orange-50 p-4 rounded-xl mb-4 border border-orange-100 flex items-start gap-3"><div class="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-clock text-xs"></i></div><div><h4 class="font-bold text-orange-900 text-sm">Request Sent</h4><p class="text-xs text-orange-800 mt-1">Admin is verifying batch availability.</p></div></div><button disabled class="w-full bg-orange-100 text-orange-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Admin...</button>`;
        }
        else if (child.status === 'Ready to Pay') {
            statusBadge = 'Approved'; statusColor = 'bg-green-100 text-green-700';
            actionArea = `<div class="bg-green-50 p-4 rounded-xl mb-4 border border-green-100 flex items-start gap-3"><div class="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><i class="fas fa-check-double text-xs"></i></div><div><h4 class="font-bold text-green-900 text-sm">Admission Approved!</h4><p class="text-xs text-green-800 mt-1"><strong>${child.final_batch}</strong><br>Fee: ₹${child.final_price}</p></div></div><button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 animate-pulse">Pay Now & Enroll</button>`;
        }
        else if (child.status === 'Registration Requested') {
             statusBadge = 'Verifying Payment'; statusColor = 'bg-purple-100 text-purple-700';
             actionArea = `<div class="text-center p-4 bg-purple-50 rounded-xl border border-purple-100"><p class="text-xs font-bold text-purple-700 mb-2">Payment Receipt Uploaded</p><button disabled class="bg-white text-purple-400 text-xs font-bold py-2 px-4 rounded-lg border border-purple-100">Processing...</button></div>`;
        } 
        else if (child.status === 'Enrolled') {
             statusBadge = 'Active Student'; statusColor = 'bg-emerald-100 text-emerald-700';
             actionArea = `<div class="flex items-center gap-2 mb-4 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100"><span class="w-2 h-2 bg-emerald-500 rounded-full"></span> Active</div><button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-emerald-600 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50 transition">Renew Membership</button>`;
        }
        else if (child.status === 'Follow Up') {
            statusBadge = 'On Hold'; statusColor = 'bg-orange-100 text-orange-700';
            const fDate = child.follow_up_date ? new Date(child.follow_up_date).toLocaleDateString() : 'Future';
            actionArea = `<div class="text-xs text-orange-800 bg-orange-50 p-3 rounded-lg mb-3 border border-orange-100">Follow-up: <strong>${fDate}</strong></div><button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600">Resume Registration</button>`;
        }

        const { count } = await supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('lead_id', child.id).eq('sender_role', 'trainer').eq('is_read', false);
        const badgeHidden = count > 0 ? '' : 'hidden';
        const msgBadge = `<span id="msg-badge-${child.id}" class="${badgeHidden} absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>`;

        html += `<div class="relative rounded-3xl p-6 shadow-sm border border-slate-100 bg-white mb-4 hover:shadow-md transition-all duration-300"><div class="flex justify-between items-start mb-4"><div class="flex gap-4 items-center"><div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg">${child.child_name.charAt(0)}</div><div><h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3><p class="text-xs font-bold text-slate-400 uppercase mt-0.5">${age} Yrs • ${child.intent}</p></div></div><span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">${statusBadge}</span></div>${actionArea}<div class="flex gap-3 mt-4 pt-4 border-t border-slate-50"><button onclick="window.openParentChat('${leadString}')" class="flex-1 text-xs font-bold text-slate-500 hover:text-blue-600 relative py-2 rounded-lg hover:bg-slate-50 transition"><i class="fas fa-comment-alt mr-2"></i>Chat with Coach ${msgBadge}</button><button onclick="window.openEditModal('${leadString}')" class="w-10 text-xs font-bold text-slate-500 hover:text-blue-600 py-2 rounded-lg hover:bg-slate-50 transition"><i class="fas fa-pen"></i></button></div></div>`;
    }
    container.innerHTML = html;
}

// --- 3. SMART REGISTRATION LOGIC (RESTORED) ---
export function openRegistrationModal(leadString, isRenewal) {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    currentLeadData = child;
    const age = calculateAge(child.dob);

    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('reg-child-age').innerText = age;
    document.getElementById('is-renewal').value = isRenewal;
    document.getElementById('reg-modal').classList.remove('hidden');

    // 1. Defaults based on Age
    const timeSlotEl = document.getElementById('reg-time-slot');
    const batchCatEl = document.getElementById('reg-batch-category');
    batchCatEl.innerHTML = ''; 

    // --- RESTORED LOGIC: Check for Special Needs / PT Recommendation ---
    // If trainer checked "Special Needs" or "PT", we should pre-select or notify
    const isSpecial = child.special_needs;
    const isPT = child.skills_rating?.personal_training;

    if (age >= ADULT_AGE_THRESHOLD) {
        timeSlotEl.value = "Morning";
        timeSlotEl.disabled = true; 
        batchCatEl.innerHTML = `<option value="Adults">Adults (15+)</option>`;
    } else {
        timeSlotEl.disabled = false;
        timeSlotEl.value = "Evening"; 
        
        // Add Standard Batches
        if(age <= 5) batchCatEl.innerHTML += `<option value="Toddler (3-5 Yrs)">Toddler (3-5 Yrs)</option>`;
        if(age >= 5 && age <= 8) batchCatEl.innerHTML += `<option value="Beginner (5-8 Yrs)">Beginner (5-8 Yrs)</option>`;
        if(age >= 8 && age < 15) batchCatEl.innerHTML += `<option value="Intermediate (8+ Yrs)">Intermediate (8+ Yrs)</option>`;
        
        // --- RESTORED: Add Special/PT Options if applicable ---
        if (isSpecial) batchCatEl.innerHTML += `<option value="Special Needs" selected>Special Needs</option>`;
        if (isPT) batchCatEl.innerHTML += `<option value="Personal Training" selected>Personal Training</option>`;
        
        batchCatEl.innerHTML += `<option value="Other">Other / Request Change</option>`;
        
        // Auto-select logic
        if (isPT) batchCatEl.value = "Personal Training";
        else if (isSpecial) batchCatEl.value = "Special Needs";
        else if (child.recommended_batch) {
            const options = Array.from(batchCatEl.options).map(o => o.value);
            if(options.includes(child.recommended_batch)) batchCatEl.value = child.recommended_batch;
        }
    }

    // 2. Load Packages/UI
    window.checkApprovalRequirement(); // This now triggers UI update for PT too

    // 3. State Handling (Approved vs Pending)
    if (child.status === 'Ready to Pay') {
        document.getElementById('reg-program-display').innerText = child.final_batch;
        document.getElementById('total-price').innerText = child.final_price;
        // Lock controls
        timeSlotEl.disabled = true;
        batchCatEl.disabled = true;
        document.getElementById('reg-package-select').disabled = true;
        document.getElementById('reg-pt-level').disabled = true;
        
        document.getElementById('payment-section').classList.remove('hidden');
        document.getElementById('btn-submit-pay').classList.remove('hidden');
        document.getElementById('btn-submit-request').classList.add('hidden');
        document.getElementById('approval-notice').classList.add('hidden');
    } else {
        let displayRec = child.recommended_batch || "Standard Batch";
        if (isSpecial) displayRec = "Special Needs Program";
        if (isPT) displayRec = "Personal Training";
        document.getElementById('reg-program-display').innerText = displayRec;
    }
}

export function updatePackageOptions() {
    const timeSlot = document.getElementById('reg-time-slot').value;
    const pkgSelect = document.getElementById('reg-package-select');
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    
    pkgSelect.innerHTML = '<option value="" disabled selected>Select a Package...</option>';

    if (timeSlot === 'Morning') {
        const pkg = (age >= ADULT_AGE_THRESHOLD) ? MORNING_PACKAGES.ADULT : MORNING_PACKAGES.CHILD;
        pkgSelect.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label} - ₹${pkg.price}</option>`;
    } else {
        STANDARD_PACKAGES.forEach(pkg => {
            pkgSelect.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label} - ₹${pkg.price}</option>`;
        });
    }
    window.calculateTotal();
}

// --- RESTORED: Logic to Switch between Batch UI and PT UI ---
export function checkApprovalRequirement() {
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const batchCat = document.getElementById('reg-batch-category').value;
    const timeSlot = document.getElementById('reg-time-slot').value;
    const recBatch = currentLeadData.recommended_batch;
    
    // UI Elements
    const pkgSelectContainer = document.getElementById('reg-package-select').parentElement;
    const ptOptionsContainer = document.getElementById('group-pt-options');

    // 1. Toggle PT Mode
    if (batchCat === 'Personal Training') {
        pkgSelectContainer.classList.add('hidden');
        ptOptionsContainer.classList.remove('hidden');
        ptOptionsContainer.classList.add('grid');
    } else {
        pkgSelectContainer.classList.remove('hidden');
        ptOptionsContainer.classList.add('hidden');
        ptOptionsContainer.classList.remove('grid');
        window.updatePackageOptions(); // Refresh standard packages
    }

    // 2. Approval Logic
    let needsApproval = false;
    
    // Changing from recommended
    if (recBatch && batchCat !== recBatch && batchCat !== "Other" && batchCat !== "Personal Training") {
        if (age < ADULT_AGE_THRESHOLD) needsApproval = true;
    }
    if (batchCat === 'Other') needsApproval = true;
    if (batchCat === 'Personal Training' && !currentLeadData.skills_rating?.personal_training) needsApproval = true; // Selected PT but not recommended
    if (age < ADULT_AGE_THRESHOLD && timeSlot === 'Morning') needsApproval = true;

    // UI Toggle
    const notice = document.getElementById('approval-notice');
    const btnPay = document.getElementById('btn-submit-pay');
    const btnReq = document.getElementById('btn-submit-request');
    const paySection = document.getElementById('payment-section');

    if (needsApproval) {
        notice.classList.remove('hidden');
        btnPay.classList.add('hidden');
        btnReq.classList.remove('hidden');
        paySection.classList.add('hidden'); 
    } else {
        notice.classList.add('hidden');
        btnPay.classList.remove('hidden');
        btnReq.classList.add('hidden');
        paySection.classList.remove('hidden');
    }
    
    window.calculateTotal(); // Recalculate based on new mode
}

// --- RESTORED: Calculate Total handles both PT and Batch ---
export function calculateTotal() {
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    const batchCat = document.getElementById('reg-batch-category').value;
    let total = 0;

    if (batchCat === 'Personal Training') {
        // PT Logic
        const level = document.getElementById('reg-pt-level').value;
        const sessions = parseInt(document.getElementById('reg-pt-sessions').value) || 0;
        if (PT_RATES[level]) {
            total = PT_RATES[level] * sessions;
        }
    } else {
        // Standard Logic
        const pkgVal = document.getElementById('reg-package-select').value;
        if (pkgVal) {
            const parts = pkgVal.split('|'); 
            total = parseInt(parts[1]);
        }
    }

    if (!isRenewal && total > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total;
}

// --- 4. SUBMIT (Handles PT Fields) ---
export async function submitRegistration(actionType) {
    const batchCat = document.getElementById('reg-batch-category').value;
    const total = document.getElementById('total-price').innerText;
    let pkgLabel = "";

    // Validate based on mode
    if (batchCat === 'Personal Training') {
        const level = document.getElementById('reg-pt-level').value;
        const sessions = document.getElementById('reg-pt-sessions').value;
        pkgLabel = `PT (${level}) - ${sessions} Classes`;
    } else {
        const pkgVal = document.getElementById('reg-package-select').value;
        if (!pkgVal) return alert("Please select a package.");
        pkgLabel = document.querySelector(`#reg-package-select option[value="${pkgVal}"]`).text;
    }

    // REQUEST FLOW
    if (actionType === 'REQUEST') {
        const timeSlot = document.getElementById('reg-time-slot').value;
        const note = `Request: ${timeSlot} - ${batchCat}. Plan: ${pkgLabel}`;
        
        await supabaseClient.from('leads').update({
            status: 'Enrollment Requested',
            parent_note: note,
            final_price: total 
        }).eq('id', currentRegistrationId);
        
        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Request Sent!", "Admin will review your custom plan request.", () => window.location.reload());
        return;
    }

    // PAYMENT FLOW
    const fileInput = document.getElementById('payment-proof');
    if (fileInput.files.length === 0) return alert("Upload Payment Proof.");
    
    const btn = document.getElementById('btn-submit-pay');
    btn.innerText = "Uploading..."; btn.disabled = true;

    try {
        const file = fileInput.files[0];
        const fileName = `${currentRegistrationId}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabaseClient.storage.from('payment-proofs').upload(fileName, file);
        if(uploadError) throw uploadError;
        const { data: { publicUrl } } = supabaseClient.storage.from('payment-proofs').getPublicUrl(fileName);

        await supabaseClient.from('leads').update({
            status: 'Registration Requested',
            selected_package: pkgLabel, 
            package_price: total,
            payment_proof_url: publicUrl,
            start_date: document.getElementById('reg-date').value,
            session_days: Array.from(document.querySelectorAll('input[name="session_days"]:checked')).map(cb => cb.value),
            payment_status: 'Verification Pending'
        }).eq('id', currentRegistrationId);

        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Submitted!", "Registration & Payment info sent to Admin.", () => window.location.reload());
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Pay & Enroll"; }
}

// --- 5. HELPERS ---
export function openParentChat(str) { 
    const lead = JSON.parse(decodeURIComponent(str));
    const badge = document.getElementById(`msg-badge-${lead.id}`);
    if(badge) badge.classList.add('hidden');
    window.openChat(str); 
}
export function openEditModal(str) { window.openEditModal(str); }
export async function saveChildInfo() { window.saveChildInfo(); }
export function openFeedbackModal(id) { 
    document.getElementById('feedback-lead-id').value = id;
    document.getElementById('feedback-modal').classList.remove('hidden');
}
export async function submitParentFeedback() { 
    const id = document.getElementById('feedback-lead-id').value;
    const reason = document.getElementById('feedback-reason').value;
    const dateStr = document.getElementById('feedback-date').value;
    const note = document.getElementById('feedback-note').value;
    if (!reason) return alert("Please select a reason.");
    try {
        await supabaseClient.from('leads').update({
            status: 'Follow Up', feedback_reason: reason, 
            follow_up_date: dateStr || null, parent_note: note
        }).eq('id', id);
        showSuccessModal("Feedback Saved", "We will contact you later.", () => window.location.reload());
        document.getElementById('feedback-modal').classList.add('hidden');
    } catch (e) { alert(e.message); }
}
export function handlePackageChange() { window.calculateTotal(); }
