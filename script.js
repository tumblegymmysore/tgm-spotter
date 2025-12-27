// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// PRICING DATA
const REGISTRATION_FEE = 2000;
const SPECIAL_RATES = { "Beginner": 700, "Intermediate": 850, "Advanced": 1000 };

// GLOBAL VARIABLES
let db = null;
let currentUser = null;
let currentUserName = "Staff"; 
let currentTrialId = null;
let currentRegistrationId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const { createClient } = supabase; 
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("DB Ready");
    
    // Check Session
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
    t.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${msg}`;
    t.className = "show"; setTimeout(() => t.className = "", 3000);
}

// --- GLOBAL FUNCTIONS (Attached to Window for HTML Access) ---

window.handleLogin = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) alert("Login Failed: " + error.message); 
    else { document.getElementById('login-modal').classList.add('hidden'); handleSessionSuccess(data.user); }
}

window.handleMagicLink = async function() {
    const email = document.getElementById('login-email').value;
    if(!email) { alert("Enter email first"); return; }
    const { error } = await db.auth.signInWithOtp({ email: email });
    if (error) alert("Error: " + error.message);
    else alert("✅ Link Sent! Check your email.");
}

window.handleLogout = async function() { 
    await db.auth.signOut(); 
    window.location.reload(); 
}

window.handleIntakeSubmit = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const formData = {
        parent_name: document.getElementById('p_name').value, child_name: document.getElementById('k_name').value,
        phone: phone, email: email, address: document.getElementById('address').value,
        dob: document.getElementById('dob').value, gender: document.getElementById('gender').value,
        intent: intentVal, medical_info: document.getElementById('medical').value, how_heard: sourceVal, 
        is_trial: true, status: 'Pending Trial', age_group: 'Pending Assessment'
    };

    try {
        const { data: authData } = await db.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            const { data: roleData } = await db.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
        }
        const { error } = await db.from('leads').insert([formData]);
        if (error) throw error;
        alert("✅ Request Sent! Check email for details.");
        window.location.reload();
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.disabled = false; }
}

// --- TRAINER FUNCTIONS ---

window.loadTrainerDashboard = async function() {
    if(!currentUser) return;
    const list = document.getElementById('trial-list');
    list.innerHTML = '<div class="text-center p-4">Loading...</div>';
    
    const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const { data } = await db.from('leads').select('*')
        .or(`status.eq.Pending Trial,and(status.eq.Trial Completed,trial_completed_at.gt.${yesterday})`)
        .order('created_at', {ascending: true});

    list.innerHTML = '';
    if(!data || data.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 p-4">No active trials</div>'; return; }
    
    data.forEach(l => {
        const isDone = l.status === 'Trial Completed';
        const badge = isDone ? `<span class="bg-green-100 text-green-700 px-2 text-xs rounded font-bold">Done</span>` : `<span class="bg-yellow-100 text-yellow-700 px-2 text-xs rounded font-bold">Pending</span>`;
        
        list.innerHTML += `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center mb-3">
            <div>
                <div class="font-bold text-slate-800 text-lg">${l.child_name}</div> 
                <div class="text-xs text-slate-500 font-bold uppercase">${getAge(l.dob)} Years • ${l.intent}</div>
                <div class="mt-1">${badge}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, '${l.child_name}', ${getAge(l.dob)}, '${l.status}', '${l.trainer_feedback||''}', '${l.recommended_batch||''}')" 
                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition">Assess</button>
        </div>`;
    });
}

window.openTrialModal = function(id, name, age, status, feedback, batch) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = `${name} (${age} Yrs)`;
    document.getElementById('trainer-feedback').value = feedback;
    
    let rec = batch;
    if(!rec) {
        if(age < 5) rec = '3-5 Yrs'; else if(age < 8) rec = '5-8 Yrs'; else if(age < 18) rec = '8+ Yrs'; else rec = 'Adult';
    }
    document.getElementById('trainer-batch').value = rec;
    
    const isReadOnly = status === 'Trial Completed';
    document.getElementById('btn-save-trial').classList.toggle('hidden', isReadOnly);
    document.getElementById('btn-edit-trial').classList.toggle('hidden', !isReadOnly);
    document.getElementById('trainer-feedback').disabled = isReadOnly;
    document.getElementById('trainer-batch').disabled = isReadOnly;

    document.getElementById('trial-modal').classList.remove('hidden');
}

window.enableTrialEdit = function() {
    document.getElementById('trainer-feedback').disabled = false;
    document.getElementById('trainer-batch').disabled = false;
    document.getElementById('btn-save-trial').classList.remove('hidden');
    document.getElementById('btn-edit-trial').classList.add('hidden');
}

window.submitTrialResult = async function() {
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    if(!feedback) { alert("Feedback required"); return; }

    const { error } = await db.from('leads').update({
        status: 'Trial Completed', trial_completed_at: new Date(),
        trainer_feedback: feedback, recommended_batch: batch,
        trainer_name: currentUserName, age_group: batch 
    }).eq('id', currentTrialId);

    if(error) alert("Error: " + error.message); 
    else { showToast("Saved Successfully"); document.getElementById('trial-modal').classList.add('hidden'); loadTrainerDashboard(); }
}

// --- COMMERCE / REGISTRATION FUNCTIONS ---

window.openRegistrationModal = async function(id, isRenewal = false) {
    currentRegistrationId = id;
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    
    // Safely set text
    document.getElementById('reg-child-name').innerText = data.child_name;
    document.getElementById('is-renewal').value = isRenewal;

    // Prefill Review
    document.getElementById('edit-name').value = data.child_name;
    document.getElementById('edit-phone').value = data.phone;
    document.getElementById('edit-email').value = data.email;
    
    // Fee Logic
    const feeRow = document.getElementById('reg-fee-row');
    if(isRenewal) {
        feeRow.classList.add('hidden');
        document.getElementById('reg-fee-display').innerText = "0";
    } else {
        feeRow.classList.remove('hidden');
        document.getElementById('reg-fee-display').innerText = REGISTRATION_FEE;
    }

    // Slots Logic
    const age = getAge(data.dob);
    let slots = "<strong>Available Slots:</strong><br>";
    if(age <= 5) slots += "• Tue-Fri: 4-5 PM<br>• Weekends: 11 AM";
    else if(age <= 8) slots += "• Tue-Fri: 5-6 PM<br>• Sat: 3 PM, Sun: 10 AM";
    else slots += "• Tue-Fri: 6-7 PM<br>• Sat: 4 PM, Sun: 12 PM";
    document.getElementById('reg-slots-info').innerHTML = slots;

    // Reset Form
    document.getElementById('reg-package').value = "";
    document.getElementById('training-level-group').classList.add('hidden');
    document.getElementById('total-price').innerText = "0";
    
    document.getElementById('reg-modal').classList.remove('hidden');
}

window.handlePackageChange = function() {
    const pkg = document.getElementById('reg-package').value;
    const levelGroup = document.getElementById('training-level-group');
    if(pkg === 'Special') levelGroup.classList.remove('hidden');
    else levelGroup.classList.add('hidden');
    calculateTotal();
}

window.calculateTotal = function() {
    const pkgVal = document.getElementById('reg-package').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let base = 0;

    if (pkgVal === 'Special') {
        base = SPECIAL_RATES[document.getElementById('reg-level').value] || 0;
    } else if (pkgVal) {
        base = parseInt(pkgVal.split('|')[1].replace(/,/g, ''));
    }

    let total = base;
    if (!isRenewal && base > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
}

window.toggleReview = function() {
    document.getElementById('review-body').classList.toggle('open');
}

window.submitRegistration = async function() {
    const pkgVal = document.getElementById('reg-package').value;
    const total = document.getElementById('total-price').innerText;
    const fileInput = document.getElementById('payment-proof');
    
    if(!pkgVal || total === "0") { alert("Select Package"); return; }
    if(fileInput.files.length === 0) { alert("Upload Payment Screenshot"); return; }

    const btn = document.getElementById('btn-submit-reg');
    btn.innerText = "Uploading..."; btn.disabled = true;

    try {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${Math.random()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await db.storage.from('payment-proofs').upload(fileName, file);
        if(uploadError) throw uploadError;
        
        const { data: { publicUrl } } = db.storage.from('payment-proofs').getPublicUrl(fileName);

        let pkgName = pkgVal === 'Special' ? `Special - ${document.getElementById('reg-level').value}` : pkgVal.split('|')[0];
        
        const { error } = await db.from('leads').update({
            status: 'Registration Requested',
            child_name: document.getElementById('edit-name').value,
            phone: document.getElementById('edit-phone').value,
            selected_package: pkgName,
            package_price: total,
            payment_proof_url: publicUrl,
            start_date: document.getElementById('reg-date').value,
            payment_status: 'Verification Pending'
        }).eq('id', currentRegistrationId);

        if(error) throw error;
        alert("✅ Request Submitted! Admin will verify.");
        document.getElementById('reg-modal').classList.add('hidden');
        loadParentData(currentUser.email);

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = "Submit Request"; btn.disabled = false; }
}

// --- ADMIN FUNCTIONS ---

window.loadAdminDashboard = async function() {
    if(!currentUser) return;
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    
    document.getElementById('stat-total').innerText = data.length;
    document.getElementById('stat-reqs').innerText = data.filter(l => l.status === 'Registration Requested').length;
    document.getElementById('stat-active').innerText = data.filter(l => l.status === 'Enrolled').length;
    document.getElementById('stat-trials').innerText = data.filter(l => l.status === 'Pending Trial').length;

    const list = document.getElementById('admin-list');
    list.innerHTML = '';
    data.forEach(l => {
        let alert = l.status === 'Registration Requested' ? '<span class="text-red-500 font-bold animate-pulse">!</span>' : '';
        let btnAction = l.status === 'Registration Requested' ? 
            `<button onclick="openAdminModal(${l.id})" class="text-white bg-blue-600 px-3 py-1 rounded text-xs font-bold
