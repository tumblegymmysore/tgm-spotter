// js/parent.js
import { supabaseClient, REGISTRATION_FEE, SPECIAL_RATES } from './config.js';
import { showView, showSuccessModal, calculateAge } from './utils.js';

let currentRegistrationId = null;

// 1. Dashboard Loader (Apple-Style Cards)
export async function loadParentDashboard(email) {
    showView('parent-portal');
    const container = document.getElementById('parent-content');
    container.innerHTML = '<div class="flex justify-center items-center py-20 text-slate-400"><i class="fas fa-circle-notch fa-spin mr-2"></i> Loading family...</div>';

    const { data, error } = await supabaseClient
        .from('leads')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`;
        return;
    }
    
    if (!data || data.length === 0) { 
        container.innerHTML = `
            <div class="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm mx-auto mt-10">
                <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 text-2xl"><i class="fas fa-plus"></i></div>
                <h3 class="text-lg font-bold text-slate-800">No Students Yet</h3>
                <p class="text-slate-500 text-sm mb-6">Register your first child to get started.</p>
                <button onclick="window.location.reload()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200">Register Now</button>
            </div>`; 
        return; 
    }

    // Stack Layout for Mobile focus
    container.className = "space-y-6 max-w-lg mx-auto";
    let html = '';
    
    for (const child of data) {
        const leadString = encodeURIComponent(JSON.stringify(child));
        const age = calculateAge(child.dob);
        
        // Status Logic
        let cardBg = 'bg-white border-slate-100';
        let statusIcon = '<div class="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-clock"></i></div>';
        let statusBadge = 'Trial Pending';
        let primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Waiting for Trial</button>`;

        if (child.status === 'Trial Completed') {
            cardBg = 'bg-gradient-to-br from-blue-50 to-white border-blue-200';
            statusIcon = '<div class="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"><i class="fas fa-star"></i></div>';
            statusBadge = 'Ready to Register';
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition">Complete Registration</button>`;
        } 
        else if (child.status === 'Registration Requested') {
            cardBg = 'bg-white border-purple-200';
            statusIcon = '<div class="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-hourglass-half"></i></div>';
            statusBadge = 'Payment Verification';
            primaryAction = `<button disabled class="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">Processing Payment...</button>`;
        }
        else if (child.status === 'Enrolled') {
            cardBg = 'bg-gradient-to-br from-green-50 to-white border-green-200';
            statusIcon = '<div class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-check"></i></div>';
            statusBadge = 'Active Student';
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-green-600 text-green-700 font-bold py-3 rounded-xl hover:bg-green-50">Renew Membership</button>`;
        }

        // Messages Badge
        const { count } = await supabaseClient.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', child.id)
            .eq('sender_role', 'trainer')
            .eq('is_read', false);
        const msgBadge = count > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">${count}</span>` : '';

        // Avatar Color based on name length (Consistent random color)
        const colors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-purple-100 text-purple-600'];
        const avatarColor = colors[child.child_name.length % colors.length];

        html += `
            <div class="relative rounded-3xl p-6 shadow-sm border ${cardBg} transition-all hover:shadow-md">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center font-black text-xl shadow-inner">${child.child_name.charAt(0)}</div>
                        <div>
                            <h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3>
                            <p class="text-xs font-bold text-slate-400 uppercase mt-0.5">${age} Yrs • ${child.intent}</p>
                        </div>
                    </div>
                    ${statusIcon}
                </div>
                
                <div class="mb-4 text-xs text-slate-500 font-bold uppercase tracking-wide bg-white/60 p-2 rounded-lg inline-block border border-slate-100">${statusBadge}</div>
                
                <div>${primaryAction}</div>
                
                <div class="flex gap-3 mt-3">
                    <button onclick="window.openParentChat('${leadString}')" class="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition relative">
                        <i class="fas fa-comment-dots mr-2 text-slate-400"></i> Chat with Coach
                        ${msgBadge}
                    </button>
                    <button onclick="window.openEditModal('${leadString}')" class="w-12 py-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition">
                        <i class="fas fa-pen"></i>
                    </button>
                </div>
                
                ${child.status === 'Trial Completed' ? 
                `<button onclick="window.openFeedbackModal('${child.id}')" class="w-full text-center mt-4 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide">Not joining yet?</button>` : ''}
            </div>`;
    }
    container.innerHTML = html;
}

// 2. Registration Logic
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
