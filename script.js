// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// INIT DB
let db = null;
document.addEventListener('DOMContentLoaded', () => {
    try {
        const { createClient } = supabase; 
        db = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("DB Ready");
        const toast = document.getElementById('toast');
        toast.className = "show"; setTimeout(() => toast.className = "", 3000);
    } catch (e) { alert("System Error: " + e.message); }
});

// --- HELPER FUNCTIONS ---
function getAge(dob) {
    if(!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

function calculateAgeDisplay() {
    const age = getAge(document.getElementById('dob').value);
    document.getElementById('age-value').innerText = age;
    document.getElementById('age-display').classList.remove('hidden');
}

function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); else target.classList.add('hidden');
}

function toggleTrial(isTrial) {
    document.getElementById('is_trial').value = isTrial;
    if(isTrial) {
        document.getElementById('btn-trial').className = "px-6 py-2 rounded-lg font-bold text-sm bg-white shadow text-blue-600 transition";
        document.getElementById('btn-direct').className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 transition";
        document.getElementById('btn-submit').innerText = "Request Free Trial";
        document.getElementById('btn-submit').className = "w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition shadow-lg text-lg";
    } else {
        document.getElementById('btn-direct').className = "px-6 py-2 rounded-lg font-bold text-sm bg-white shadow text-blue-600 transition";
        document.getElementById('btn-trial').className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 transition";
        document.getElementById('btn-submit').innerText = "Submit & Enroll";
        document.getElementById('btn-submit').className = "w-full bg-rose-600 text-white font-bold py-4 rounded-xl hover:bg-rose-700 transition shadow-lg text-lg";
    }
}

// --- FORM SUBMISSION ---
async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    const isTrial = document.getElementById('is_trial').value === 'true';
    
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;

    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const formData = {
        parent_name: document.getElementById('p_name').value,
        child_name: document.getElementById('k_name').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        dob: document.getElementById('dob').value || null,
        gender: document.getElementById('gender').value,
        intent: intentVal,
        medical_info: document.getElementById('medical').value,
        how_heard: sourceVal,
        is_trial: isTrial,
        status: isTrial ? 'Pending Trial' : 'Application Received',
        age_group: 'Pending Assessment',
        terms_agreed: document.getElementById('terms_check').checked,
        marketing_consent: document.getElementById('marketing_check').checked
    };

    try {
        if(!db) throw new Error("DB Error");
        const { error } = await db.from('leads').insert([formData]);
        if (error) throw error;
        alert("✅ Success! Registration Saved.");
        e.target.reset();
        document.getElementById('age-display').classList.add('hidden');
        document.querySelectorAll('.hidden').forEach(el => el.classList.add('hidden')); 
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = isTrial ? "Request Free Trial" : "Submit & Enroll"; btn.disabled = false; }
}

// --- TRAINER LOGIC (MODAL) ---
let currentTrialId = null;

async function loadTrainerDashboard() {
    const list = document.getElementById('trial-list');
    list.innerHTML = '<div class="p-4 text-center">Loading...</div>';
    // Fetch all pending trials (for all trainers)
    const { data, error } = await db.from('leads').select('*').eq('is_trial', true).eq('status', 'Pending Trial').order('created_at', {ascending: true});
    
    if (!data || data.length === 0) { list.innerHTML = '<div class="p-4 text-center text-gray-400">No pending trials</div>'; return; }
    list.innerHTML = '';
    
    data.forEach(l => {
        const age = getAge(l.dob);
        list.innerHTML += `
        <div class="p-4 flex justify-between items-center hover:bg-slate-50">
            <div>
                <div class="font-bold text-slate-800">${l.child_name} <span class="text-xs font-normal text-slate-500">(${age} Yrs)</span></div>
                <div class="text-xs text-slate-500">Parent: ${l.parent_name}</div>
                <div class="text-xs text-blue-600 font-bold">${l.intent || 'No Intent'}</div>
            </div>
            <button onclick="openTrialModal(${l.id}, ${age}, '${l.child_name}')" class="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700">
                Start Assessment
            </button>
        </div>`;
    });
}

function openTrialModal(id, age, name) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = name;
    
    // Auto-Select Recommended Batch based on Age
    let recommended = '3-5 Yrs';
    if(age >= 5 && age < 8) recommended = '5-8 Yrs';
    if(age >= 8 && age < 18) recommended = '8+ Yrs';
    if(age >= 18) recommended = 'Adult';
    
    document.getElementById('trainer-batch').value = recommended;
    document.getElementById('trial-modal').classList.remove('hidden');
}

function closeTrialModal() {
    document.getElementById('trial-modal').classList.add('hidden');
    currentTrialId = null;
}

async function submitTrialResult() {
    if(!currentTrialId) return;
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    
    if(!feedback) { alert("Please enter feedback"); return; }

    const btn = document.getElementById('btn-complete-trial');
    btn.innerText = "Saving..."; btn.disabled = true;

    const { error } = await db.from('leads').update({ 
        status: 'Trial Completed', 
        trial_completed_at: new Date(),
        trainer_feedback: feedback,
        recommended_batch: batch,
        age_group: batch // Update the main age group as well
    }).eq('id', currentTrialId);

    if(error) alert("Error");
    else {
        alert("Trial Marked Complete!");
        closeTrialModal();
        loadTrainerDashboard();
    }
    btn.innerText = "Mark Complete & Save"; btn.disabled = false;
}

// --- PARENT PORTAL ---
async function searchParent() {
    const phone = document.getElementById('parent-search-phone').value;
    const resBox = document.getElementById('parent-result');
    const actionArea = document.getElementById('action-area');
    const { data } = await db.from('leads').select('*').eq('phone', phone).order('created_at', {ascending: false}).limit(1);
    
    if(!data || data.length === 0) { alert("No record found."); return; }
    const child = data[0];
    resBox.classList.remove('hidden');
    document.getElementById('res-child').innerText = child.child_name;
    document.getElementById('res-status').innerText = child.status;

    // Show Batch if assigned
    if (child.recommended_batch || (child.age_group && child.age_group !== 'Pending Assessment')) {
        document.getElementById('res-batch').classList.remove('hidden');
        document.getElementById('batch-val').innerText = child.recommended_batch || child.age_group;
    }

    if (child.status === 'Trial Completed') {
        actionArea.innerHTML = `
            <div class="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100">
                <p class="font-bold mb-1">🎉 Trial Completed!</p>
                <p class="mb-2">Trainer Recommendation: <strong>${child.recommended_batch}</strong></p>
                <p class="italic text-xs">"${child.trainer_feedback || ''}"</p>
                <div class="mt-3 p-2 bg-white rounded border text-center text-slate-500 text-xs">
                    Please contact Admin to finalize enrollment.
                </div>
            </div>`;
    } else if (child.status === 'Enrolled') {
        actionArea.innerHTML = `<div class="mt-2 text-green-600 font-bold bg-green-50 p-2 rounded text-center">✅ Active Student</div>`;
    } else { actionArea.innerHTML = ``; }
}

// --- ADMIN LOGIC ---
async function fetchLeads() {
    const list = document.getElementById('leads-list');
    list.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>';
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    list.innerHTML = '';
    if(data) {
        data.forEach(l => {
            let age = getAge(l.dob);
            let badgeClass = "bg-gray-100 text-gray-600";
            if(l.status === 'Enrolled') badgeClass = "bg-green-100 text-green-700";
            if(l.status === 'Trial Completed') badgeClass = "bg-blue-100 text-blue-700";

            // Show Recommended Batch if available, else age group
            let displayBatch = l.recommended_batch || l.age_group;

            let btnAction = `<button onclick="processEnrollment(${l.id}, '${l.child_name}', '${displayBatch}')" class="bg-slate-800 text-white px-3 py-1 rounded text-xs font-bold">Enroll</button>`;
            if(l.status === 'Enrolled') btnAction = `<span class="text-green-600 font-bold text-xs"><i class="fas fa-check"></i> Enrolled</span>`;

            list.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-4">
                    <div class="font-bold text-slate-800">${l.child_name}</div>
                    <div class="text-xs text-slate-500">${age} Yrs | ${l.gender}</div>
                </td>
                <td class="p-4">
                    <div class="font-bold text-xs uppercase text-slate-400">Parent</div>
                    <div class="text-sm">${l.parent_name}</div>
                    <div class="text-xs text-blue-600">${l.phone}</div>
                </td>
                <td class="p-4"><span class="${badgeClass} px-2 py-1 rounded text-xs font-bold uppercase">${l.status}</span></td>
                <td class="p-4 text-xs font-bold text-slate-700">${displayBatch}</td>
                <td class="p-4">${btnAction}</td>
            </tr>`;
        });
    }
}

async function processEnrollment(id, name, currentBatch) {
    const batch = prompt(`Confirm Batch for ${name}:`, currentBatch);
    if(!batch) return;
    const { error } = await db.from('leads').update({ status: 'Enrolled', age_group: batch }).eq('id', id);
    if(error) alert("Error"); else { alert("Student Enrolled!"); fetchLeads(); }
}

// --- NAV ---
function showPage(pageId) {
    document.querySelectorAll('#landing, #parent-portal, #admin, #trainer').forEach(el => el.classList.add('hide'));
    document.getElementById(pageId).classList.remove('hide');
    document.getElementById(pageId).classList.add('fade-in');
    window.scrollTo(0,0);
}
function scrollToSection(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }
function loginAs(role) { 
    const pin = prompt(`Enter ${role.toUpperCase()} PIN:`); 
    if (role === 'admin' && pin === '1234') { showPage('admin'); fetchLeads(); } 
    else if (role === 'trainer' && pin === '0000') { showPage('trainer'); loadTrainerDashboard(); } 
    else { alert("Wrong PIN"); } 
}
function logout() { showPage('landing'); }
