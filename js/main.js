// js/main.js (v32 - Polish & Roles)

// 1. CONFIGURATION
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// Safety Check
if (typeof supabase === 'undefined') {
    alert("CRITICAL ERROR: Supabase library not loaded. Check internet.");
    throw new Error("Supabase missing");
}

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
console.log("System Loaded: Ready (v32 - Polished).");

// --- GLOBAL VARIABLES ---
let currentUser = null; 
let currentUserName = "User"; 

// --- 2. INITIALIZATION & ROUTING ---
async function initSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            
            // Extract Name (Fallback to part of email)
            const metaName = currentUser.user_metadata?.full_name;
            const emailName = currentUser.email ? currentUser.email.split('@')[0] : "User";
            currentUserName = metaName || emailName.charAt(0).toUpperCase() + emailName.slice(1);
            
            // Update UI Badges
            const badge = document.getElementById('user-role-badge');
            if(badge) badge.innerText = currentUserName;

            // HIDE Landing, SHOW Private Nav
            document.getElementById('landing').classList.add('hidden');
            document.getElementById('nav-public').classList.add('hidden');
            document.getElementById('nav-private').classList.remove('hidden');
            document.getElementById('nav-private').classList.add('flex');

            // --- ROLE ROUTING LOGIC ---
            // If email is the known trainer email (or simple logic), load Trainer. Else Parent.
            // For now, let's assume specific emails are trainers, or check a table.
            // SIMPLE CHECK: If they have data in 'leads' matching their email, they are likely a parent.
            
            checkUserRole(currentUser.email);

        } else {
            document.getElementById('landing').classList.remove('hidden');
        }
    } catch (e) {
        console.error("Session Error:", e);
    }
}

async function checkUserRole(email) {
    // 1. Check if they are a trainer (Hardcoded for safety/simplicity first, or DB check)
    // You can replace this with a DB check: select * from user_roles where email = ...
    const trainerEmails = ['tumblegymmysore@gmail.com', 'trainer@tgm.com']; 
    
    if (trainerEmails.includes(email) || email.includes('trainer')) {
        console.log("Role: Trainer");
        loadTrainerDashboard(currentUserName);
    } else {
        console.log("Role: Parent");
        loadParentDashboard(email);
    }
}

// --- 3. TRAINER DASHBOARD ---
async function loadTrainerDashboard(trainerName) {
    document.getElementById('trainer').classList.remove('hidden');
    document.getElementById('parent-portal').classList.add('hidden'); // Ensure parent view is hidden
    
    // 1. Set Welcome Message (Targeting Specific ID)
    const welcomeEl = document.getElementById('trainer-welcome');
    if (welcomeEl) welcomeEl.innerText = `Welcome back, ${trainerName}!`;

    // 2. Set Date
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // 3. Load Data
    fetchTrials(); 
    fetchInbox(); 
}

// --- 4. PARENT DASHBOARD (Restored) ---
async function loadParentDashboard(email) {
    document.getElementById('parent-portal').classList.remove('hidden');
    document.getElementById('trainer').classList.add('hidden'); // Ensure trainer view is hidden

    const container = document.getElementById('parent-content');
    container.innerHTML = '<p class="text-center text-slate-400">Loading your profile...</p>';

    const { data, error } = await supabaseClient
        .from('leads')
        .select('*')
        .eq('email', email); // <--- FILTER BY EMAIL

    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <p class="text-slate-500 mb-4">No registrations found for this email.</p>
                <button onclick="window.location.reload()" class="text-blue-600 font-bold hover:underline">Register a Child</button>
            </div>`;
        return;
    }

    let html = '';
    data.forEach(child => {
        let statusBadge = '';
        let actionArea = '';

        if (child.status === 'Trial Completed') {
            statusBadge = '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">Assessment Ready</span>';
            actionArea = `
                <div class="bg-blue-50 p-4 rounded-xl mt-4 border border-blue-100">
                    <p class="font-bold text-blue-900 mb-1">🎉 Great News!</p>
                    <p class="text-sm text-blue-700 mb-3">Assessment is complete. Recommended: <strong>${child.recommended_batch || 'N/A'}</strong></p>
                    <button class="w-full bg-blue-600 text-white font-bold py-2 rounded-lg shadow hover:bg-blue-700 transition">Proceed to Registration</button>
                </div>`;
        } else if (child.status === 'Enrolled') {
            statusBadge = '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">Active Student</span>';
        } else {
            statusBadge = '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">Pending Trial</span>';
            actionArea = `<p class="text-xs text-slate-400 mt-2 italic text-center">We will contact you shortly to confirm your trial slot.</p>`;
        }

        html += `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-4 transform hover:scale-[1.02] transition duration-300">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3>
                    ${statusBadge}
                </div>
                <p class="text-sm text-slate-500 mb-2"><strong>Program:</strong> ${child.intent}</p>
                ${actionArea}
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- 5. SHARED HELPERS (Success Modal, etc.) ---

function showSuccess(title, message) {
    // Hide other modals first
    document.getElementById('assessment-modal').classList.add('hidden');
    document.getElementById('success-modal').classList.remove('hidden');
    
    // Update Text
    document.getElementById('success-title').innerText = title;
    document.getElementById('success-msg').innerText = message;
}

// --- 6. TRAINER FUNCTIONS (Trials, Inbox, Assessment) ---

// ... [Keep existing fetchTrials, fetchInbox, openChat, etc. from v31] ...
// I will rewrite them compactly here to ensure the full file works.

async function fetchTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');
    if (!listNew) return;

    listNew.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Syncing data...</p>';

    const { data, error } = await supabaseClient.from('leads').select('*').order('submitted_at', { ascending: false });

    if (error) { listNew.innerHTML = `<p class="text-red-500 text-sm">Error: ${error.message}</p>`; return; }

    listNew.innerHTML = ''; listDone.innerHTML = '';
    
    if(!data.length) { listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>'; return; }

    data.forEach(lead => {
        const card = createTrialCard(lead);
        lead.status === 'Pending Trial' ? listNew.innerHTML += card : listDone.innerHTML += card;
    });
    
    if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending requests.</p>';
}

function createTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';

    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition mb-3">
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <button onclick="window.openChat('${leadString}')" class="mt-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full border border-blue-200 transition flex items-center">
                    <i class="fas fa-comment-dots mr-2"></i> Message Parent
                </button>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200">${lead.status}</span>
            </div>
        </div>
        ${isPending ? `
            <button onclick="window.openAssessment('${leadString}')" class="mt-3 w-full bg-slate-800 text-white text-xs font-bold py-2 rounded hover:bg-slate-900 transition shadow-lg">
                Start Assessment
            </button>
        ` : `
            <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                <strong>Result:</strong> ${lead.recommended_batch || 'N/A'}
            </div>
        `}
    </div>`;
}

// --- INBOX LOGIC ---
async function fetchInbox() {
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
            container.innerHTML += `
                <div onclick="window.openChat('${leadString}')" class="cursor-pointer p-4 border-b border-slate-100 flex justify-between items-center ${unreadClass} transition">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold mr-3 shrink-0">${conv.details.child_name.charAt(0)}</div>
                        <div><h4 class="font-bold text-slate-800 text-sm">${conv.details.parent_name}</h4><p class="text-xs text-slate-500 truncate w-48">${conv.lastMessage.message_text}</p></div>
                    </div>
                    ${conv.unread > 0 ? `<span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${conv.unread}</span>` : ''}
                </div>`;
        });
    } catch (e) { console.warn(e); }
}

// --- CHAT WINDOW ---
window.openChat = async (str) => {
    const l = JSON.parse(decodeURIComponent(str));
    document.getElementById('chat-header-name').innerText = l.parent_name;
    document.getElementById('chat-student-name').innerText = l.child_name;
    document.getElementById('chat-lead-id').value = l.id;
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    await loadMessages(l.id); await markAsRead(l.id);
};

window.loadMessages = async (id) => {
    const c = document.getElementById('chat-history');
    const { data } = await supabaseClient.from('messages').select('*').eq('lead_id', id).order('created_at', { ascending: true });
    if (!data) return;
    c.innerHTML = '';
    data.forEach(m => {
        const me = m.sender_role === 'trainer';
        c.innerHTML += `<div class="flex flex-col ${me?'items-end':'items-start'}"><div class="${me?'bg-blue-600 text-white rounded-br-none':'bg-white border border-slate-200'} px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm">${m.message_text}</div></div>`;
    });
    c.scrollTop = c.scrollHeight;
};

window.sendChatMessage = async () => {
    const inp = document.getElementById('chat-input');
    const txt = inp.value.trim(); const lid = document.getElementById('chat-lead-id').value;
    if (!txt) return;
    document.getElementById('chat-history').innerHTML += `<div class="flex flex-col items-end"><div class="bg-blue-600 text-white rounded-br-none px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm opacity-50">${txt}</div></div>`;
    inp.value = '';
    await supabaseClient.from('messages').insert([{ lead_id: lid, sender_role: 'trainer', sender_name: currentUserName, message_text: txt }]);
    await loadMessages(lid); fetchInbox();
};

async function markAsRead(id) {
    await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', id).neq('sender_role', 'trainer');
    document.getElementById('inbox-badge')?.classList.add('hidden');
}

// --- ASSESSMENT SUBMISSION (With New Success Modal) ---
let currentAssessmentLead = null;
window.openAssessment = (str) => {
    const l = JSON.parse(decodeURIComponent(str)); currentAssessmentLead = l;
    document.getElementById('assess-lead-id').value = l.id;
    document.getElementById('assess-child-name').innerText = l.child_name;
    document.getElementById('assess-feedback').value = '';
    ['listen', 'flex', 'strength', 'balance'].forEach(k => { document.getElementById(`skill-${k}`).checked = false; });
    document.getElementById('assess-pt').checked = false; 
    
    // Auto Batch Logic
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
    const skills = { listening: document.getElementById('skill-listen').checked, flexibility: document.getElementById('skill-flex').checked, strength: document.getElementById('skill-strength').checked, balance: document.getElementById('skill-balance').checked, personal_training: pt };

    if(!batch) return alert("Select Batch");
    btn.disabled = true; btn.innerText = "Saving...";

    try {
        const { error } = await supabaseClient.from('leads').update({ status: 'Trial Completed', feedback: fb, recommended_batch: batch, skills_rating: skills }).eq('id', currentAssessmentLead.id);
        if(error) throw error;
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ record: { ...currentAssessmentLead, feedback: fb, recommended_batch: batch, skills_rating: skills, pt_recommended: pt, type: 'feedback_email' } }) });
        
        // USE NEW MODAL INSTEAD OF ALERT
        showSuccess("Assessment Saved!", "Evaluation saved and parent notified via email.");
        fetchTrials();
    } catch(e) { console.error(e); alert("Error saving."); }
    finally { btn.disabled = false; btn.innerText = orgTxt; }
};

// --- PUBLIC FORM ---
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
    
    if(phone.length !== 10) return alert("Invalid Phone");
    
    const formData = {
        child_name: document.getElementById('k_name').value, dob: document.getElementById('dob').value, gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value, phone: phone, email: document.getElementById('email').value,
        status: 'Pending Trial', submitted_at: new Date(), source: document.getElementById('source').value, intent: document.getElementById('intent').value
    };
    
    btn.innerText = "Saving..."; btn.disabled = true;
    try {
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if(error) throw error;
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseKey}`}, body: JSON.stringify({record: formData}) });
        
        // USE NEW MODAL
        showSuccess("Request Sent!", "We have received your trial request.");
    } catch(e) { alert(e.message); } finally { btn.innerText = org; btn.disabled = false; }
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-600','border-b-2'); b.classList.add('text-slate-500'); });
    document.getElementById(`tab-btn-${tab}`).classList.add('text-blue-600','border-b-2');
    if(tab==='inbox') fetchInbox();
}

window.handleLogin = async () => {
    const e = document.getElementById('login-email').value; const p = document.getElementById('login-password').value;
    if(!e || !p) return alert("Enter credentials");
    const { error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p });
    if(error) alert(error.message); else { document.getElementById('login-modal').classList.add('hidden'); window.location.reload(); }
}
window.handleLogout = async () => { await supabaseClient.auth.signOut(); window.location.reload(); }

// INIT
initSession();
