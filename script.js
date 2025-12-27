// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

let db = null;
let currentUser = null;
let myRoles = []; // Stores all roles for the logged-in user

document.addEventListener('DOMContentLoaded', async () => {
    const { createClient } = supabase; 
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("DB Ready");

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

// --- AUTHENTICATION & ROUTING ---
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) alert("Login Failed: " + error.message); 
    else { document.getElementById('login-modal').classList.add('hidden'); handleSessionSuccess(data.user); }
}

async function handleSessionSuccess(user) {
    currentUser = user;
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');

    // FETCH ALL ROLES
    const { data } = await db.from('user_roles').select('role').eq('id', user.id);
    myRoles = data.map(r => r.role);
    
    // Fallback if no role found
    if(myRoles.length === 0) myRoles = ['parent'];

    // Setup View Switcher if multiple roles
    const switcher = document.getElementById('role-switcher');
    switcher.innerHTML = ''; // Clear previous
    if(myRoles.length > 1) {
        myRoles.forEach(r => {
            switcher.innerHTML += `<option value="${r}">${r.toUpperCase()}</option>`;
        });
        switcher.classList.remove('hidden');
    } else {
        switcher.classList.add('hidden');
    }

    // DETERMINE PRIORITY VIEW
    let priorityRole = 'parent';
    if(myRoles.includes('admin')) priorityRole = 'admin';
    else if(myRoles.includes('trainer')) priorityRole = 'trainer';

    // Set dropdown to current role and load view
    if(myRoles.length > 1) switcher.value = priorityRole;
    loadView(priorityRole);
}

async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}

// Called when user changes the dropdown or initially logs in
function loadView(role) {
    document.getElementById('user-role-badge').innerText = role.toUpperCase();
    
    if(role === 'admin') { showPage('admin'); loadAdminDashboard(); }
    else if(role === 'trainer') { showPage('trainer'); loadTrainerDashboard(); }
    else { showPage('parent-portal'); loadParentData(currentUser.email); }
}

// --- PUBLIC INTAKE ---
async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    // Data Gathering
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
        is_trial: true, 
        status: 'Pending Trial',
        age_group: 'Pending Assessment',
        terms_agreed: document.getElementById('terms_check').checked,
        marketing_consent: document.getElementById('marketing_check').checked
    };

    try {
        // Auto-Register (Ignore error if user exists)
        const { data: authData } = await db.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            // Check if role exists, if not insert
            const { data: roleData } = await db.from('user_roles').select('*').eq('id', authData.user.id).eq('role', 'parent');
            if(!roleData || roleData.length === 0) {
                await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
            }
        }
        const { error: dbError } = await db.from('leads').insert([formData]);
        if (dbError) throw dbError;

        alert("✅ Trial Requested! Login with your Email & Phone Number.");
        window.location.reload();
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.disabled = false; }
}

// --- TRAINER LOGIC ---
let currentTrialId = null;

async function loadTrainerDashboard() {
    if(!currentUser) return;
    const list = document.getElementById('trial-list');
    list.innerHTML = 'Loading...';
    
    // Logic: Pending OR Completed within 24 hours
    const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const { data } = await db.from('leads').select('*')
        .or(`status.eq.Pending Trial,and(status.eq.Trial Completed,trial_completed_at.gt.${yesterday})`)
        .order('created_at', {ascending: true});

    list.innerHTML = '';
    if(!data || data.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 p-4">No active trials</div>'; return; }
    
    data.forEach(l => {
        const isDone = l.status === 'Trial Completed';
        const badge = isDone ? `<span class="bg-green-100 text-green-700 px-2 text-xs rounded">Done</span>` : `<span class="bg-yellow-100 text-yellow-700 px-2 text-xs rounded">Pending</span>`;
        
        list.innerHTML += `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center mb-2">
            <div>
                <div class="font-bold text-slate-800">${l.child_name} <span class="text-xs font-normal text-slate-500">(${getAge(l.dob)}y)</span></div>
                <div class="text-xs text-slate-500">${l.intent}</div>
                <div class="mt-1">${badge}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, '${l.child_name}', '${l.status}', '${l.trainer_feedback||''}', '${l.recommended_batch||''}', '${l.trainer_name||''}')" 
                class="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold">Assess</button>
        </div>`;
    });
}

function openTrialModal(id, name, status, feedback, batch, trainer) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = name;
    document.getElementById('trainer-feedback').value = feedback;
    document.getElementById('trainer-batch').value = batch || '3-5 Yrs';
    document.getElementById('trainer-name').value = trainer;
    
    // View Only Check
    const isReadOnly = status === 'Trial Completed';
    document.getElementById('btn-save-trial').classList.toggle('hidden', isReadOnly);
    document.getElementById('btn-edit-trial').classList.toggle('hidden', !isReadOnly);
    
    // Disable fields if read only
    const fields = ['trainer-feedback', 'trainer-batch', 'trainer-name'];
    fields.forEach(f => document.getElementById(f).disabled = isReadOnly);

    document.getElementById('trial-modal').classList.remove('hidden');
}

