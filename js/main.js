// js/main.js (v44 - Master Fix: Apple UX + Trainer Access + Payment)

// 1. CONFIGURATION
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// Pricing Constants
const REGISTRATION_FEE = 2000;
const SPECIAL_RATES = { "Beginner": 700, "Intermediate": 850, "Advanced": 1000 };

if (typeof supabase === 'undefined') alert("CRITICAL: Supabase not loaded. Check internet.");
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
console.log("System Loaded: Ready (v44 - Master Fix).");

// --- GLOBAL VARIABLES ---
let currentUser = null; 
let currentDisplayName = "User"; 
let currentRegistrationId = null;

// --- VISIBILITY HELPER (Fixes Blank Screen) ---
function showView(viewId) {
    console.log("Switching View to:", viewId);
    // Force hide everything first
    ['landing', 'trainer', 'parent-portal', 'admin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { 
            el.classList.add('hidden'); 
            el.classList.add('hide'); // Handle both CSS styles
        }
    });
    // Show target
    const target = document.getElementById(viewId);
    if (target) { 
        target.classList.remove('hidden'); 
        target.classList.remove('hide'); 
        target.classList.add('fade-in'); 
    }
}

// --- 2. INITIALIZATION ---
async function initSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            console.log("Session Found:", session.user.email);
            currentUser = session.user;
            const email = currentUser.email;
            let finalName = "";
            let finalRole = "";

            // 1. Check User Role Table
            const { data: roleData } = await supabaseClient.from('user_roles').select('role, full_name').eq('id', currentUser.id).maybeSingle();
            if (roleData) {
                if (roleData.full_name) finalName = roleData.full_name;
                if (roleData.role) finalRole = roleData.role;
            }

            // 2. Check Leads Table (For Parents)
            if (!finalName) {
                const { data: leadData } = await supabaseClient.from('leads').select('parent_name').eq('email', email).limit(1).maybeSingle();
                if (leadData?.parent_name) finalName = leadData.parent_name;
            }

            // 3. Fallback Name
            if (!finalName) {
                let temp = email.split('@')[0];
                finalName = temp.charAt(0).toUpperCase() + temp.slice(1).replace(/[0-9]/g, '');
            }

            currentDisplayName = finalName;

            // Update UI Headers
            document.getElementById('nav-public').classList.add('hidden');
            document.getElementById('nav-private').classList.remove('hidden');
            document.getElementById('nav-private').classList.add('flex');
            const badge = document.getElementById('user-role-badge');
            if(badge) badge.innerText = currentDisplayName;

            // Routing
            const trainerEmails = ['tumblegymmysore@gmail.com', 'trainer@tgm.com'];
            if (finalRole === 'trainer' || finalRole === 'admin' || trainerEmails.includes(email) || email.includes('trainer')) {
                loadTrainerDashboard(currentDisplayName);
            } else {
                loadParentDashboard(email);
            }
        } else {
            console.log("No Session. Showing Landing.");
            showView('landing');
            document.getElementById('nav-public').classList.remove('hidden');
        }
    } catch (e) { console.error("Init Error:", e); }
}

// --- 3. TRAINER DASHBOARD ---
async function loadTrainerDashboard(trainerName) {
    showView('trainer');
    const welcomeEl = document.getElementById('trainer-welcome');
    if (welcomeEl) welcomeEl.innerText = `Welcome back, ${trainerName}!`;
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    
    await fetchTrials(); 
    fetchInbox(); 
}

