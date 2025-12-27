import { db, REGISTRATION_FEE, SPECIAL_RATES } from '../config.js';
import { showToast, getAge } from '../utils.js';
import { currentUser } from '../auth.js';

let currentRegistrationId = null;

// --- INTAKE FORM SUBMISSION ---
export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    // 1. Gather Data
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    
    // Handle "Other" fields logic
    let intentVal = document.getElementById('intent').value;
    if(intentVal.includes('Other')) intentVal = document.getElementById('intent_other').value;
    let sourceVal = document.getElementById('source').value;
    if(sourceVal.includes('Other')) sourceVal = document.getElementById('source_other').value;

    const formData = {
        parent_name: document.getElementById('p_name').value, 
        child_name: document.getElementById('k_name').value,
        phone: phone, 
        email: email, 
        address: document.getElementById('address').value,
        dob: document.getElementById('dob').value, 
        gender: document.getElementById('gender').value,
        intent: intentVal, 
        medical_info: document.getElementById('medical').value, 
        how_heard: sourceVal, 
        is_trial: true, 
        status: 'Pending Trial', 
        age_group: 'Pending Assessment'
    };

    try {
        // 2. Create User Account (Auto-SignUp)
        const { data: authData } = await db.auth.signUp({ email: email, password: phone });
        
        // Ensure 'parent' role exists
        if(authData.user) {
            const { data: roleData } = await db.from('user_roles').select('*').eq('id', authData.user.id);
            if(!roleData || roleData.length === 0) {
                await db.from('user_roles').insert([{ id: authData.user.id, role: 'parent', email: email }]);
            }
        }

        // 3. Save Lead Data
        const { error } = await db.from('leads').insert([formData]);
        if (error) throw error;
        
        // 4. SUCCESS ACTION (Pop-up instead of reload)
        document.getElementById('success-modal').classList.remove('hidden');
        
        // Clear form
        e.target.reset();
        document.getElementById('age-display').classList.add('hidden');

    } catch (err) { 
        alert("Error: " + err.message); 
    } finally { 
        btn.innerText = originalText; btn.disabled = false; 
    }
}

// --- PARENT DASHBOARD LOGIC (Keep V13 Logic) ---
export async function loadParentData(email) {
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) { content.innerHTML = '<p class="text-center p-4">No records found.</p>'; return; }
    
    let html = '';
    data.forEach(child => {
        let actionArea = '';
        if(child.status === 'Trial Completed') {
            actionArea = `<div class="bg-blue-50 p-4 rounded mt-2"><p class="font-bold text-blue-900 mb-2">🎉 Trial Successful!</p><button onclick="window.openRegistrationModal(${child.id})" class="w-full bg-blue-600 text-white font-bold py-2 rounded">Register Now</button></div>`;
        } else if (child.status === 'Enrolled') {
            actionArea = `<div class="mt-2 bg-green-50 p-2 rounded text-green-800 font-bold text-center">✅ Active Student</div><button onclick="window.openRegistrationModal(${child.id}, true)" class="w-full mt-2 bg-white border border-green-600 text-green-700 font-bold py-1 rounded">Renew</button>`;
        } else {
            actionArea = `<div class="mt-2 text-center text-slate-400 italic">Trial Pending...</div>`;
        }
        html += `<div class="bg-white p-4 rounded shadow mb-4"><h3 class="font-bold text-xl">${child.child_name}</h3><p class="text-sm">${child.status}</p>${actionArea}</div>`;
    });
    content.innerHTML = html;
}

// --- REGISTRATION LOGIC (Keep V13 Logic) ---
export async function openRegistrationModal(id, isRenewal = false) {
    currentRegistrationId = id;
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    
    document.getElementById('reg-child-name').innerText = data.child_name;
    document.getElementById('is-renewal').value = isRenewal;
    document.getElementById('edit-name').value = data.child_name;
    document.getElementById('edit-phone').value = data.phone;
    document.getElementById('edit-email').value = data.email;
    
    const feeRow = document.getElementById('reg-fee-row');
    if(isRenewal) {
        feeRow.classList.add('hidden');
        document.getElementById('reg-fee-display').innerText = "0";
    } else {
        feeRow.classList.remove('hidden');
        document.getElementById('reg-fee-display').innerText = REGISTRATION_FEE;
    }

    const age = getAge(data.dob);
    let slots = "Available Slots: Weekdays 4-5 PM"; // Default
    if(age <= 5) slots = "Weekdays 4-5 PM | Weekends 11 AM";
    else if(age <= 8) slots = "Weekdays 5-6 PM | Sat 3 PM, Sun 10 AM";
    else slots = "Weekdays 6-7 PM | Sat 4 PM, Sun 12 PM";
    document.getElementById('reg-slots-info').innerHTML = slots;

    document.getElementById('reg-modal').classList.remove('hidden');
}

export function handlePackageChange() {
    const pkg = document.getElementById('reg-package').value;
    const levelGroup = document.getElementById('training-level-group');
    if(pkg === 'Special') levelGroup.classList.remove('hidden'); else levelGroup.classList.add('hidden');
    calculateTotal();
}

export function calculateTotal() {
    const pkgVal = document.getElementById('reg-package').value;
    const isRenewal = document.getElementById('is-renewal').value === 'true';
    let base = 0;
    if (pkgVal === 'Special') base = SPECIAL_RATES[document.getElementById('reg-level').value] || 0;
    else if (pkgVal) base = parseInt(pkgVal.split('|')[1].replace(/,/g, ''));
    
    let total = base;
    if (!isRenewal && base > 0) total += REGISTRATION_FEE;
    document.getElementById('total-price').innerText = total.toLocaleString('en-IN');
}

export function toggleReview() { document.getElementById('review-body').classList.toggle('open'); }

export async function submitRegistration() {
    const pkgVal = document.getElementById('reg-package').value;
    const total = document.getElementById('total-price').innerText;
    const fileInput = document.getElementById('payment-proof');
    if(!pkgVal || total === "0") { alert("Select Package"); return; }
    if(fileInput.files.length === 0) { alert("Upload Proof"); return; }

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
        
        // Show success logic here if needed, or reuse generic toast
        showToast("Registration Submitted!");
        document.getElementById('reg-modal').classList.add('hidden');
        loadParentData(currentUser.email);

    } catch (err) { alert(err.message); } 
    finally { btn.innerText = "Submit Request"; btn.disabled = false; }
}
