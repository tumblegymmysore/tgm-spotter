// js/main.js

// --------------------------------------------------------------------------
// 1. CONFIGURATION
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready (v25 - Private Chat).");

// --------------------------------------------------------------------------
// 2. SESSION & LOGIN MANAGER (Preserved)
// --------------------------------------------------------------------------
let currentUser = null; 
let currentTrainerName = "Trainer"; // Default

(async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
        currentTrainerName = formattedName;
        
        document.getElementById('landing').classList.add('hidden');
        document.getElementById('nav-public').classList.add('hidden');
        document.getElementById('nav-private').classList.remove('hidden');
        document.getElementById('nav-private').classList.add('flex');
        
        const badge = document.getElementById('user-role-badge');
        if(badge) badge.innerText = formattedName;

        loadTrainerDashboard(formattedName);
    } else {
        document.getElementById('landing').classList.remove('hidden');
    }
})();

window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) return alert("Please enter email and password");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert("Login Failed: " + error.message);
    else {
        document.getElementById('login-modal').classList.add('hidden');
        window.location.reload(); 
    }
};

window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

// --------------------------------------------------------------------------
// 3. TRAINER DASHBOARD LOGIC (Updated Card)
// --------------------------------------------------------------------------
async function loadTrainerDashboard(trainerName) {
    const trainerSection = document.getElementById('trainer');
    if (!trainerSection) return;
    
    trainerSection.classList.remove('hidden');
    
    const welcomeHeader = document.querySelector('#trainer h1 + p');
    if (welcomeHeader) welcomeHeader.innerText = `Welcome back, ${trainerName}!`;

    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', dateOptions);

    fetchTrials();
}

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        btn.classList.add('text-slate-500');
    });
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    activeBtn.classList.remove('text-slate-500');
    activeBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
};

async function fetchTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');
    
    const { data, error } = await supabaseClient
        .from('leads')
        .select('*')
        .order('submitted_at', { ascending: false });

    if (error) return console.error("Error fetching leads:", error);

    listNew.innerHTML = '';
    listDone.innerHTML = '';

    data.forEach(lead => {
        const card = createTrialCard(lead);
        if (lead.status === 'Pending Trial') {
            listNew.innerHTML += card;
        } else if (lead.status === 'Trial Completed') {
            listDone.innerHTML += card;
        }
    });

    if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>';
}

function createTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';

    // PRIVACY UPDATE: Phone number removed. Chat button added.
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
    </div>
    `;
}

// --------------------------------------------------------------------------
// 4. CHAT LOGIC (NEW)
// --------------------------------------------------------------------------
window.openChat = async (leadString) => {
    const lead = JSON.parse(decodeURIComponent(leadString));
    
    // Setup Header
    document.getElementById('chat-header-name').innerText = lead.parent_name;
    document.getElementById('chat-student-name').innerText = lead.child_name;
    document.getElementById('chat-lead-id').value = lead.id;
    
    // Clear & Open
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading messages...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    
    await loadMessages(lead.id);
};

window.loadMessages = async (leadId) => {
    const container = document.getElementById('chat-history');
    
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
        
    if (error || !data) {
        container.innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Start of conversation</p>';
        return;
    }

    if (data.length === 0) {
        container.innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">No messages yet. Say hello!</p>';
        return;
    }

    container.innerHTML = ''; // Clear loading

    data.forEach(msg => {
        const isMe = msg.sender_role === 'trainer'; // Assuming current view is trainer
        
        const bubble = `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                <div class="${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm">
                    ${msg.message_text}
                </div>
                <span class="text-[10px] text-slate-400 mt-1 px-1">
                    ${isMe ? 'You' : msg.sender_name} • ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
            </div>
        `;
        container.innerHTML += bubble;
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    const leadId = document.getElementById('chat-lead-id').value;

    if (!text) return;

    // UI Optimistic Update (Show bubble immediately)
    const container = document.getElementById('chat-history');
    container.innerHTML += `
        <div class="flex flex-col items-end">
            <div class="bg-blue-600 text-white rounded-br-none px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm opacity-50">
                ${text}
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    input.value = '';

    // Save to DB
    const { error } = await supabaseClient
        .from('messages')
        .insert([{
            lead_id: leadId,
            sender_role: 'trainer',
            sender_name: currentTrainerName,
            message_text: text
        }]);

    if (error) {
        alert("Failed to send message.");
        console.error(error);
    } else {
        // Reload to get timestamp and confirm
        await loadMessages(leadId); 
    }
};

// --------------------------------------------------------------------------
// 5. ASSESSMENT LOGIC (Preserved)
// --------------------------------------------------------------------------
let currentAssessmentLead = null;

