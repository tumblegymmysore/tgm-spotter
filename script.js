// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

let db = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { createClient } = supabase; 
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("DB Ready");

    // Check Login Session
    const { data: { session } } = await db.auth.getSession();
    if(session) handleSessionSuccess(session.user);
});

// --- HELPER FUNCTIONS ---
function getAge(dob) {
    if(!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

function calculateAgeDisplay() {
    const dob = document.getElementById('dob').value;
    if(dob) {
        document.getElementById('age-value').innerText = getAge(dob);
        document.getElementById('age-display').classList.remove('hidden');
    }
}

function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); else target.classList.add('hidden');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerHTML = `<i class="fas fa-info-circle mr-2"></i> ${msg}`;
    t.className = "show"; setTimeout(() => t.className = "", 3000);
}

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
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');

    // Get Role
    const { data } = await db.from('user_roles').select('role').eq('id', user.id).single();
    const role = data ? data.role : 'parent';
    
    document.getElementById('user-role-badge').innerText = role.toUpperCase();

    if(role === 'admin') { showPage('admin'); loadAdminDashboard(); }
    else if(role === 'trainer') { showPage('trainer'); loadTrainerDashboard(); }
    else { showPage('parent-portal'); loadParentData(user.email); }
}

async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}

// --- PUBLIC INTAKE (Trial Only) ---
async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    // Get Data
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;

    const formData = {
        parent_name: document.getElementById('p_name').value,
        child_name: document.getElementById('k_name').value,
        phone: phone, email: email,
        address: document.getElementById('address').value,
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        intent: intentVal, medical_info: document.getElementById('medical').value,
        how_heard: sourceVal, 
        is_trial: true, // FORCED TRIAL
        status: 'Pending Trial',
        age_group: 'Pending Assessment',
        terms_agreed: document.getElementById('terms_check').checked,
        marketing_consent: document.getElementById('marketing_check').checked
    };

    try {
        // Auto-Register User
        const { data: authData, error: authError } = await db.auth.signUp({ email: email, password: phone });
        
        if(authData.user) {
            await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
        }

        const { error: dbError } = await db.from('leads').insert([formData]);
        if (dbError) throw dbError;

        alert("✅ Trial Request Sent! Login with Email & Phone to check status.");
        window.location.reload();

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.disabled = false; }
}

// --- TRAINER LOGIC ---
let currentTrialId = null;

async function loadTrainerDashboard() {
    if(!currentUser) return;
    const list = document.getElementById('trial-list');
    list.innerHTML = '<div class="text-center p-4">Loading...</div>';
    
    // Show Pending + Completed (24hrs)
    const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const { data } = await db.from('leads').select('*').or(`status.eq.Pending Trial,and(status.eq.Trial Completed,trial_completed_at.gt.${yesterday})`).order('created_at', {ascending: true});

    list.innerHTML = '';
    if(!data || data.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 p-4">No pending trials</div>'; return; }
    
    data.forEach(l => {
        const isDone = l.status === 'Trial Completed';
        const badge = isDone ? `<span class="bg-green-100 text-green-700 px-2 rounded text-xs">Done</span>` : `<span class="bg-yellow-100 text-yellow-700 px-2 rounded text-xs">Pending</span>`;
        list.innerHTML += `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
                <div class="font-bold text-slate-800">${l.child_name} <span class="text-xs font-normal text-slate-500">(${getAge(l.dob)}y)</span></div>
                <div class="text-xs text-slate-500">${l.intent}</div>
                <div class="mt-1">${badge}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, '${l.child_name}', '${l.status}', '${l.trainer_feedback||''}', '${l.recommended_batch||''}', '${l.trainer_name||''}')" 
                class="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold">Open</button>
        </div>`;
    });
}

function openTrialModal(id, name, status, feedback, batch, trainer) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = name;
    
    // Pre-fill
    document.getElementById('trainer-feedback').value = feedback;
    document.getElementById('trainer-batch').value = batch || '3-5 Yrs';
    document.getElementById('trainer-name').value = trainer;
    
    // View Only Check
    const isReadOnly = status === 'Trial Completed';
    document.getElementById('btn-save-trial').classList.toggle('hidden', isReadOnly);
    document.getElementById('btn-edit-trial').classList.toggle('hidden', !isReadOnly);
    
    if(isReadOnly) {
        document.getElementById('trainer-feedback').disabled = true;
        document.getElementById('trainer-batch').disabled = true;
        document.getElementById('trainer-name').disabled = true;
    } else {
        enableTrialEdit(); // Reset to editable
    }

    document.getElementById('trial-modal').classList.remove('hidden');
}

function enableTrialEdit() {
    document.getElementById('trainer-feedback').disabled = false;
    document.getElementById('trainer-batch').disabled = false;
    document.getElementById('trainer-name').disabled = false;
    document.getElementById('btn-save-trial').classList.remove('hidden');
    document.getElementById('btn-edit-trial').classList.add('hidden');
}

async function submitTrialResult() {
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    const name = document.getElementById('trainer-name').value;
    
    if(!feedback || !name) { alert("Feedback and Name required"); return; }

    const { error } = await db.from('leads').update({
        status: 'Trial Completed',
        trial_completed_at: new Date(),
        trainer_feedback: feedback,
        recommended_batch: batch,
        trainer_name: name,
        age_group: batch // Provisional assignment
    }).eq('id', currentTrialId);

    if(error) alert("Error: " + error.message);
    else { showToast("Trial Updated!"); document.getElementById('trial-modal').classList.add('hidden'); loadTrainerDashboard(); }
}

