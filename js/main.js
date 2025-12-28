// js/main.js

// --------------------------------------------------------------------------
// 1. CONFIGURATION
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready (v16 - Trainer Dashboard).");

// --------------------------------------------------------------------------
// 2. SESSION & LOGIN MANAGER (The Fix for Redirects)
// --------------------------------------------------------------------------

// Runs immediately on page load
(async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        console.log("User logged in:", session.user.email);
        // User is logged in: Hide Landing, Show Dashboard
        document.getElementById('landing').classList.add('hidden');
        document.getElementById('nav-public').classList.add('hidden');
        document.getElementById('nav-private').classList.remove('hidden');
        document.getElementById('nav-private').classList.add('flex');
        
        // Load the Trainer View
        loadTrainerDashboard();
    } else {
        // User is guest: Show Landing
        document.getElementById('landing').classList.remove('hidden');
    }
})();

window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Please enter email and password");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email, password
    });

    if (error) {
        alert("Login Failed: " + error.message);
    } else {
        document.getElementById('login-modal').classList.add('hidden');
        alert("Welcome Back!");
        window.location.reload(); // Reloads page, triggers initSession() above
    }
};

window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

// --------------------------------------------------------------------------
// 3. TRAINER DASHBOARD LOGIC
// --------------------------------------------------------------------------

async function loadTrainerDashboard() {
    document.getElementById('trainer').classList.remove('hidden');
    
    // Set Date
    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', dateOptions);

    // Fetch Data
    fetchTrials();
}

window.switchTab = (tabName) => {
    // 1. Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 2. Reset all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        btn.classList.add('text-slate-500');
    });

    // 3. Show selected
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    
    // 4. Highlight button
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    activeBtn.classList.remove('text-slate-500');
    activeBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
};

async function fetchTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');

    // Fetch Leads from Supabase
    const { data, error } = await supabaseClient
        .from('leads')
        .select('*')
        .order('submitted_at', { ascending: false });

    if (error) {
        listNew.innerHTML = `<p class="text-red-500">Error loading data.</p>`;
        return;
    }

    listNew.innerHTML = '';
    listDone.innerHTML = '';

    data.forEach(lead => {
        const card = createTrialCard(lead);
        
        // Compartmentalize logic
        if (lead.status === 'Pending Trial') {
            listNew.innerHTML += card;
        } else {
            // Only show completed items from last 24 hours (Optional logic)
            // For now, we just show all non-pending for simplicity
            listDone.innerHTML += card;
        }
    });

    if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>';
}

function createTrialCard(lead) {
    // Simple card template
    const colorClass = lead.status === 'Pending Trial' ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';
    
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition">
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
        ${lead.status === 'Pending Trial' ? `
            <button onclick="alert('Assess feature coming next!')" class="mt-3 w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700">
                Start Assessment
            </button>
        ` : ''}
    </div>
    `;
}

// --------------------------------------------------------------------------
// 4. INTAKE FORM HELPERS (Scroll, Toggle, Age)
// --------------------------------------------------------------------------
window.scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
};

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
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
        age--;
    }
    document.getElementById('age-value').innerText = age;
    document.getElementById('age-display').classList.remove('hidden');
};

function showError(title, message) {
    const el = document.getElementById('error-modal');
    if (el) {
        document.getElementById('error-title').innerText = title;
        document.getElementById('error-msg').innerText = message;
        el.classList.remove('hidden');
    } else {
        alert(title + "\n" + message);
    }
}

// --------------------------------------------------------------------------
// 5. INTAKE FORM SUBMISSION (Original Logic)
// --------------------------------------------------------------------------
window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); 
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    // DATA GATHERING
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // VALIDATION
    if (!/^[0-9]{10}$/.test(cleanPhone)) return showError("Invalid Mobile", "Main phone must be 10 digits.");
    
    if (rawAltPhone.length > 0) {
        let validAlt = false;
        if (cleanAltPhone.startsWith('0') && cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) validAlt = true;
        else if (/^[0-9]{10}$/.test(cleanAltPhone)) validAlt = true;
        
        if (!validAlt) return showError("Invalid Emergency Contact", "Mobile (10 digits) or Landline (start with 0).");
    }

    // PREPARE OBJECT
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
        // SAVE
        const { error } = await supabaseClient.from('leads').insert([formData]);
        if (error) throw error;

        // NOTIFY
        btn.innerText = "Notifying...";
        fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ record: formData }) 
        }).catch(err => console.warn("Email failed", err));

        // SUCCESS
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";
    } catch (err) {
        console.error(err);
        if (err.code === '23505') showError("Duplicate", "Already registered.");
        else showError("Error", "Something went wrong.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
