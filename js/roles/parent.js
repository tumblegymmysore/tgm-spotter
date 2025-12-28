// js/roles/parent.js
// Note: Imports go UP one level (../) to find config and utils
import { supabaseClient, REGISTRATION_FEE, SPECIAL_RATES } from '../config.js';
import { showView, showSuccessModal, calculateAge } from '../utils.js';

let currentRegistrationId = null;

// --- 1. INTAKE FORM ---
export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim().replace(/\D/g, '');
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
    container.innerHTML = '<div class="flex justify-center items-center py-20 text-slate-400"><i class="fas fa-circle-notch fa-spin mr-2"></i> Loading family...</div>';

    const { data, error } = await supabaseClient.from('leads').select('*').eq('email', email).order('created_at', { ascending: false });

    if (error || !data || data.length === 0) { 
        container.innerHTML = `<div class="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm mx-auto mt-10"><h3 class="text-lg font-bold text-slate-800">No Students Yet</h3><button onclick="window.location.reload()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4">Register Now</button></div>`; 
        return; 
    }

    container.className = "space-y-6 max-w-lg mx-auto";
    let html = '';
    
    for (const child of data) {
        const leadString = encodeURIComponent(JSON.stringify(child));
        const age = calculateAge(child.dob);
        
        let cardBg = 'bg-white border-slate-100';
        let statusIcon = '<div class="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-clock"></i></div>';
        let statusBadge = 'Trial Pending';
        let statusMessage = `<div class="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center text-xs text-slate-500">We will contact you shortly to schedule the trial.</div>`;
        let primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>`;

        if (child.status === 'Trial Completed') {
            cardBg = 'bg-gradient-to-br from-blue-50 to-white border-blue-200';
            statusIcon = '<div class="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"><i class="fas fa-star"></i></div>';
            statusBadge = 'Ready to Register';
            
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
            primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Processing Payment...</button>`;
        }
        else if (child.status === 'Enrolled') {
            cardBg = 'bg-gradient-to-br from-green-50 to-white border-green-200';
            statusIcon = '<div class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-check"></i></div>';
            statusBadge = 'Active Student';
            statusMessage = `<div class="flex items-center gap-2 mb-4 text-green-700 text-xs font-bold bg-green-100 px-3 py-1 rounded-full w-fit"><span class="w-2 h-2 bg-green-500 rounded-full"></span> Active Student</div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-green-600 text-green-700 font-bold py-3 rounded-xl hover:bg-green-50">Renew Membership</button>`;
        }

        const { count } = await supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('lead_id', child.id).eq('sender_role', 'trainer').eq('is_read', false);
        const badgeClass = count > 0 ? '' : 'hidden';
        const msgBadge = `<span id="msg-badge-${child.id}" class="${badgeClass} absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>`;
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

// --- 3. CHAT OPENER ---
export function openParentChat(leadString) {
    const lead = JSON.parse(decodeURIComponent(leadString));
    const badge = document.getElementById(`msg-badge-${lead.id}`);
    if(badge) badge.classList.add('hidden');
    window.openChat(encodeURIComponent(JSON.stringify(lead)));
}

// --- 4. REGISTRATION ---
export function openRegistrationModal(leadString, isRenewal) {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('is-renewal').value = isRenewal;
    document.getElementById('edit-name').value = child.child_name;
    document.getElementById('edit-phone').value = child.phone;
    document.getElementById('edit-email').value = child.email;
    
    const feeRow = document.getElementById('reg-fee-row');
    if (isRenewal) { feeRow.classList.add('hidden'); document.getElementById('reg-fee-display').innerText = "0"; } 
    else { feeRow.classList.remove('hidden'); document.getElementById('reg-fee-display').innerText = REGISTRATION_FEE; }

    const age = calculateAge(child.dob);
    let slots = age <= 5 ? "Weekdays 4-5 PM" : (age <= 8 ? "Weekdays 5-6 PM" : "Weekdays 6-7 PM");
    document.getElementById('reg-slots-info').innerHTML = `<strong>Available Slots (${age} Yrs):</strong><br>${slots}`;
    
    document.getElementById('reg-package').value = "";
    document.getElementById('total-price').innerText = "0";
    document.getElementById('reg-modal').classList.remove('hidden');
}

