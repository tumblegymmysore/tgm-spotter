// js/roles/parent.js (v53 - Smart Registration Logic)
import { supabaseClient, REGISTRATION_FEE, PT_RATES, BATCH_RATES } from '../config.js';
import { showView, showSuccessModal, calculateAge } from '../utils.js';

let currentRegistrationId = null;
let currentLeadData = null; // Store for pricing logic

// --- 1. INTAKE FORM (Preserved) ---
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

// --- 2. PARENT DASHBOARD ---
export async function loadParentDashboard(email) {
    showView('parent-portal');
    const container = document.getElementById('parent-content');
    
    // Skeleton Loader
    const skeleton = `<div class="relative rounded-3xl p-6 shadow-sm border border-slate-100 bg-white animate-pulse"><div class="flex gap-4 mb-4"><div class="w-14 h-14 bg-slate-200 rounded-2xl"></div><div class="space-y-2"><div class="h-5 w-32 bg-slate-200 rounded"></div><div class="h-3 w-20 bg-slate-200 rounded"></div></div></div><div class="h-10 bg-slate-200 rounded-lg mb-4 w-2/3"></div><div class="h-12 bg-slate-200 rounded-xl"></div></div>`;
    container.innerHTML = skeleton + skeleton;
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
        
        // Status Logic
        let cardBg = 'bg-white border-slate-100';
        let statusIcon = '<div class="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-clock"></i></div>';
        let statusBadge = 'Trial Pending';
        let statusMessage = `<div class="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center text-xs text-slate-500">We will contact you shortly to schedule the trial.</div>`;
        let primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>`;

        if (child.status === 'Follow Up') {
            cardBg = 'bg-orange-50 border-orange-200';
            statusIcon = '<div class="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-pause"></i></div>';
            statusBadge = 'On Hold';
            const fDate = child.follow_up_date ? new Date(child.follow_up_date).toLocaleDateString() : 'Future';
            statusMessage = `<div class="p-3 bg-white/50 rounded-lg border border-orange-100 text-center text-xs text-orange-800">Follow-up set for: <strong>${fDate}</strong></div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600 transition">Resume Registration</button>`;
        }
        else if (child.status === 'Trial Completed') {
            cardBg = 'bg-gradient-to-br from-blue-50 to-white border-blue-200';
            statusIcon = '<div class="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"><i class="fas fa-star"></i></div>';
            statusBadge = 'Ready to Register';
            
            // --- LOGIC: Match Email Template & Modal Logic ---
            const isSpecial = child.special_needs;
            const isPT = child.skills_rating?.personal_training;
            const batch = child.recommended_batch || 'Standard Batch';
            let displayRec = "";

            if (isSpecial) {
                if (isPT) displayRec = "Special Needs + Personal Training";
                else displayRec = `Special Needs + ${batch}`;
            } else {
                if (isPT) displayRec = "Personal Training Recommended";
                else displayRec = `Recommended: ${batch}`;
            }

            statusMessage = `<div class="mb-4"><p class="text-blue-900 font-bold">Assessment Complete</p><p class="text-xs text-blue-600 font-semibold mt-1">${displayRec}</p></div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition">Complete Registration</button>`;
        } 
        else if (child.status === 'Registration Requested') {
            cardBg = 'bg-white border-purple-200';
            statusIcon = '<div class="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-hourglass-half"></i></div>';
            statusBadge = 'Payment Verification';
            statusMessage = `<div class="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center"><p class="text-xs font-bold text-purple-700">Payment Verification Pending</p></div>`;
            primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Processing...</button>`;
        }
        else if (child.status === 'Enrolled') {
            cardBg = 'bg-gradient-to-br from-green-50 to-white border-green-200';
            statusIcon = '<div class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-check"></i></div>';
            statusBadge = 'Active Student';
            statusMessage = `<div class="flex items-center gap-2 mb-4 text-green-700 text-xs font-bold bg-green-100 px-3 py-1 rounded-full w-fit"><span class="w-2 h-2 bg-green-500 rounded-full"></span> Active Student</div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-green-600 text-green-700 font-bold py-3 rounded-xl hover:bg-green-50">Renew Membership</button>`;
        }

        const { count } = await supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('lead_id', child.id).eq('sender_role', 'trainer').eq('is_read', false);
        const badgeHidden = count > 0 ? '' : 'hidden';
        const msgBadge = `<span id="msg-badge-${child.id}" class="${badgeHidden} absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>`;
        const colors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-purple-100 text-purple-600'];
        const avatarColor = colors[child.child_name.length % colors.length];

        html += `
            <div class="relative rounded-3xl p-6 shadow-sm border ${cardBg} transition-all hover:shadow-md">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center font-black text-xl shadow-inner">${child.child_name.charAt(0)}</div>
                        <div><h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3><p class="text-xs font-bold text-slate-400 uppercase mt-0.5">${age} Yrs • ${child.intent}</p></div>
                    </div>
                    ${statusIcon}
                </div>
                <div class="mb-4 text-xs text-slate-500 font-bold uppercase tracking-wide bg-white/60 p-2 rounded-lg inline-block border border-slate-100">${statusBadge}</div>
                <div class="mb-2">${statusMessage}</div>
                <div>${primaryAction}</div>
                
                <div class="flex gap-3 mt-3">
                    <button onclick="window.openParentChat('${leadString}')" class="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition relative">
                        <i class="fas fa-comment-dots mr-2 text-slate-400"></i> Chat with Coach
                        ${msgBadge}
                    </button>
                    <button onclick="window.openEditModal('${leadString}')" class="w-12 py-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition"><i class="fas fa-pen"></i></button>
                </div>
                
                ${child.status === 'Trial Completed' ? 
                `<div class="mt-4 text-center">
                    <button onclick="window.openFeedbackModal('${child.id}')" class="text-blue-500 text-xs font-bold hover:text-blue-700 underline transition">
                        Not joining yet? Let us know
                    </button>
                </div>` : ''}
            </div>`;
    }
    container.innerHTML = html;
}

