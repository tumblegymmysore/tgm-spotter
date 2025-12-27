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
        // Show Toast
        const toast = document.getElementById('toast');
        toast.className = "show"; 
        setTimeout(() => toast.className = "", 3000);
    } catch (e) { 
        alert("System Error: " + e.message); 
    }
});

// --- UI FUNCTIONS ---

// 1. Calculate Age
function calculateAge() {
    const dob = document.getElementById('dob').value;
    if(!dob) return;
    const diff = Date.now() - new Date(dob).getTime();
    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    document.getElementById('age-value').innerText = age;
    document.getElementById('age-display').classList.remove('hidden');
}

// 2. Generic function to toggle "Other" text input
function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden');
    else target.classList.add('hidden');
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

// 3. Form Submission
async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerText = "Processing..."; btn.disabled = true;

    const isTrial = document.getElementById('is_trial').value === 'true';
    
    // Handle Intent & Source (Check for 'Other')
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
        
        alert("✅ Registration Saved!");
        e.target.reset();
        document.getElementById('age-display').classList.add('hidden');
        document.querySelectorAll('.hidden').forEach(el => el.classList.add('hidden')); // Hide Other inputs
    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = isTrial ? "Request Free Trial" : "Submit & Enroll"; btn.disabled = false; }
}

// --- TRAINER LOGIC ---
async function loadTrainerDashboard() {
    const list = document.getElementById('trial-list');
    list.innerHTML = '<div class="p-4 text-center">Loading...</div>';
    const { data, error } = await db.from('leads').select('*').eq('is_trial', true).eq('status', 'Pending Trial');
    if (!data || data.length === 0) { list.innerHTML = '<div class="p-4 text-center text-gray-400">No pending trials</div>'; return; }
    list.innerHTML = '';
    data.forEach(l => {
        list.innerHTML += `<div class="p-4 flex justify-between items-center hover:bg-slate-50"><div><div class="font-bold text-slate-700">${l.child_name}</div><div class="text-xs text-slate-500">Phone: ${l.phone}</div></div><button onclick="markTrialComplete(${l.id})" class="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold border border-green-200 hover:bg-green-200">Mark Done</button></div>`;
    });
}

async function markTrialComplete(id) {
    if(!confirm("Confirm trial completion?")) return;
    const { error } = await db.from('leads').update({ status: 'Trial Completed' }).eq('id', id);
    if(error) alert("Error"); else loadTrainerDashboard();
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

    if (child.age_group !== 'Pending Assessment') {
        document.getElementById('res-batch').classList.remove('hidden');
        document.getElementById('batch-val').innerText = child.age_group;
    }

    if (child.status === 'Trial Completed') {
        actionArea.innerHTML = `<div class="bg-blue-50 p-3 rounded text-sm text-blue-800">Trial Done! Contact Owner to Enroll.</div>`;
    } else if (child.status === 'Enrolled') {
        actionArea.innerHTML = `<div class="mt-2 text-green-600 font-bold">✅ Active Student</div>`;
    } else { actionArea.innerHTML = ``; }
}

// --- OWNER LOGIC ---
async function fetchLeads() {
    const list = document.getElementById('leads-list');
    list.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>';
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    list.innerHTML = '';
    if(data) {
        data.forEach(l => {
            let age = "N/A";
            if(l.dob) {
                const ageDate = new Date(Date.now() - new Date(l.dob).getTime());
                age = Math.abs(ageDate.getUTCFullYear() - 1970);
            }
            let badgeClass = l.status === 'Enrolled' ? "bg-green-100 text-green-700" : (l.status === 'Trial Completed' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600");
            let btnAction = `<button onclick="processEnrollment(${l.id}, '${l.child_name}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Assign Batch</button>`;
            if(l.status === 'Enrolled') btnAction = `<span class="text-green-600 font-bold text-xs">Enrolled</span>`;

            list.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-4 font-bold text-slate-800">${l.child_name}</td><td class="p-4 text-slate-500">${age} Yrs</td><td class="p-4"><div class="font-bold text-xs uppercase text-slate-400">Parent</div><div>${l.parent_name}</div><div class="text-xs text-blue-500">${l.phone}</div></td><td class="p-4"><span class="${badgeClass} px-2 py-1 rounded text-xs font-bold uppercase">${l.status}</span></td><td class="p-4">${btnAction}</td></tr>`;
        });
    }
}

async function processEnrollment(id, name) {
    const batch = prompt(`Assign Batch/Age Group for ${name}:\n(e.g., Toddler, 6-9 Yrs, Elite)`);
    if(!batch) return;
    const { error } = await db.from('leads').update({ status: 'Enrolled', age_group: batch }).eq('id', id);
    if(error) alert("Error updating"); else { alert("Student Enrolled!"); fetchLeads(); }
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
