// js/roles/parent.js (v56 - Advanced Pricing & Approval Logic)
import { supabaseClient, REGISTRATION_FEE, STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, ADULT_AGE_THRESHOLD } from '../config.js';
import { showView, showSuccessModal, calculateAge, showToast } from '../utils.js';

let currentRegistrationId = null;
let currentLeadData = null;

// --- 1. INTAKE FORM (PRESERVED) ---
export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim().replace(/\D/g, '');
    let intentVal = document.getElementById('intent').value.includes('Other') ? document.getElementById('intent_other').value : document.getElementById('intent').value;
    let sourceVal = document.getElementById('source').value.includes('Other') ? document.getElementById('source_other').value : document.getElementById('source').value;

    const formData = {
        parent_name: document.getElementById('p_name').value.trim(), 
        child_name: document.getElementById('k_name').value.trim(),
        phone: phone, email: email, 
        address: document.getElementById('address').value.trim(),
        dob: document.getElementById('dob').value, gender: document.getElementById('gender').value,
        intent: intentVal, medical_info: document.getElementById('medical').value.trim(), 
        how_heard: sourceVal, alternate_phone: document.getElementById('alt_phone').value.trim().replace(/\D/g, ''),
        marketing_consent: document.getElementById('marketing_check').checked,
        is_trial: true, status: 'Pending Trial', submitted_at: new Date()
    };

    try {
        const { data: authData } = await supabaseClient.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            const { data: roleData } = await supabaseClient.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) await supabaseClient.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
        }
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if (error) throw error;
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseClient.supabaseKey}`}, body: JSON.stringify({record: formData}) });
        document.getElementById('success-modal').classList.remove('hidden');
        e.target.reset(); document.getElementById('age-display').classList.add('hidden');
    } catch (err) { alert("Error: " + err.message); } finally { btn.innerText = originalText; btn.disabled = false; }
}

// --- 2. PARENT DASHBOARD (UPDATED FOR APPROVAL WORKFLOW) ---
export async function loadParentDashboard(email) {
    showView('parent-portal');
    const container = document.getElementById('parent-content');
    
    // Skeleton Loader (Preserved)
    container.innerHTML = `<div class="animate-pulse space-y-4"><div class="h-40 bg-slate-100 rounded-3xl"></div><div class="h-40 bg-slate-100 rounded-3xl"></div></div>`;
    container.className = "space-y-6 max-w-lg mx-auto";

    const { data, error } = await supabaseClient.from('leads').select('*').eq('email', email).order('created_at', { ascending: false });

    if (error) { container.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`; return; }
    if (!data || data.length === 0) { 
        container.innerHTML = `<div class="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm mx-auto mt-10"><h3 class="text-lg font-bold text-slate-800">No Students Yet</h3><button onclick="window.location.reload()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4">Register Now</button></div>`; 
        return; 
    }

    let html = '';
    for (const child of data) {
        const leadString = encodeURIComponent(JSON.stringify(child));
        const age = calculateAge(child.dob);
        
        let statusBadge = 'Trial Pending';
        let statusColor = 'bg-yellow-100 text-yellow-700';
        let actionArea = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>`;

        // A. Trial Done -> Proceed to Select Package
        if (child.status === 'Trial Completed') {
            statusBadge = 'Assessment Done';
            statusColor = 'bg-blue-100 text-blue-700';
            const rec = child.recommended_batch || 'Standard';
            actionArea = `
                <div class="bg-blue-50 p-3 rounded-lg mb-3 text-xs text-blue-800"><strong>Result:</strong> ${rec}</div>
                <button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700">Proceed to Registration</button>`;
        }
        // B. Requested -> Waiting for Admin
        else if (child.status === 'Enrollment Requested') {
            statusBadge = 'Waiting Approval';
            statusColor = 'bg-orange-100 text-orange-700';
            actionArea = `<div class="p-3 bg-orange-50 border border-orange-100 rounded-lg text-center text-xs text-orange-800"><strong>Request Sent!</strong><br>Admin is checking availability for your selection.</div>`;
        }
        // C. Approved -> Pay Now
        else if (child.status === 'Ready to Pay') {
            statusBadge = 'Approved';
            statusColor = 'bg-green-100 text-green-700';
            actionArea = `
                <div class="bg-green-50 p-3 rounded-lg mb-3 text-xs text-green-800 border border-green-100">
                    <strong>Confirmed:</strong> ${child.final_batch || 'Batch'}<br><strong>Fee:</strong> ₹${child.final_price}
                </div>
                <button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-green-700 animate-pulse">Pay Now</button>`;
        }
        // D. Verification
        else if (child.status === 'Registration Requested') {
             statusBadge = 'Verifying Payment'; statusColor = 'bg-purple-100 text-purple-700';
             actionArea = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl">Payment Verification...</button>`;
        } 
        // E. Enrolled
        else if (child.status === 'Enrolled') {
             statusBadge = 'Active'; statusColor = 'bg-emerald-100 text-emerald-700';
             actionArea = `<button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-emerald-600 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50">Renew Membership</button>`;
        }
        // F. On Hold
        else if (child.status === 'Follow Up') {
            statusBadge = 'On Hold'; statusColor = 'bg-orange-100 text-orange-700';
            actionArea = `<button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600">Resume Registration</button>`;
        }

        // Chat Badge Logic
        const { count } = await supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('lead_id', child.id).eq('sender_role', 'trainer').eq('is_read', false);
        const badgeHidden = count > 0 ? '' : 'hidden';
        const msgBadge = `<span id="msg-badge-${child.id}" class="${badgeHidden} absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>`;

        html += `<div class="relative rounded-3xl p-6 shadow-sm border border-slate-100 bg-white mb-4">
            <div class="flex justify-between items-start mb-4"><div><h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3><p class="text-xs font-bold text-slate-400 uppercase mt-1">${age} Yrs • ${child.intent}</p></div><span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded uppercase">${statusBadge}</span></div>
            ${actionArea}
            <div class="flex gap-3 mt-4 pt-4 border-t border-slate-50">
                <button onclick="window.openParentChat('${leadString}')" class="flex-1 text-xs font-bold text-slate-500 hover:text-blue-600 relative"><i class="fas fa-comment-alt mr-2"></i>Chat ${msgBadge}</button>
                <button onclick="window.openEditModal('${leadString}')" class="text-xs font-bold text-slate-500 hover:text-blue-600"><i class="fas fa-pen"></i></button>
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

// --- 3. SMART REGISTRATION LOGIC (NEW) ---

export function openRegistrationModal(leadString, isRenewal) {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    currentLeadData = child;
    const age = calculateAge(child.dob);

    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('reg-child-age').innerText = age;
    document.getElementById('is-renewal').value = isRenewal;
    document.getElementById('reg-modal').classList.remove('hidden');

    // 1. Setup Defaults based on Age
    const timeSlotEl = document.getElementById('reg-time-slot');
    const batchCatEl = document.getElementById('reg-batch-category');
    
    batchCatEl.innerHTML = ''; // Clear

    // Rule: 15+ must be Adult
    if (age >= ADULT_AGE_THRESHOLD) {
        timeSlotEl.value = "Morning";
        timeSlotEl.disabled = true; // Lock to Morning for Adults
        batchCatEl.innerHTML = `<option value="Adults">Adults (15+)</option>`;
    } else {
        timeSlotEl.disabled = false;
        timeSlotEl.value = "Evening"; // Default for kids
        // Add options relevant to age
        if(age <= 5) batchCatEl.innerHTML += `<option value="Toddler (3-5 Yrs)">Toddler (3-5 Yrs)</option>`;
        if(age >= 5 && age <= 8) batchCatEl.innerHTML += `<option value="Beginner (5-8 Yrs)">Beginner (5-8 Yrs)</option>`;
        if(age >= 8 && age < 15) batchCatEl.innerHTML += `<option value="Intermediate (8+ Yrs)">Intermediate (8+ Yrs)</option>`;
        // Allow request change
        batchCatEl.innerHTML += `<option value="Other">Other / Request Change</option>`;
        
        // Auto-select based on Trainer Recommendation
        if (child.recommended_batch) {
            // Try to match recommendation string to option value
            const options = Array.from(batchCatEl.options).map(o => o.value);
            if(options.includes(child.recommended_batch)) batchCatEl.value = child.recommended_batch;
        }
    }

    // 2. Load Packages based on Time Slot
    window.updatePackageOptions();

    // 3. Handle "Approved / Ready to Pay" State
    if (child.status === 'Ready to Pay') {
        document.getElementById('reg-program-display').innerText = child.final_batch;
        document.getElementById('total-price').innerText = child.final_price;
        // Lock controls
        timeSlotEl.disabled = true;
        batchCatEl.disabled = true;
        document.getElementById('reg-package-select').disabled = true;
        // Show Pay button
        document.getElementById('payment-section').classList.remove('hidden');
        document.getElementById('btn-submit-pay').classList.remove('hidden');
        document.getElementById('btn-submit-request').classList.add('hidden');
        document.getElementById('approval-notice').classList.add('hidden');
    } else {
        document.getElementById('reg-program-display').innerText = child.recommended_batch || "Standard Batch";
        window.checkApprovalRequirement(); // Run logic to see button state
    }
}

// Called when Time Slot changes
export function updatePackageOptions() {
    const timeSlot = document.getElementById('reg-time-slot').value;
    const pkgSelect = document.getElementById('reg-package-select');
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    
    pkgSelect.innerHTML = '<option value="" disabled selected>Select a Package...</option>';

    if (timeSlot === 'Morning') {
        // Morning: Only Monthly Unlimited
        const pkg = (age >= ADULT_AGE_THRESHOLD) ? MORNING_PACKAGES.ADULT : MORNING_PACKAGES.CHILD;
        pkgSelect.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label} - ₹${pkg.price}</option>`;
    } else {
        // Evening: Load Standard Packages
        STANDARD_PACKAGES.forEach(pkg => {
            pkgSelect.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label} - ₹${pkg.price}</option>`;
        });
    }
    window.calculateTotal();
}

// Logic: Pay Now vs Request Approval
export function checkApprovalRequirement() {
    const age = parseInt(document.getElementById('reg-child-age').innerText);
    const batchCat = document.getElementById('reg-batch-category').value;
    const timeSlot = document.getElementById('reg-time-slot').value;
    const recBatch = currentLeadData.recommended_batch; // What trainer said

    let needsApproval = false;

    // Rule 1: Changing Batch Category from Recommendation
    if (recBatch && batchCat !== recBatch && batchCat !== "Other") {
        // If they pick a standard batch that ISN'T what trainer recommended -> Approval
        // (Unless they are Adult where there's only one option)
        if (age < ADULT_AGE_THRESHOLD) needsApproval = true;
    }
    
    // Rule 2: Selecting "Other"
    if (batchCat === 'Other') needsApproval = true;

    // Rule 3: PT selected (Logic to come if PT dropdown is active)
    // For now, if Time Slot changed to Morning for a Kid -> Approval
    if (age < ADULT_AGE_THRESHOLD && timeSlot === 'Morning') needsApproval = true;

    // UI Updates
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
}

export function calculateTotal() {
    const pkgVal = document.getElementById('reg-package-select').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let total = 0;

    if (pkgVal) {
        const parts = pkgVal.split('|'); // id|price|classes|months
        total = parseInt(parts[1]);
    }

    if (!isRenewal && total > 0) total += REGISTRATION_FEE;
    
    document.getElementById('total-price').innerText = total;
}

export async function submitRegistration(actionType) {
    const pkgVal = document.getElementById('reg-package-select').value;
    const total = document.getElementById('total-price').innerText;
    
    if (!pkgVal) return alert("Please select a package.");

    // ACTION: REQUEST APPROVAL
    if (actionType === 'REQUEST') {
        const batchCat = document.getElementById('reg-batch-category').value;
        const timeSlot = document.getElementById('reg-time-slot').value;
        // Parse friendly name from value
        const pkgLabel = document.querySelector(`#reg-package-select option[value="${pkgVal}"]`).text;
        
        const note = `Request: ${timeSlot} - ${batchCat}. Plan: ${pkgLabel}`;
        
        await supabaseClient.from('leads').update({
            status: 'Enrollment Requested',
            parent_note: note,
            final_price: total // Proposed price
        }).eq('id', currentRegistrationId);
        
        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Request Sent", "Admin will verify your batch request and approve the fee.", () => window.location.reload());
        return;
    }

    // ACTION: PAY NOW
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

        const pkgParts = pkgVal.split('|'); // id|price|classes|months

        // Construct Final Package Name
        const pkgLabel = document.querySelector(`#reg-package-select option[value="${pkgVal}"]`).text;

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
        showSuccessModal("Submitted!", "Payment proof uploaded. Admin will verify shortly.", () => window.location.reload());
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Pay & Enroll"; }
}

// --- 4. HELPERS (PRESERVED) ---
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
        showSuccessModal("Feedback Saved", "Thank you!", () => window.location.reload());
    } catch (e) { alert(e.message); }
}
export function handlePackageChange() { window.calculateTotal(); }