// --- 3. SMART REGISTRATION LOGIC ---
export function openRegistrationModal(leadString, isRenewal) {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    currentLeadData = child; // Save for logic usage

    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('is-renewal').value = isRenewal;
    
    // Fee Display Logic
    const feeDisplay = document.getElementById('reg-fee-display');
    if (isRenewal) { 
        feeDisplay.parentElement.parentElement.classList.add('hidden'); 
        feeDisplay.innerText = "0"; 
    } else { 
        feeDisplay.parentElement.parentElement.classList.remove('hidden'); 
        feeDisplay.innerText = REGISTRATION_FEE; 
    }

    // --- NEW LOGIC: DETERMINE PROGRAM & FIELDS ---
    const isSpecial = child.special_needs;
    const isPT = child.skills_rating?.personal_training;
    const batch = child.recommended_batch || 'Standard Batch';
    
    // 1. Set Program Title & Visibility
    const programTitleEl = document.getElementById('reg-program-display');
    const groupBatch = document.getElementById('group-batch');
    const groupPT = document.getElementById('group-pt-level');
    const groupDuration = document.getElementById('group-duration');
    const groupSessions = document.getElementById('group-sessions');

    // Reset visibility
    groupBatch.classList.add('hidden');
    groupPT.classList.add('hidden');
    groupDuration.classList.add('hidden');
    groupSessions.classList.add('hidden');

    if (isSpecial) {
        // CASE: Special Needs
        if (isPT) {
            programTitleEl.innerText = "Special Needs + Personal Training";
            groupPT.classList.remove('hidden'); // Show PT Levels
            groupSessions.classList.remove('hidden'); // Pay per session
        } else {
            programTitleEl.innerText = `Special Needs + ${batch}`;
            groupBatch.classList.remove('hidden'); // Show Batch Options
            groupPT.classList.remove('hidden'); // Also allow PT Level selection for pricing adjustment if needed, OR just treat as Special Batch?
            // User requirement: "if PT not selected, show both special needs and batch".
            // Implementation: We show Batch Frequency.
            groupDuration.classList.remove('hidden'); // Pay per month
        }
    } else {
        // CASE: Regular
        if (isPT) {
            programTitleEl.innerText = "Personal Training";
            groupPT.classList.remove('hidden');
            groupSessions.classList.remove('hidden');
        } else {
            programTitleEl.innerText = batch; // e.g. "Toddler (3-5 Yrs)"
            groupBatch.classList.remove('hidden');
            groupDuration.classList.remove('hidden');
        }
    }

    // Reset Inputs
    document.getElementById('reg-batch-opt').value = "";
    document.getElementById('reg-pt-level').value = "";
    document.getElementById('reg-duration').value = "1";
    document.getElementById('reg-sessions').value = "10";
    document.getElementById('total-price').innerText = "0";
    document.getElementById('reg-date').value = "";
    document.getElementById('payment-proof').value = "";
    document.getElementById('reg-consent').checked = false;
    document.querySelectorAll('input[name="session_days"]').forEach(cb => cb.checked = false);

    document.getElementById('reg-modal').classList.remove('hidden');
}

