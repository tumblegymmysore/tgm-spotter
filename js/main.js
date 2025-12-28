// js/main.js

// --------------------------------------------------------------------------
// 1. CONFIGURATION
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready (v17 - Assessments).");

// --------------------------------------------------------------------------
// 2. SESSION & LOGIN MANAGER
// --------------------------------------------------------------------------
let currentUser = null; // Store user info here

(async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        
        // --- PERSONALIZATION FIX ---
        // Try to get name from metadata, fallback to email alias
        const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1); // Capitalize
        
        // Hide Landing, Show Dashboard
        document.getElementById('landing').classList.add('hidden');
        document.getElementById('nav-public').classList.add('hidden');
        document.getElementById('nav-private').classList.remove('hidden');
        document.getElementById('nav-private').classList.add('flex');
        document.getElementById('user-role-badge').innerText = formattedName; // Update Navbar Badge
        
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
// 3. TRAINER DASHBOARD LOGIC
// --------------------------------------------------------------------------
async function loadTrainerDashboard(trainerName) {
    document.getElementById('trainer').classList.remove('hidden');
    
    // Update Welcome Message
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
    
    // Fetch Data
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
    // We stringify the lead object so we can pass it to the onclick function safely
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';

    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition mb-3">
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-blue-600 mt-1"><i class="fab fa-whatsapp"></i> ${lead.phone}</p>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200">${lead.status}</span>
            </div>
        </div>
        ${isPending ? `
            <button onclick="window.openAssessment('${leadString}')" class="mt-3 w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition">
                Start Assessment
            </button>
        ` : `
            <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                <strong>Result:</strong> ${lead.recommended_batch || 'N/A'} <br/>
                <span class="italic">"${lead.feedback || ''}"</span>
            </div>
        `}
    </div>
    `;
}

// --------------------------------------------------------------------------
// 4. ASSESSMENT LOGIC (The New Part)
// --------------------------------------------------------------------------
let currentAssessmentLead = null;

window.openAssessment = (leadString) => {
    const lead = JSON.parse(decodeURIComponent(leadString));
    currentAssessmentLead = lead; // Save for submission
    
    // Populate Modal
    document.getElementById('assess-lead-id').value = lead.id;
    document.getElementById('assess-child-name').innerText = lead.child_name;
    
    // Reset Fields
    document.getElementById('assess-feedback').value = '';
    document.getElementById('assess-batch').value = '';
    ['listen', 'flex', 'strength', 'balance'].forEach(k => {
        document.getElementById(`skill-${k}`).checked = false;
    });

    document.getElementById('assessment-modal').classList.remove('hidden');
};

window.submitAssessment = async () => {
    const btn = document.getElementById('btn-save-assess');
    const originalText = btn.innerText;
    
    // 1. Gather Data
    const feedback = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const skills = {
        listening: document.getElementById('skill-listen').checked,
        flexibility: document.getElementById('skill-flex').checked,
        strength: document.getElementById('skill-strength').checked,
        balance: document.getElementById('skill-balance').checked,
    };

    if (!batch) return alert("Please select a Recommended Batch.");

    btn.disabled = true;
    btn.innerText = "Saving & Emailing...";

    try {
        // 2. Update Database (Status -> Trial Completed)
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

        // 3. Trigger "Post-Trial" Email
        // We add a 'type' flag so the backend knows this is a FEEDBACK email, not a WELCOME email
        const emailPayload = {
            record: {
                ...currentAssessmentLead, // The lead details
                feedback, // Add new data
                recommended_batch: batch,
                type: 'feedback_email' // <--- Crucial Flag
            }
        };

        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify(emailPayload) 
        });

        // 4. Success
        alert("Assessment Saved! Parent has been emailed.");
        document.getElementById('assessment-modal').classList.add('hidden');
        fetchTrials(); // Refresh dashboard

    } catch (err) {
        console.error(err);
        alert("Error saving assessment.");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// --------------------------------------------------------------------------
// 5. INTAKE FORM SUBMISSION & HELPERS (Existing Code)
// --------------------------------------------------------------------------
window.scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
window.checkOther = (select, id) => document.getElementById(id).classList.toggle('hidden', select.value !== 'Other');
window.calculateAgeDisplay = () => {
    const dob = document.getElementById('dob').value;
    if(!dob) return;
    const d = new Date(dob), t = new Date();
    let age = t.getFullYear() - d.getFullYear();
    if(t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) age--;
    document.getElementById('age-value').innerText = age;
    document.getElementById('age-display').classList.remove('hidden');
};
window.handleIntakeSubmit = async (e) => {
    /* ... (Your existing robust intake logic is preserved here implicitly) ... */
    /* I am omitting the duplicate intake logic here to save space, but 
       WHEN YOU PASTE, ENSURE THE INTAKE LOGIC FROM STEP 15 IS HERE.
       If you want the full file with Intake Logic included, ask me to output "FULL FILE". */
     
     // TEMPORARY: Re-pasting the exact intake logic for safety:
    e.preventDefault(); 
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    const rawPhone = document.getElementById('phone').value.trim().replace(/\D/g, '');
    const rawAlt = document.getElementById('alt_phone').value.trim().replace(/\D/g, '');
    
    if (!/^[0-9]{10}$/.test(rawPhone)) return alert("Invalid Mobile: Must be 10 digits.");
    
    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: rawPhone,      
        email: document.getElementById('email').value.trim(),
        alternate_phone: rawAlt, 
        address: document.getElementById('address').value.trim(),
        medical_info: document.getElementById('medical').value.trim(),
        source: document.getElementById('source').value,
        intent: document.getElementById('intent').value,
        marketing_consent: document.getElementById('marketing_check').checked,
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    btn.disabled = true; btn.innerText = "Saving...";
    const { error } = await supabaseClient.from('leads').insert([formData]);

    if (error) {
        if(error.code === '23505') alert("Already Registered!");
        else alert("Error: " + error.message);
        btn.disabled = false; btn.innerText = originalText;
    } else {
        fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST', 
            headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${supabaseKey}`},
            body: JSON.stringify({record: formData})
        });
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";
    }
};