export function handlePackageChange() {
    const pkg = document.getElementById('reg-package').value;
    document.getElementById('training-level-group').classList.toggle('hidden', pkg !== 'Special');
    calculateTotal();
}

export function calculateTotal() {
    const pkgVal = document.getElementById('reg-package').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let base = 0;
    if (pkgVal === 'Special') base = SPECIAL_RATES[document.getElementById('reg-level').value] || 0;
    else if (pkgVal) base = parseInt(pkgVal.split('|')[1].replace(/,/g, ''));
    let total = base;
    if (!isRenewal && base > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
}

export async function submitRegistration() {
    const pkgVal = document.getElementById('reg-package').value;
    const total = document.getElementById('total-price').innerText;
    const fileInput = document.getElementById('payment-proof');
    if (!pkgVal || total === "0") return alert("Select Package");
    if (fileInput.files.length === 0) return alert("Upload Proof");

    const btn = document.getElementById('btn-submit-reg');
    btn.innerText = "Uploading..."; btn.disabled = true;

    try {
        const file = fileInput.files[0];
        const fileName = `${currentRegistrationId}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabaseClient.storage.from('payment-proofs').upload(fileName, file);
        if(uploadError) throw uploadError;
        const { data: { publicUrl } } = supabaseClient.storage.from('payment-proofs').getPublicUrl(fileName);
        let pkgName = pkgVal === 'Special' ? `Special - ${document.getElementById('reg-level').value}` : pkgVal.split('|')[0];

        const { error } = await supabaseClient.from('leads').update({
            status: 'Registration Requested', selected_package: pkgName, package_price: total,
            payment_proof_url: publicUrl, start_date: document.getElementById('reg-date').value, payment_status: 'Verification Pending'
        }).eq('id', currentRegistrationId);

        if(error) throw error;
        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Submitted!", "Payment proof received. Verification pending.");
        window.location.reload(); 
    } catch (err) { alert("Error submitting."); } finally { btn.innerText = "Submit Request"; btn.disabled = false; }
}

// --- 5. EDIT & FEEDBACK ---
export function openEditModal(leadString) {
    const child = JSON.parse(decodeURIComponent(leadString));
    document.getElementById('edit-lead-id').value = child.id;
    document.getElementById('read-child-name').value = child.child_name;
    document.getElementById('read-dob').value = child.dob;
    document.getElementById('update-medical').value = child.medical_info || '';
    document.getElementById('update-alt-phone').value = child.alternate_phone || '';
    document.getElementById('update-address').value = child.address || '';
    document.getElementById('edit-modal').classList.remove('hidden');
}

export async function saveChildInfo() {
    const id = document.getElementById('edit-lead-id').value;
    try {
        await supabaseClient.from('leads').update({
            medical_info: document.getElementById('update-medical').value,
            alternate_phone: document.getElementById('update-alt-phone').value,
            address: document.getElementById('update-address').value
        }).eq('id', id);
        showSuccessModal("Updated!", "Details saved.");
        document.getElementById('edit-modal').classList.add('hidden');
        window.location.reload(); 
    } catch (err) { alert("Error: " + err.message); }
}

export function openFeedbackModal(id) {
    document.getElementById('feedback-lead-id').value = id;
    document.getElementById('feedback-modal').classList.remove('hidden');
}

export async function submitParentFeedback() {
    const id = document.getElementById('feedback-lead-id').value;
    const reason = document.getElementById('feedback-reason').value;
    if (!reason) return alert("Please select a reason.");
    try {
        await supabaseClient.from('leads').update({
            status: 'Follow Up', feedback_reason: reason, 
            follow_up_date: document.getElementById('feedback-date').value || null, 
            parent_note: document.getElementById('feedback-note').value
        }).eq('id', id);
        showSuccessModal("Feedback Saved", "Thank you!");
        document.getElementById('feedback-modal').classList.add('hidden');
        window.location.reload();
    } catch (err) { alert("Error saving."); }
}
