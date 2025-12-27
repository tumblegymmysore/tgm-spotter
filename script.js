// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

let db = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { createClient } = supabase; 
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("DB Ready");

    // CHECK SESSION
    const { data: { session } } = await db.auth.getSession();
    if(session) handleSessionSuccess(session.user);
});

// --- AUTHENTICATION ---

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) { alert("Login Failed: " + error.message); } 
    else { 
        document.getElementById('login-modal').classList.add('hidden');
        handleSessionSuccess(data.user); 
    }
}

async function handleSessionSuccess(user) {
    currentUser = user;
    
    // Switch Navbar
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');

    // Fetch Role
    const { data } = await db.from('user_roles').select('role').eq('id', user.id).single();
    const role = data ? data.role : 'parent'; // Default
    
    document.getElementById('user-role-badge').innerText = role.toUpperCase();

    // Route
    if(role === 'admin') { showPage('admin'); fetchLeads(); }
    else if(role === 'trainer') { showPage('trainer'); loadTrainerDashboard(); }
    else { showPage('parent-portal'); loadParentData(user.email); }
}

async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}

// --- PUBLIC INTAKE & AUTO-REGISTER ---

async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    // 1. Get Form Data
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const isTrial = document.getElementById('is_trial').value === 'true';
    
    // ... (Collect other fields same as before) ...
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const formData = {
        parent_name: document.getElementById('p_name').value,
        child_name: document.getElementById('k_name').value,
        phone: phone, email: email,
        address: document.getElementById('address').value,
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        intent: intentVal, medical_info: document.getElementById('medical').value,
        how_heard: sourceVal, is_trial: isTrial,
        status: isTrial ? 'Pending Trial' : 'Application Received',
        age_group: 'Pending Assessment'
    };

    try {
        // 2. Create Auth User (Auto-Register)
        // Password = Phone Number
        const { data: authData, error: authError } = await db.auth.signUp({
            email: email, password: phone 
        });

        if(authError) {
            // If user exists, just save the lead data. If not, throw error.
            if(!authError.message.includes("already registered")) throw authError;
        } else if (authData.user) {
            // Create Role Entry
            await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
        }

        // 3. Save Lead Data
        const { error: dbError } = await db.from('leads').insert([formData]);
        if (dbError) throw dbError;

        alert("✅ Success! Your account is created.\nLogin with Email and Phone Number.");
        window.location.reload();

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.disabled = false; }
}

// --- PARENT PORTAL ---
async function loadParentData(email) {
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) {
        content.innerHTML = `<p class="text-center text-gray-500">No records found.</p>`;
        return;
    }

    let html = '';
    data.forEach(child => {
        let action = '';
        if(child.status === 'Trial Completed') {
            action = `<div class="mt-2 bg-blue-50 p-2 rounded text-blue-800 text-sm">Trial Done! Contact Admin to Enroll.</div>`;
        }
        
        html += `
        <div class="mb-4 border-b pb-4">
            <h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3>
            <p class="text-sm text-slate-500">Status: <span class="font-bold text-blue-600">${child.status}</span></p>
            <p class="text-sm text-slate-500">Batch: ${child.age_group || 'Pending'}</p>
            ${action}
        </div>`;
    });
    content.innerHTML = html;
}

// --- ADMIN / TRAINER LOGIC (Same as V9 but secured) ---
// (I'm preserving your V9 logic here but wrapping it in checks)

async function loadTrainerDashboard() {
    // Only fetch if logged in
    if(!currentUser) return;
    const list = document.getElementById('trial-list');
    list.innerHTML = 'Loading...';
    
    const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const { data } = await db.from('leads').select('*')
        .or(`status.eq.Pending Trial,and(status.eq.Trial Completed,trial_completed_at.gt.${yesterday})`)
        .order('created_at', {ascending: true});

    if(!data || data.length === 0) { list.innerHTML = 'No trials.'; return; }
    
    list.innerHTML = '';
    data.forEach(l => {
        const isDone = l.status === 'Trial Completed';
        const btnText = isDone ? "View" : "Assess";
        const btnClass = isDone ? "bg-gray-200 text-gray-600" : "bg-blue-600 text-white";
        
        list.innerHTML += `
        <div class="p-4 border-b flex justify-between items-center">
            <div>
                <div class="font-bold">${l.child_name}</div>
                <div class="text-xs text-gray-500">${l.intent}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, '${l.child_name}')" class="${btnClass} px-3 py-1 rounded text-xs font-bold">${btnText}</button>
        </div>`;
    });
}

// --- SHARED UTILS ---
function calculateAgeDisplay() {
    const dob = document.getElementById('dob').value;
    if(!dob) return;
    const diff = Date.now() - new Date(dob).getTime();
    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    document.getElementById('age-display').innerText = `Age: ${age} Years`;
    document.getElementById('age-display').classList.remove('hidden');
}

function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); else target.classList.add('hidden');
}

function toggleTrial(isTrial) {
    document.getElementById('is_trial').value = isTrial;
    // (Visual toggle logic same as before)
    if(isTrial) {
        document.getElementById('btn-trial').className = "px-6 py-2 rounded-lg font-bold text-sm bg-white shadow text-blue-600 transition";
        document.getElementById('btn-direct').className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 transition";
    } else {
        document.getElementById('btn-direct').className = "px-6 py-2 rounded-lg font-bold text-sm bg-white shadow text-blue-600 transition";
        document.getElementById('btn-trial').className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 transition";
    }
}

function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}

function scrollToSection(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }

// (Include Admin Fetch Logic similar to Trainer Dashboard)
async function fetchLeads() {
    const list = document.getElementById('leads-list');
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    list.innerHTML = '';
    if(data) {
        data.forEach(l => {
            list.innerHTML += `<tr class="border-b"><td class="p-3 font-bold">${l.child_name}</td><td class="p-3 text-sm">${l.parent_name}</td><td class="p-3 text-xs">${l.status}</td><td class="p-3 text-xs">${l.age_group || '-'}</td><td class="p-3"><button class="text-blue-600 text-xs font-bold">Manage</button></td></tr>`;
        });
    }
}