// --- ADMIN LOGIC ---
async function loadAdminDashboard() {
    if(!currentUser) return;
    
    // Stats
    const { count: total } = await db.from('leads').select('*', { count: 'exact', head: true });
    const { count: trials } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Pending Trial');
    const { count: active } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Enrolled');

    document.getElementById('stat-total').innerText = total || 0;
    document.getElementById('stat-trials').innerText = trials || 0;
    document.getElementById('stat-active').innerText = active || 0;

    // Table
    const list = document.getElementById('admin-list');
    list.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>';
    
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    list.innerHTML = '';
    
    data.forEach(l => {
        let statusColor = l.status === 'Enrolled' ? 'green' : (l.status === 'Trial Completed' ? 'blue' : 'yellow');
        
        list.innerHTML += `
        <tr class="border-b hover:bg-slate-50">
            <td class="p-3 font-bold">${l.child_name}</td>
            <td class="p-3 text-sm">${l.parent_name} <br> <span class="text-xs text-gray-500">${l.phone}</span></td>
            <td class="p-3"><span class="bg-${statusColor}-100 text-${statusColor}-800 text-xs px-2 py-1 rounded">${l.status}</span></td>
            <td class="p-3 text-sm">${l.age_group}</td>
            <td class="p-3"><button onclick="openAdminDrilldown(${l.id})" class="text-blue-600 text-xs font-bold border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">Manage</button></td>
        </tr>`;
    });
}

async function openAdminDrilldown(id) {
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    if(!data) return;

    // Fill Modal
    const content = document.getElementById('admin-modal-content-body');
    content.innerHTML = `
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><p class="text-gray-500">Child</p><p class="font-bold">${data.child_name} (${getAge(data.dob)}y)</p></div>
            <div><p class="text-gray-500">Parent</p><p class="font-bold">${data.parent_name}</p></div>
            <div><p class="text-gray-500">Phone</p><p class="font-bold">${data.phone}</p></div>
            <div><p class="text-gray-500">Email</p><p class="font-bold">${data.email || '-'}</p></div>
            <div class="col-span-2"><p class="text-gray-500">Medical</p><p class="font-bold text-red-600">${data.medical_info}</p></div>
            <div class="col-span-2 bg-blue-50 p-2 rounded"><p class="text-gray-500">Trainer Feedback</p><p class="italic">"${data.trainer_feedback || 'No feedback yet'}"</p><p class="text-xs text-right">- ${data.trainer_name || ''}</p></div>
        </div>
        
        <hr class="my-4">
        
        <h4 class="font-bold mb-2">Enrollment Actions</h4>
        <label class="text-xs font-bold uppercase">Assign Batch</label>
        <select id="admin-batch" class="input-field mb-2">
            <option value="3-5 Yrs" ${data.age_group === '3-5 Yrs' ? 'selected' : ''}>3-5 Yrs</option>
            <option value="5-8 Yrs" ${data.age_group === '5-8 Yrs' ? 'selected' : ''}>5-8 Yrs</option>
            <option value="8+ Yrs" ${data.age_group === '8+ Yrs' ? 'selected' : ''}>8+ Yrs</option>
            <option value="Adult" ${data.age_group === 'Adult' ? 'selected' : ''}>Adult</option>
        </select>

        <label class="text-xs font-bold uppercase">Payment Status</label>
        <select id="admin-pay" class="input-field mb-4">
            <option value="Unpaid" ${data.payment_status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
            <option value="Paid" ${data.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
        </select>

        <button onclick="adminEnroll(${data.id})" class="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">Update Enrollment</button>
    `;
    
    document.getElementById('admin-modal').classList.remove('hidden');
}

async function adminEnroll(id) {
    const batch = document.getElementById('admin-batch').value;
    const pay = document.getElementById('admin-pay').value;
    
    const { error } = await db.from('leads').update({
        age_group: batch,
        payment_status: pay,
        status: pay === 'Paid' ? 'Enrolled' : 'Pending Payment'
    }).eq('id', id);

    if(error) alert("Error");
    else { showToast("Student Updated!"); document.getElementById('admin-modal').classList.add('hidden'); loadAdminDashboard(); }
}

// --- PARENT PORTAL (View Only) ---
async function loadParentData(email) {
    // (Logic from V9 - Display status and Trainer feedback)
    // Simplified for brevity - assumes logic similar to previous version
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) { content.innerHTML = '<p>No records.</p>'; return; }
    
    let html = '';
    data.forEach(child => {
        html += `<div class="border-b pb-4 mb-4">
            <h3 class="font-bold text-lg">${child.child_name}</h3>
            <p>Status: <span class="font-bold text-blue-600">${child.status}</span></p>
            ${child.trainer_feedback ? `<p class="text-sm bg-gray-50 p-2 mt-2 rounded italic">"${child.trainer_feedback}"</p>` : ''}
        </div>`;
    });
    content.innerHTML = html;
}

// --- NAV ---
function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}
function scrollToSection(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }
