// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// GYM DATA (From your image)
const PACKAGES = [
    { name: "2 Days/Week - 1 Month", price: "3,500" },
    { name: "2 Days/Week - 3 Months", price: "9,000" },
    { name: "2 Days/Week - 6 Months", price: "16,000" },
    { name: "2 Days/Week - 12 Months", price: "25,000" },
    { name: "Unlimited - 1 Month", price: "5,500" },
    { name: "Unlimited - 3 Months", price: "15,000" },
    { name: "Unlimited - 6 Months", price: "25,000" },
    { name: "Unlimited - 12 Months", price: "35,000" }
];

let db = null;
let currentUser = null;
let currentUserName = "Staff"; // Default

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
    if(error) alert("Login Failed: " + error.message); 
    else { document.getElementById('login-modal').classList.add('hidden'); handleSessionSuccess(data.user); }
}

async function handleSessionSuccess(user) {
    currentUser = user;
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');

    // GET ROLE AND REAL NAME
    const { data } = await db.from('user_roles').select('*').eq('id', user.id).single();
    const role = data ? data.role : 'parent';
    currentUserName = data && data.full_name ? data.full_name : user.email.split('@')[0]; // Fallback to email prefix

    document.getElementById('user-role-badge').innerText = role.toUpperCase();

    if(role === 'admin') { showPage('admin'); loadAdminDashboard(); }
    else if(role === 'trainer') { showPage('trainer'); loadTrainerDashboard(); }
    else { showPage('parent-portal'); loadParentData(user.email); }
}

async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}

// --- PUBLIC INTAKE ---
async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    // Data Gathering
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    
    // ... (Existing Logic for Intent/Source) ...
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
        how_heard: sourceVal, is_trial: true, status: 'Pending Trial',
        age_group: 'Pending Assessment'
    };

    try {
        const { data: authData } = await db.auth.signUp({ email: email, password: phone });
        if(authData.user) {
            const { data: roleData } = await db.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) {
                await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
            }
        }
        const { error } = await db.from('leads').insert([formData]);
        if (error) throw error;

        alert("✅ Trial Request Sent! Login with Email & Phone.");
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
                <div class="mt-1">${badge}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, '${l.child_name}', ${getAge(l.dob)}, '${l.status}', '${l.trainer_feedback||''}', '${l.recommended_batch||''}')" 
                class="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold">Assess</button>
        </div>`;
    });
}

function openTrialModal(id, name, age, status, feedback, batch) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = name;
    document.getElementById('trainer-feedback').value = feedback;
    
    // Auto-calculate batch if not set
    let rec = batch;
    if(!rec) {
        if(age < 5) rec = '3-5 Yrs';
        else if(age < 8) rec = '5-8 Yrs';
        else if(age < 18) rec = '8+ Yrs';
        else rec = 'Adult';
    }
    document.getElementById('trainer-batch').value = rec;
    
    const isReadOnly = status === 'Trial Completed';
    document.getElementById('btn-save-trial').classList.toggle('hidden', isReadOnly);
    document.getElementById('trial-modal').classList.remove('hidden');
}

async function submitTrialResult() {
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    
    // USE GLOBAL currentUserName (Coach Pradeep)
    if(!feedback) { alert("Feedback required"); return; }

    const { error } = await db.from('leads').update({
        status: 'Trial Completed', trial_completed_at: new Date(),
        trainer_feedback: feedback, recommended_batch: batch,
        trainer_name: currentUserName, age_group: batch 
    }).eq('id', currentTrialId);

    if(error) alert("Error"); 
    else { showToast("Saved"); document.getElementById('trial-modal').classList.add('hidden'); loadTrainerDashboard(); }
}

// --- PARENT PORTAL & REGISTRATION ---
let currentRegistrationId = null;
let currentStudentData = null; // Store for review

// PRICING CONSTANTS
const REGISTRATION_FEE = 2000;
const SPECIAL_RATES = {
    "Beginner": 700, "Intermediate": 850, "Advanced": 1000
};

async function loadParentData(email) {
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) { content.innerHTML = '<p class="text-center p-4">No records found.</p>'; return; }
    
    let html = '';
    data.forEach(child => {
        let actionArea = '';
        if(child.status === 'Trial Completed') {
            actionArea = `
                <div class="bg-blue-50 p-4 rounded mt-2 border border-blue-100">
                    <p class="font-bold text-blue-900 text-sm mb-2">🎉 Trial Successful!</p>
                    <p class="text-xs text-slate-600 mb-2"><strong>${child.trainer_name}</strong> recommends: <strong>${child.recommended_batch}</strong></p>
                    <button onclick="openRegistrationModal(${child.id})" class="w-full bg-blue-600 text-white font-bold py-2 rounded text-sm hover:bg-blue-700">Register Now</button>
                </div>`;
        } else if (child.status === 'Enrolled') {
            // RENEWAL BUTTON
            actionArea = `
                <div class="mt-2 bg-green-50 p-2 rounded text-green-800 text-xs text-center font-bold mb-2">✅ Active Student</div>
                <button onclick="openRegistrationModal(${child.id}, true)" class="w-full bg-white border border-green-600 text-green-700 font-bold py-1 rounded text-xs">Renew Membership</button>
            `;
        } else if (child.status === 'Registration Requested') {
            actionArea = `<div class="mt-2 bg-yellow-50 p-2 rounded text-yellow-800 text-xs text-center font-bold">⏳ Verification Pending</div>`;
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

async function openRegistrationModal(id, isRenewal = false) {
    currentRegistrationId = id;
    
    // Fetch fresh data for the form
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    currentStudentData = data;

    document.getElementById('reg-child-name').innerText = data.child_name;
    document.getElementById('is-renewal').value = isRenewal; // Hidden flag

    // 1. POPULATE REVIEW FIELDS
    document.getElementById('edit-name').value = data.child_name;
    document.getElementById('edit-phone').value = data.phone;
    document.getElementById('edit-email').value = data.email;
    
    // 2. SHOW/HIDE REGISTRATION FEE WARNING
    const feeRow = document.getElementById('reg-fee-row');
    if(isRenewal) {
        feeRow.classList.add('hidden'); // Hide for renewals
        document.getElementById('reg-fee-display').innerText = "0";
    } else {
        feeRow.classList.remove('hidden'); // Show for new
        document.getElementById('reg-fee-display').innerText = REGISTRATION_FEE;
    }

    // 3. SHOW AGE-BASED SLOTS
    const age = getAge(data.dob);
    let slotsHtml = "<strong>Available Slots:</strong><br>";
    if(age <= 5) slotsHtml += "• Weekdays: 4-5 PM | Weekends: 11 AM";
    else if(age <= 8) slotsHtml += "• Weekdays: 5-6 PM | Sat: 3 PM, Sun: 10 AM";
    else slotsHtml += "• Weekdays: 6-7 PM | Sat: 4 PM, Sun: 12 PM";
    document.getElementById('reg-slots-info').innerHTML = slotsHtml;

    // 4. RESET FORM
    document.getElementById('reg-package').value = "";
    document.getElementById('training-level-group').classList.add('hidden');
    document.getElementById('total-price').innerText = "0";
    document.getElementById('reg-modal').classList.remove('hidden');
}

function toggleReview() {
    document.getElementById('review-body').classList.toggle('open');
}

function handlePackageChange() {
    const pkg = document.getElementById('reg-package').value;
    const levelGroup = document.getElementById('training-level-group');
    
    // Show/Hide Level Selector if "Special/Professional" is chosen
    // (Assuming user selects "Special Training" option from dropdown)
    if(pkg === 'Special') {
        levelGroup.classList.remove('hidden');
        calculateTotal();
    } else {
        levelGroup.classList.add('hidden');
        calculateTotal();
    }
}

function calculateTotal() {
    const pkgVal = document.getElementById('reg-package').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let basePrice = 0;

    // 1. Get Base Price
    if (pkgVal === 'Special') {
        const level = document.getElementById('reg-level').value;
        basePrice = SPECIAL_RATES[level] || 0; 
        // Note: Special rates usually per class? Assuming monthly for logic, or user manually enters quantity? 
        // For simplicity V1, we treat it as "Base Fee".
    } else if (pkgVal) {
        basePrice = parseInt(pkgVal.split('|')[1].replace(/,/g, ''));
    }

    // 2. Add Registration Fee (if not renewal)
    let total = basePrice;
    if (!isRenewal && basePrice > 0) total += REGISTRATION_FEE;

    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
}

async function submitRegistration() {
    const pkgVal = document.getElementById('reg-package').value;
    const total = document.getElementById('total-price').innerText;
    const fileInput = document.getElementById('payment-proof');
    const isRenewal = document.getElementById('is-renewal').value === 'true';

    if(!pkgVal || total === "0") { alert("Please select a package."); return; }
    if(fileInput.files.length === 0) { alert("Please upload payment screenshot."); return; }

    const btn = document.querySelector('#reg-modal button[onclick="submitRegistration()"]');
    btn.innerText = "Uploading..."; btn.disabled = true;

    try {
        // 1. UPLOAD IMAGE
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await db.storage
            .from('payment-proofs')
            .upload(fileName, file);

        if(uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = db.storage.from('payment-proofs').getPublicUrl(fileName);

        // 2. UPDATE PARENT INFO (If changed in Review)
        const newName = document.getElementById('edit-name').value;
        const newPhone = document.getElementById('edit-phone').value;
        
        // 3. SAVE TO DB
        let pkgName = pkgVal === 'Special' ? `Special - ${document.getElementById('reg-level').value}` : pkgVal.split('|')[0];

        const { error } = await db.from('leads').update({
            status: 'Registration Requested',
            child_name: newName, // Allow updating child name
            phone: newPhone,     // Allow updating phone
            selected_package: pkgName,
            package_price: total,
            payment_proof_url: publicUrl,
            start_date: document.getElementById('reg-date').value,
            payment_status: 'Verification Pending'
        }).eq('id', currentRegistrationId);

        if(error) throw error;

        alert("✅ Request Submitted! Admin will verify payment.");
        document.getElementById('reg-modal').classList.add('hidden');
        loadParentData(currentUser.email);

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.innerText = "Submit Request"; btn.disabled = false;
    }
}

// --- SHARED ---
function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); else target.classList.add('hidden');
}
function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}
function scrollToSection(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }

// ADMIN LOGIC (Keep existing fetchLeads/openAdminModal from V11 but add payment UTR display)
async function loadAdminDashboard() {
    if(!currentUser) return;
    const list = document.getElementById('admin-list');
    list.innerHTML = 'Loading...';
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    
    list.innerHTML = '';
    data.forEach(l => {
        let statusColor = l.status === 'Enrolled' ? 'green' : (l.status === 'Registration Requested' ? 'yellow' : 'gray');
        let alert = l.status === 'Registration Requested' ? '<span class="text-red-500 font-bold animate-pulse">!</span>' : '';
        
        list.innerHTML += `
        <tr class="border-b hover:bg-slate-50">
            <td class="p-3 font-bold">${l.child_name} ${alert}</td>
            <td class="p-3 text-sm">${l.status}</td>
            <td class="p-3"><button onclick="alert('Manage Feature Coming in V13')" class="text-blue-600 text-xs font-bold border px-2 py-1 rounded">View</button></td>
        </tr>`;
    });
}