// 4. SMART CALCULATOR
export function calculateTotal() {
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let total = 0;

    // Determine Mode based on visibility
    const isBatchMode = !document.getElementById('group-batch').classList.contains('hidden');
    const isPTMode = !document.getElementById('group-pt-level').classList.contains('hidden');

    // 1. Calculate Base Price
    if (isBatchMode) {
        const batchVal = document.getElementById('reg-batch-opt').value; // "2 Days / Week"
        const duration = parseInt(document.getElementById('reg-duration').value) || 0;
        
        if (batchVal && BATCH_RATES[batchVal]) {
            total = BATCH_RATES[batchVal] * duration;
        }
    } 
    
    // Note: If Special Needs without PT, we use Batch Logic.
    // If PT is active (either Regular PT or Special+PT), we add/use PT rates.
    
    if (isPTMode) {
        const ptLevel = document.getElementById('reg-pt-level').value; // "Beginner"
        const sessions = parseInt(document.getElementById('reg-sessions').value) || 0;
        
        if (ptLevel && PT_RATES[ptLevel]) {
            // If it's pure PT, this is the cost.
            // If it's Special + Batch, this might be additive? 
            // Current Logic: If PT Mode is visible, we prioritize Session-based billing unless Batch is ALSO visible.
            // Let's assume for this version: PT overrides Batch billing if selected.
            total = PT_RATES[ptLevel] * sessions;
        }
    }

    // 2. Add Registration Fee (One-time)
    if (!isRenewal && total > 0) {
        total += REGISTRATION_FEE;
    }

    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
}

// 5. SUBMIT HANDLER (Updated for new fields)
export async function submitRegistration() {
    const total = document.getElementById('total-price').innerText;
    const fileInput = document.getElementById('payment-proof');
    const startDate = document.getElementById('reg-date').value;
    const consent = document.getElementById('reg-consent').checked;
    const days = Array.from(document.querySelectorAll('input[name="session_days"]:checked')).map(cb => cb.value);

    // Identify what was selected
    const isBatchMode = !document.getElementById('group-batch').classList.contains('hidden');
    const isPTMode = !document.getElementById('group-pt-level').classList.contains('hidden');
    
    let pkgName = "";
    if (isPTMode) {
        const level = document.getElementById('reg-pt-level').value;
        const sessions = document.getElementById('reg-sessions').value;
        if (!level) return alert("Please select a Training Level.");
        pkgName = `Personal Training (${level}) - ${sessions} Classes`;
    } else if (isBatchMode) {
        const batch = document.getElementById('reg-batch-opt').value;
        const duration = document.getElementById('reg-duration').value;
        if (!batch) return alert("Please select a Batch Frequency.");
        pkgName = `${batch} - ${duration} Months`;
    }

    if (total === "0" || total === "2,000") return alert("Total cannot be zero (excluding Reg Fee). Please select options.");
    if (days.length === 0) return alert("Please select Session Days.");
    if (!startDate) return alert("Select Start Date.");
    if (fileInput.files.length === 0) return alert("Upload Payment Proof.");
    if (!consent) return alert("Agree to Terms.");

    const btn = document.getElementById('btn-submit-reg');
    btn.innerText = "Uploading..."; btn.disabled = true;

    try {
        const file = fileInput.files[0];
        const fileName = `${currentRegistrationId}_${Date.now()}.${file.name.split('.').pop()}`;
        
        const { error: uploadError } = await supabaseClient.storage.from('payment-proofs').upload(fileName, file);
        if(uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabaseClient.storage.from('payment-proofs').getPublicUrl(fileName);

        const { error } = await supabaseClient.from('leads').update({
            status: 'Registration Requested', 
            selected_package: pkgName, 
            package_price: total,
            payment_proof_url: publicUrl, 
            start_date: startDate, 
            payment_status: 'Verification Pending',
            session_days: days
        }).eq('id', currentRegistrationId);

        if(error) throw error;

        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Submitted!", "Registration request received. Admin will verify shortly.", () => window.location.reload());

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = "Submit Registration"; btn.disabled = false; }
}

// ... (Keep handlePackageChange if referenced, or remove. Keep other exports like openParentChat, openEditModal, etc.) ...
// For completeness, here are the other untouched functions:
export function openParentChat(leadString) {
    const lead = JSON.parse(decodeURIComponent(leadString));
    const badge = document.getElementById(`msg-badge-${lead.id}`);
    if(badge) badge.classList.add('hidden');
    window.openChat(encodeURIComponent(JSON.stringify(lead)));
}
export function openEditModal(leadString) { /* ... Same as previous ... */ }
export async function saveChildInfo() { /* ... Same as previous ... */ }
export function openFeedbackModal(id) { /* ... Same as previous ... */ }
export async function submitParentFeedback() { /* ... Same as previous ... */ }
// Note: handlePackageChange is replaced by logic inside calculateTotal and openRegistrationModal
export function handlePackageChange() { window.calculateTotal(); }