function enableTrialEdit() {
    ['trainer-feedback', 'trainer-batch', 'trainer-name'].forEach(f => document.getElementById(f).disabled = false);
    document.getElementById('btn-save-trial').classList.remove('hidden');
    document.getElementById('btn-edit-trial').classList.add('hidden');
}

async function submitTrialResult() {
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    const name = document.getElementById('trainer-name').value;
    if(!feedback || !name) { alert("Feedback & Name required"); return; }

    const { error } = await db.from('leads').update({
        status: 'Trial Completed', trial_completed_at: new Date(),
        trainer_feedback: feedback, recommended_batch: batch,
        trainer_name: name, age_group: batch 
    }).eq('id', currentTrialId);

    if(error) alert("Error"); 
    else { showToast("Assessment Saved"); document.getElementById('trial-modal').classList.add('hidden'); loadTrainerDashboard(); }
}

// --- PARENT PORTAL (Updated Flow) ---
async function loadParentData(email) {
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) { content.innerHTML = '<p class="text-center p-4">No records found.</p>'; return; }
    
    let html = '';
    data.forEach(child => {
        let actionArea = '';
        // FLOW: Trial Completed -> Show "Register" button
        if(child.status === 'Trial Completed') {
            actionArea = `
                <div class="bg-blue-50 p-4 rounded mt-2 border border-blue-100">
                    <p class="font-bold text-blue-900 text-sm mb-2">🎉 Trial Successful!</p>
                    <p class="text-xs text-slate-600 mb-2">Coach ${child.trainer_name} recommends: <strong>${child.recommended_batch}</strong></p>
                    <button onclick="openRegistrationModal(${child.id}, '${child.child_name}')" class="w-full bg-blue-600 text-white font-bold py-2 rounded text-sm hover:bg-blue-700">Register for Classes</button>
                </div>`;
        } 
        else if (child.status === 'Registration Requested') {
             actionArea = `<div class="mt-2 bg-yellow-50 p-2 rounded text-yellow-800 text-xs text-center font-bold">Registration Pending Admin Approval</div>`;
        }
        else if (child.status === 'Enrolled') {
            actionArea = `<div class="mt-2 bg-green-50 p-2 rounded text-green-800 text-xs text-center font-bold">✅ Enrolled (Active)</div>`;
        } else {
             actionArea = `<div class="mt-2 text-xs text-slate-400 italic text-center">Trial Pending...</div>`;
        }

        html += `
        <div class="mb-4 border-b pb-4">
            <h3 class="font-bold text-xl">${child.child_name}</h3>
            <p class="text-sm">Status: <span class="font-bold text-blue-600">${child.status}</span></p>
            ${actionArea}
        </div>`;
    });
    content.innerHTML = html;
}

function openRegistrationModal(id, name) {
    currentTrialId = id; // reuse var
    document.getElementById('reg-child-name').innerText = name;
    document.getElementById('reg-modal').classList.remove('hidden');
}

async function submitRegistration() {
    const days = document.getElementById('reg-days').value;
    const start = document.getElementById('reg-date').value;
    if(!start) { alert("Select start date"); return; }

    const { error } = await db.from('leads').update({
        status: 'Registration Requested',
        batch_days: days,
        start_date: start
    }).eq('id', currentTrialId);

    if(error) alert("Error");
    else { 
        showToast("Registration Sent!"); 
        document.getElementById('reg-modal').classList.add('hidden'); 
        loadParentData(currentUser.email); 
    }
}