// --- 4. PARENT DASHBOARD (Apple-Style Cards) ---
async function loadParentDashboard(email) {
    showView('parent-portal');

    const container = document.getElementById('parent-content');
    container.innerHTML = '<div class="flex justify-center items-center py-20 text-slate-400"><i class="fas fa-circle-notch fa-spin mr-2"></i> Loading family...</div>';

    const { data, error } = await supabaseClient.from('leads').select('*').eq('email', email).order('created_at', { ascending: false });

    if (error) { container.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`; return; }
    
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

    // Stack Layout for Mobile
    container.className = "space-y-6 max-w-lg mx-auto";
    
    let html = '';
    
    for (const child of data) {
        const leadString = encodeURIComponent(JSON.stringify(child));
        const dob = new Date(child.dob);
        const age = new Date().getFullYear() - dob.getFullYear();

        // 1. Dynamic Status
        let cardBg = 'bg-white';
        let statusIcon = '';
        let primaryAction = '';
        let statusMessage = '';

        if (child.status === 'Trial Completed') {
            cardBg = 'bg-gradient-to-br from-blue-50 to-white border-blue-200';
            statusIcon = '<div class="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"><i class="fas fa-star"></i></div>';
            statusMessage = `<div class="mb-4"><p class="text-blue-900 font-bold">Assessment Complete</p><p class="text-xs text-blue-600">Recommended: ${child.recommended_batch || 'Standard Batch'}</p></div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', false)" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex justify-center items-center gap-2"><span>Complete Registration</span> <i class="fas fa-arrow-right"></i></button>`;
        } 
        else if (child.status === 'Registration Requested') {
            cardBg = 'bg-white border-purple-200';
            statusIcon = '<div class="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-hourglass-half"></i></div>';
            statusMessage = `<div class="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center"><p class="text-xs font-bold text-purple-700">Payment Verification Pending</p></div>`;
        }
        else if (child.status === 'Enrolled') {
            cardBg = 'bg-gradient-to-br from-green-50 to-white border-green-200';
            statusIcon = '<div class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"><i class="fas fa-check"></i></div>';
            statusMessage = `<div class="flex items-center gap-2 mb-4 text-green-700 text-xs font-bold bg-green-100 px-3 py-1 rounded-full w-fit"><span class="w-2 h-2 bg-green-500 rounded-full"></span> Active Student</div>`;
            primaryAction = `<button onclick="window.openRegistrationModal('${leadString}', true)" class="w-full border-2 border-green-600 text-green-700 font-bold py-3 rounded-xl hover:bg-green-50 transition">Renew Membership</button>`;
        }
        else {
            cardBg = 'bg-white border-slate-100';
            statusIcon = '<div class="bg-yellow-100 text-yellow-600 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-clock"></i></div>';
            statusMessage = `<div class="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center text-xs text-slate-500">We will contact you shortly to schedule the trial.</div>`;
        }

        // 2. Unread Messages Badge
        const { count } = await supabaseClient.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', child.id)
            .eq('sender_role', 'trainer')
            .eq('is_read', false);
        const msgBadge = count > 0 ? `<span class="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm">${count}</span>` : '';

        // 3. Avatar Color
        const colors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-purple-100 text-purple-600'];
        const avatarColor = colors[child.child_name.length % colors.length];

        // 4. Card HTML
        html += `
            <div class="relative rounded-3xl p-6 shadow-sm border ${cardBg} transition-all hover:shadow-md">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center font-black text-xl shadow-inner">
                            ${child.child_name.charAt(0)}
                        </div>
                        <div>
                            <h3 class="font-bold text-xl text-slate-800 tracking-tight">${child.child_name}</h3>
                            <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">${age} Yrs • ${child.intent}</p>
                        </div>
                    </div>
                    ${statusIcon}
                </div>

                <div class="mb-4">${statusMessage}</div>

                <div>
                    ${primaryAction}
                    <div class="flex gap-3 mt-3">
                        <button onclick="window.openParentChat('${leadString}')" class="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition relative">
                            <i class="fas fa-comment-alt mr-2 text-slate-400"></i> Chat with Coach
                            ${msgBadge}
                        </button>
                        <button onclick="window.openEditModal('${leadString}')" class="w-12 py-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition">
                            <i class="fas fa-pen"></i>
                        </button>
                    </div>
                    ${child.status === 'Trial Completed' ? `<button onclick="window.openFeedbackModal('${child.id}')" class="w-full text-center mt-4 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide">Not joining yet?</button>` : ''}
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// --- 5. TRAINER FUNCTIONS (Fixed Access) ---
async function fetchTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');
    if (!listNew) return;

    listNew.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Syncing data...</p>';

    try {
        const { data, error } = await supabaseClient.from('leads').select('*').order('submitted_at', { ascending: false });

        if (error) {
            console.error("Fetch Error:", error);
            listNew.innerHTML = `<div class="p-3 bg-red-50 text-red-600 text-xs rounded">Access Denied: ${error.message}</div>`;
            return;
        }

        listNew.innerHTML = ''; listDone.innerHTML = '';
        if (!data || data.length === 0) { listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>'; return; }

        data.forEach(lead => {
            const card = createTrialCard(lead);
            if (lead.status === 'Pending Trial') listNew.innerHTML += card;
            else if (lead.status === 'Trial Completed') listDone.innerHTML += card;
        });
        
        if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending requests.</p>';

    } catch (err) { console.error("Crash:", err); listNew.innerHTML = `<p class="text-red-500 text-sm">System Crash</p>`; }
}

function createTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';
    return `<div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition mb-3">
        <div class="flex justify-between items-start">
            <div><h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4><p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p><button onclick="window.openChat('${leadString}')" class="mt-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full border border-blue-200 transition flex items-center"><i class="fas fa-comment-dots mr-2"></i> Message Parent</button></div>
            <div class="text-right"><span class="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200">${lead.status}</span></div>
        </div>
        ${isPending ? `<button onclick="window.openAssessment('${leadString}')" class="mt-3 w-full bg-slate-800 text-white text-xs font-bold py-2 rounded hover:bg-slate-900 transition shadow-lg">Start Assessment</button>` : `<div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600"><strong>Result:</strong> ${lead.recommended_batch || 'N/A'}</div>`}
    </div>`;
}

// --- 6. SHARED FUNCTIONS & MODALS ---

// Edit Info
window.openEditModal = (leadString) => {
    const child = JSON.parse(decodeURIComponent(leadString));
    document.getElementById('edit-lead-id').value = child.id;
    document.getElementById('read-child-name').value = child.child_name;
    document.getElementById('read-dob').value = child.dob;
    document.getElementById('update-medical').value = child.medical_info || '';
    document.getElementById('update-alt-phone').value = child.alternate_phone || '';
    document.getElementById('update-address').value = child.address || '';
    document.getElementById('edit-modal').classList.remove('hidden');
};

window.saveChildInfo = async () => {
    const id = document.getElementById('edit-lead-id').value;
    const btn = document.getElementById('btn-save-info');
    btn.innerText = "Saving..."; btn.disabled = true;
    try {
        await supabaseClient.from('leads').update({
            medical_info: document.getElementById('update-medical').value,
            alternate_phone: document.getElementById('update-alt-phone').value,
            address: document.getElementById('update-address').value
        }).eq('id', id);
        showSuccessModal("Updated!", "Details saved.");
        document.getElementById('edit-modal').classList.add('hidden');
        loadParentDashboard(currentUser.email); 
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = "Save Changes"; btn.disabled = false; }
};

// Chat
window.openParentChat = async (leadString) => {
    const lead = JSON.parse(decodeURIComponent(leadString));
    document.getElementById('chat-header-name').innerText = "Trainer / Admin";
    document.getElementById('chat-student-name').innerText = lead.child_name;
    document.getElementById('chat-lead-id').value = lead.id;
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading messages...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    await loadMessages(lead.id); 
    await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', lead.id).eq('sender_role', 'trainer');
};

// Feedback
window.openFeedbackModal = (id) => {
    document.getElementById('feedback-lead-id').value = id;
    document.getElementById('feedback-modal').classList.remove('hidden');
};

window.submitParentFeedback = async () => {
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
        loadParentDashboard(currentUser.email);
    } catch (err) { alert("Error saving."); }
};

// Registration Logic
window.openRegistrationModal = (leadString, isRenewal) => {
    const child = JSON.parse(decodeURIComponent(leadString));
    currentRegistrationId = child.id;
    document.getElementById('reg-child-name').innerText = child.child_name;
    document.getElementById('is-renewal').value = isRenewal;
    
    const feeRow = document.getElementById('reg-fee-row');
    if (isRenewal) { feeRow.classList.add('hidden'); document.getElementById('reg-fee-display').innerText = "0"; } 
    else { feeRow.classList.remove('hidden'); document.getElementById('reg-fee-display').innerText = REGISTRATION_FEE; }

    const age = new Date().getFullYear() - new Date(child.dob).getFullYear();
    let slots = age <= 5 ? "Weekdays 4-5 PM | Weekends 11 AM" : (age <= 8 ? "Weekdays 5-6 PM | Sat 3 PM" : "Weekdays 6-7 PM | Sat 4 PM");
    document.getElementById('reg-slots-info').innerHTML = `<strong>Available Slots (${age} Yrs):</strong><br>${slots}`;

    document.getElementById('reg-package').value = "";
    document.getElementById('total-price').innerText = "0";
    document.getElementById('reg-modal').classList.remove('hidden');
};

window.calculateTotal = () => {
    const pkgVal = document.getElementById('reg-package').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let base = 0;
    if (pkgVal === 'Special') base = SPECIAL_RATES[document.getElementById('reg-level').value] || 0;
    else if (pkgVal) base = parseInt(pkgVal.split('|')[1].replace(/,/g, ''));
    let total = base;
    if (!isRenewal && base > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
};

window.handlePackageChange = () => {
    const pkg = document.getElementById('reg-package').value;
    document.getElementById('training-level-group').classList.toggle('hidden', pkg !== 'Special');
    window.calculateTotal();
};

window.submitRegistration = async () => {
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
        await supabaseClient.storage.from('payment-proofs').upload(fileName, file);
        const { data: { publicUrl } } = supabaseClient.storage.from('payment-proofs').getPublicUrl(fileName);
        let pkgName = pkgVal === 'Special' ? `Special - ${document.getElementById('reg-level').value}` : pkgVal.split('|')[0];

        await supabaseClient.from('leads').update({
            status: 'Registration Requested', selected_package: pkgName, package_price: total,
            payment_proof_url: publicUrl, start_date: document.getElementById('reg-date').value, payment_status: 'Verification Pending'
        }).eq('id', currentRegistrationId);

        document.getElementById('reg-modal').classList.add('hidden');
        showSuccessModal("Submitted!", "Payment proof received.");
        loadParentDashboard(currentUser.email);
    } catch (err) { console.error(err); alert("Error submitting."); } 
    finally { btn.innerText = "Submit Request"; btn.disabled = false; }
};

// Utils & Forms
function showSuccessModal(title, message) {
    const modal = document.getElementById('success-modal');
    modal.querySelector('h3').innerText = title;
    modal.querySelector('p').innerText = message;
    modal.classList.remove('hidden');
}

window.loadMessages = async (leadId) => {
    const container = document.getElementById('chat-history');
    const { data } = await supabaseClient.from('messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true });
    if (!data) return;
    container.innerHTML = '';
    const isTrainer = !document.getElementById('trainer').classList.contains('hidden');
    data.forEach(msg => {
        const isMe = isTrainer ? (msg.sender_role === 'trainer') : (msg.sender_role !== 'trainer');
        container.innerHTML += `<div class="flex flex-col ${isMe?'items-end':'items-start'}"><div class="${isMe?'bg-blue-600 text-white rounded-br-none':'bg-white border border-slate-200 text-slate-700 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm">${msg.message_text}</div></div>`;
    });
    container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const leadId = document.getElementById('chat-lead-id').value;
    const isTrainer = !document.getElementById('trainer').classList.contains('hidden');
    const role = isTrainer ? 'trainer' : 'parent';
    const name = currentDisplayName;
    const container = document.getElementById('chat-history');
    container.innerHTML += `<div class="flex flex-col items-end"><div class="bg-blue-600 text-white rounded-br-none px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm opacity-50">${text}</div></div>`;
    container.scrollTop = container.scrollHeight;
    input.value = '';
    await supabaseClient.from('messages').insert([{ lead_id: leadId, sender_role: role, sender_name: name, message_text: text }]);
    await loadMessages(leadId);
    if(isTrainer) fetchInbox();
};

window.openChat = async (str) => {
    const l = JSON.parse(decodeURIComponent(str));
    document.getElementById('chat-header-name').innerText = l.parent_name;
    document.getElementById('chat-student-name').innerText = l.child_name;
    document.getElementById('chat-lead-id').value = l.id;
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    await loadMessages(l.id); 
    if(document.getElementById('trainer').classList.contains('hidden')) {
        await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', l.id).eq('sender_role', 'trainer');
    } else {
        await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', l.id).neq('sender_role', 'trainer');
        document.getElementById('inbox-badge')?.classList.add('hidden');
    }
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-600','border-b-2'); b.classList.add('text-slate-500'); });
    document.getElementById(`tab-btn-${tab}`).classList.add('text-blue-600', 'border-b-2');
    if (tab === 'inbox') fetchInbox();
};
window.fetchInbox = async () => {
    const container = document.getElementById('list-inbox');
    if (!container) return;
    try {
        const { data: messages, error } = await supabaseClient.from('messages').select(`*, leads (id, child_name, parent_name)`).order('created_at', { ascending: false });
        if (error || !messages.length) { container.innerHTML = '<div class="p-8 text-center text-slate-400">No conversations.</div>'; return; }
        const conversations = {}; let globalUnread = 0;
        messages.forEach(msg => {
            if (!msg.leads) return;
            const lid = msg.leads.id;
            if (!conversations[lid]) conversations[lid] = { details: msg.leads, lastMessage: msg, unread: 0 };
            if (msg.sender_role !== 'trainer' && !msg.is_read) { conversations[lid].unread++; globalUnread++; }
        });
        document.getElementById('inbox-badge')?.classList.toggle('hidden', globalUnread === 0);
        container.innerHTML = '';
        Object.values(conversations).forEach(conv => {
            const leadString = encodeURIComponent(JSON.stringify(conv.details));
            const unreadClass = conv.unread > 0 ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-slate-50';
            const senderPrefix = conv.lastMessage.sender_role === 'trainer' ? 'You: ' : '';
            container.innerHTML += `<div onclick="window.openChat('${leadString}')" class="cursor-pointer p-4 border-b border-slate-100 flex justify-between items-center ${unreadClass} transition"><div class="flex items-center"><div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold mr-3 shrink-0">${conv.details.child_name.charAt(0)}</div><div><h4 class="font-bold text-slate-800 text-sm">${conv.details.parent_name}</h4><p class="text-xs text-slate-500 truncate w-48">${senderPrefix}${conv.lastMessage.message_text}</p></div></div>${conv.unread > 0 ? `<span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${conv.unread}</span>` : ''}</div>`;
        });
    } catch (e) { console.warn(e); }
};

window.scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
window.checkOther = (el, id) => document.getElementById(id).classList.toggle('hidden', el.value !== 'Other');
window.calculateAgeDisplay = () => {
    const d = document.getElementById('dob').value; if(!d) return;
    document.getElementById('age-value').innerText = new Date().getFullYear() - new Date(d).getFullYear();
    document.getElementById('age-display').classList.remove('hidden');
};
window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); const btn = document.getElementById('btn-submit'); const org = btn.innerText;
    const phone = document.getElementById('phone').value.replace(/\D/g, '');
    if(phone.length !== 10) return alert("Invalid Mobile");
    const formData = {
        child_name: document.getElementById('k_name').value.trim(), dob: document.getElementById('dob').value, gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(), phone: phone, email: document.getElementById('email').value.trim(),
        alternate_phone: document.getElementById('alt_phone').value.trim().replace(/\D/g, ''), address: document.getElementById('address').value.trim(), medical_info: document.getElementById('medical').value.trim(),
        source: document.getElementById('source').value, intent: document.getElementById('intent').value,
        marketing_consent: document.getElementById('marketing_check').checked, status: 'Pending Trial', submitted_at: new Date()
    };
    btn.disabled = true; btn.innerText = "Saving...";
    try {
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if (error) { if(error.code==='23505') alert("Exists"); else alert(error.message); btn.disabled=false; btn.innerText=org; return; }
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseKey}`}, body: JSON.stringify({record: formData}) });
        showSuccessModal("Request Sent!", "Your trial request has been submitted successfully.");
    } catch (err) { alert(err.message); btn.disabled = false; btn.innerText = org; }
};
window.handleLogin = async () => {
    const e = document.getElementById('login-email').value; const p = document.getElementById('login-password').value;
    if (!e || !p) return alert("Enter credentials");
    const { error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p });
    if (error) alert("Login Failed: " + error.message);
    else { document.getElementById('login-modal').classList.add('hidden'); window.location.reload(); }
};
window.handleLogout = async () => { await supabaseClient.auth.signOut(); window.location.reload(); };

// Assessment Logic
let currentAssessmentLead = null;
window.openAssessment = (str) => {
    const l = JSON.parse(decodeURIComponent(str)); currentAssessmentLead = l;
    document.getElementById('assess-lead-id').value = l.id;
    document.getElementById('assess-child-name').innerText = l.child_name;
    document.getElementById('assess-feedback').value = '';
    ['listen', 'flex', 'strength', 'balance'].forEach(k => { document.getElementById(`skill-${k}`).checked = false; });
    document.getElementById('assess-pt').checked = false; 
    document.getElementById('assess-special').checked = false; 
    const age = new Date().getFullYear() - new Date(l.dob).getFullYear();
    let batch = "Toddler (3-5 Yrs)";
    if(age >= 18) batch = "Adult Fitness"; else if(age >= 8) batch = "Intermediate (8+ Yrs)"; else if(age >= 5) batch = "Beginner (5-8 Yrs)";
    document.getElementById('assess-batch').value = batch;
    document.getElementById('assessment-modal').classList.remove('hidden');
};
window.submitAssessment = async () => {
    const btn = document.getElementById('btn-save-assess'); const orgTxt = btn.innerText;
    const fb = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const pt = document.getElementById('assess-pt').checked;
    const special = document.getElementById('assess-special').checked; 
    const skills = { listening: document.getElementById('skill-listen').checked, flexibility: document.getElementById('skill-flex').checked, strength: document.getElementById('skill-strength').checked, balance: document.getElementById('skill-balance').checked, personal_training: pt, special_needs: special };
    if(!batch) return alert("Select Batch");
    btn.disabled = true; btn.innerText = "Saving...";
    try {
        const { error } = await supabaseClient.from('leads').update({ status: 'Trial Completed', feedback: fb, recommended_batch: batch, skills_rating: skills, special_needs: special }).eq('id', currentAssessmentLead.id);
        if(error) throw error;
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ record: { ...currentAssessmentLead, feedback: fb, recommended_batch: batch, skills_rating: skills, pt_recommended: pt, special_needs: special, type: 'feedback_email' } }) });
        document.getElementById('assessment-modal').classList.add('hidden');
        showSuccessModal("Assessment Saved!", "Evaluation saved and parent notified via email.");
        fetchTrials(); 
    } catch(e) { console.error(e); alert("Error saving."); } finally { btn.disabled = false; btn.innerText = orgTxt; }
};

initSession();