window.openAssessment = (leadString) => {
    const lead = JSON.parse(decodeURIComponent(leadString));
    currentAssessmentLead = lead; 
    
    document.getElementById('assess-lead-id').value = lead.id;
    document.getElementById('assess-child-name').innerText = lead.child_name;
    document.getElementById('assess-feedback').value = '';
    
    ['listen', 'flex', 'strength', 'balance'].forEach(k => {
        const el = document.getElementById(`skill-${k}`);
        if(el) el.checked = false;
    });
    document.getElementById('assess-pt').checked = false; 

    // Auto-Batch Logic
    const dob = new Date(lead.dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;

    let recommendedBatch = "Toddler (3-5 Yrs)";
    if (age >= 18) recommendedBatch = "Adult Fitness";
    else if (age >= 8) recommendedBatch = "Intermediate (8+ Yrs)";
    else if (age >= 5) recommendedBatch = "Beginner (5-8 Yrs)";
    
    document.getElementById('assess-batch').value = recommendedBatch;
    document.getElementById('assessment-modal').classList.remove('hidden');
};

window.submitAssessment = async () => {
    const btn = document.getElementById('btn-save-assess');
    const originalText = btn.innerText;
    
    const feedback = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const ptRecommended = document.getElementById('assess-pt').checked;
    
    const skills = {
        listening: document.getElementById('skill-listen')?.checked || false,
        flexibility: document.getElementById('skill-flex')?.checked || false,
        strength: document.getElementById('skill-strength')?.checked || false,
        balance: document.getElementById('skill-balance')?.checked || false,
        personal_training: ptRecommended 
    };

    if (!batch) return alert("Please select a Recommended Batch.");

    btn.disabled = true;
    btn.innerText = "Saving & Emailing...";

    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({
                status: 'Trial Completed',
                feedback: feedback,
                recommended_batch: batch,
                skills_rating: skills
            })
            .eq('id', currentAssessmentLead.id);

        if (error) throw error;

        const emailPayload = {
            record: {
                ...currentAssessmentLead, 
                feedback: feedback, 
                recommended_batch: batch,
                skills_rating: skills, 
                pt_recommended: ptRecommended, 
                type: 'feedback_email' 
            }
        };

        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify(emailPayload) 
        });

        alert(`Great job! 🌟\n\nThe assessment for ${currentAssessmentLead.child_name} has been saved.\nParent Notified!`);
        
        document.getElementById('assessment-modal').classList.add('hidden');
        fetchTrials(); 

    } catch (err) {
        console.error(err);
        alert("Error saving assessment.");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// --------------------------------------------------------------------------
// 6. PUBLIC FORM HELPERS & SUBMISSION (Preserved)
// --------------------------------------------------------------------------
window.scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

window.checkOther = (selectEl, inputId) => {
    const inputEl = document.getElementById(inputId);
    inputEl.classList.toggle('hidden', selectEl.value !== 'Other');
};

window.calculateAgeDisplay = () => {
    const dobInput = document.getElementById('dob').value;
    if (!dobInput) return;
    const dob = new Date(dobInput);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;
    const valueEl = document.getElementById('age-value');
    if (valueEl) {
        valueEl.innerText = age;
        document.getElementById('age-display').classList.remove('hidden');
    }
};

function showError(title, message) {
    const modalEl = document.getElementById('error-modal');
    if (modalEl) {
        document.getElementById('error-title').innerText = title;
        document.getElementById('error-msg').innerText = message;
        modalEl.classList.remove('hidden');
    } else {
        alert(`⚠️ ${title}\n\n${message}`);
    }
}

window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); 
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError("Invalid Mobile Number", "Please check the 'Mobile (WhatsApp)' field. It must be exactly 10 digits.");
        return; 
    }
    if (rawAltPhone.length > 0) {
        let isValid = false;
        if (cleanAltPhone.startsWith('0')) {
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) isValid = true;
        } else if (/^[0-9]{10}$/.test(cleanAltPhone)) isValid = true;
        if (!isValid) {
             showError("Invalid Emergency Contact", "If Mobile: 10 Digits.\nIf Landline: Must start with '0'.");
             return; 
        }
    }

    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: cleanPhone,      
        email: document.getElementById('email').value.trim(),
        alternate_phone: cleanAltPhone, 
        address: document.getElementById('address').value.trim(),
        medical_info: document.getElementById('medical').value.trim(),
        source: document.getElementById('source').value === 'Other' ? document.getElementById('source_other').value : document.getElementById('source').value,
        intent: document.getElementById('intent').value === 'Other' ? document.getElementById('intent_other').value : document.getElementById('intent').value,
        marketing_consent: document.getElementById('marketing_check').checked,
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if (error) {
            if (error.code === '23505') showError("Registration Exists!", "Student already registered.");
            else showError("System Error", error.message);
            btn.disabled = false; btn.innerText = originalText;
            return;
        }

        btn.innerText = "Notifying...";
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ record: formData }) 
        });

        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";
    } catch (err) {
        console.error(err);
        showError("Unexpected Error", "Something went wrong.");
        btn.disabled = false; btn.innerText = originalText;
    }
};