// --- ADMIN DASHBOARD (With Override) ---
async function loadAdminDashboard() {
    if(!currentUser) return;
    
    // Stats
    const { count: total } = await db.from('leads').select('*', { count: 'exact', head: true });
    const { count: regReq } = await db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Registration Requested');
    
    document.getElementById('stat-total').innerText = total || 0;
    document.getElementById('stat-reqs').innerText = regReq || 0;

    // List
    const list = document.getElementById('admin-list');
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    
    list.innerHTML = '';
    data.forEach(l => {
        let highlight = l.status === 'Registration Requested' ? 'bg-yellow-50 border-l-4 border-yellow-400' : '';
        let btnTxt = l.status === 'Registration Requested' ? 'Approve' : 'Manage';
        let btnColor = l.status === 'Registration Requested' ? 'text-green-600' : 'text-blue-600';

        list.innerHTML += `
        <tr class="border-b hover:bg-slate-50 ${highlight}">
            <td class="p-3">
                <div class="font-bold">${l.child_name}</div>
                <div class="text-xs text-gray-500">${l.status}</div>
            </td>
            <td class="p-3 text-sm">${l.parent_name}</td>
            <td class="p-3"><button onclick="openAdminModal(${l.id})" class="${btnColor} text-xs font-bold border px-2 py-1 rounded bg-white">${btnTxt}</button></td>
        </tr>`;
    });
}

async function openAdminModal(id) {
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    if(!data) return;

    // Render Full Drilldown
    const content = document.getElementById('admin-modal-body');
    content.innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-sm mb-4 bg-gray-50 p-3 rounded">
            <div><span class="text-xs text-gray-400">Child</span><br><b>${data.child_name}</b></div>
            <div><span class="text-xs text-gray-400">Parent</span><br><b>${data.parent_name}</b></div>
            <div><span class="text-xs text-gray-400">Phone</span><br><b>${data.phone}</b></div>
            <div><span class="text-xs text-gray-400">DOB</span><br><b>${data.dob}</b></div>
        </div>

        <h4 class="font-bold text-xs uppercase mb-2 text-blue-600">Admin Override & Enrollment</h4>
        
        <label class="text-xs font-bold">Current Status</label>
        <select id="adm-status" class="input-field mb-2 h-10 py-1">
            <option value="Pending Trial" ${data.status==='Pending Trial'?'selected':''}>Pending Trial</option>
            <option value="Trial Completed" ${data.status==='Trial Completed'?'selected':''}>Trial Completed</option>
            <option value="Registration Requested" ${data.status==='Registration Requested'?'selected':''}>Registration Requested</option>
            <option value="Enrolled" ${data.status==='Enrolled'?'selected':''}>Enrolled</option>
            <option value="Inactive" ${data.status==='Inactive'?'selected':''}>Inactive</option>
        </select>

        <label class="text-xs font-bold">Assigned Batch</label>
        <select id="adm-batch" class="input-field mb-2 h-10 py-1">
            <option value="3-5 Yrs" ${data.age_group==='3-5 Yrs'?'selected':''}>3-5 Yrs</option>
            <option value="5-8 Yrs" ${data.age_group==='5-8 Yrs'?'selected':''}>5-8 Yrs</option>
            <option value="8+ Yrs" ${data.age_group==='8+ Yrs'?'selected':''}>8+ Yrs</option>
            <option value="Adult" ${data.age_group==='Adult'?'selected':''}>Adult</option>
        </select>

        <label class="text-xs font-bold">Payment Status</label>
        <select id="adm-pay" class="input-field mb-4 h-10 py-1">
            <option value="Unpaid" ${data.payment_status==='Unpaid'?'selected':''}>Unpaid</option>
            <option value="Paid" ${data.payment_status==='Paid'?'selected':''}>Paid</option>
        </select>

        <button onclick="adminSave(${data.id})" class="w-full bg-blue-600 text-white font-bold py-2 rounded">Save Changes</button>
    `;
    document.getElementById('admin-modal').classList.remove('hidden');
}

async function adminSave(id) {
    const status = document.getElementById('adm-status').value;
    const batch = document.getElementById('adm-batch').value;
    const pay = document.getElementById('adm-pay').value;

    const { error } = await db.from('leads').update({
        status: status, age_group: batch, payment_status: pay
    }).eq('id', id);

    if(error) alert("Error");
    else { showToast("Record Updated"); document.getElementById('admin-modal').classList.add('hidden'); loadAdminDashboard(); }
}

// --- SHARED ---
function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}
function scrollToSection(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }
