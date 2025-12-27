import { db, REGISTRATION_FEE, SPECIAL_RATES } from '../config.js';
import { showToast, getAge } from '../utils.js';
import { currentUser } from '../auth.js';

let currentRegistrationId = null;

export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
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
        
        showToast("Request Sent! Login with Email & Phone.");
        e.target.reset();
        window.scrollTo(0,0);
        document.getElementById('age-display').classList.add('hidden');

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = originalText; btn.disabled = false; }
}

export async function loadParentData(email) {
    const content = document.getElementById('parent-content');
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    if(!data || data.length === 0) { content.innerHTML = '<p class="text-center p-4 text-slate-500">No records found.</p>'; return; }
    
    let html = '';
    data.forEach(child => {
        let actionArea = '';
        if(child.status === 'Trial Completed') {
            actionArea = `
                <div class="bg-blue-50 p-4 rounded-xl mt-4 border border-blue-100">
                    <p class="font-bold text-blue-900 text-sm mb-2">🎉 Trial Successful!</p>
                    <p class="text-xs text-slate-600 mb-3">Coach <strong>${child.trainer_name || 'Staff'}</strong> recommends: <span class="bg-white px-2 py-1 rounded border border-slate-200 font-bold">${child.recommended_batch}</span></p>
                    <button onclick="window.openRegistrationModal(${child.id})" class="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700 shadow">Register Now</button>
                </div>`;
        } else if (child.status === 'Enrolled') {
            actionArea = `
                <div class="mt-4 bg-green-50 p-3 rounded-lg text-green-800 text-sm text-center font-bold border border-green-200">✅ Active Student</div>
                <button onclick="window.openRegistrationModal(${child.id}, true)" class="w-full mt-2 bg-white border border-green-600 text-green-700 font-bold py-2 rounded-lg text-xs hover:bg-green-50">Renew Membership</button>
            `;
        } else if (child.status === 'Registration Requested') {
            actionArea = `<div class="mt-4 bg-yellow-50 p-3 rounded-lg text-yellow-800 text-sm text-center font-bold border border-yellow-200">⏳ Verification Pending</div>`;
        } else {
            actionArea = `<div class="mt-4 text-center text-xs text-slate-400 italic">Pending Trial Completion</div>`;
        }

        html += `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 class="font-bold text-xl text-slate-800">${child.child_name}</h3>
            <p class="text-sm text-slate-500">Status: <span class="font-bold text-blue-600">${child.status}</span></p>
            ${actionArea}
        </div>`;
    });
    content.innerHTML = html;
}

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
    let slots = "<strong>Available Slots:</strong><br>";
    if(age <= 5) slots += "• Tue-Fri: 4-5 PM<br>• Weekends: 11 AM";
    else if(age <= 8) slots += "• Tue-Fri: 5-6 PM<br>• Sat: 3 PM, Sun: 10 AM";
    else slots += "• Tue-Fri: 6-7 PM<br>• Sat: 4 PM, Sun: 12 PM";
    document.getElementById('reg-slots-info').innerHTML = slots;

    document.getElementById('reg-package').value = "";
    document.getElementById('training-level-group').classList.add('hidden');
    document.getElementById('total-price').innerText = "0";
    document.getElementById('reg-modal').classList.remove('hidden');
}

export function handlePackageChange() {
    const pkg = document.getElementById('reg-package').value;
    const levelGroup = document.getElementById('training-level-group');
    if(pkg === 'Special') levelGroup.classList.remove('hidden');
    else levelGroup.classList.add('hidden');
    calculateTotal();
}

export function calculateTotal() {
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

export async function submitRegistration() {
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
        showToast("Request Submitted!");
        document.getElementById('reg-modal').classList.add('hidden');
        loadParentData(currentUser.email);

    } catch (err) { alert("Error: " + err.message); } 
    finally { btn.innerText = "Submit Request"; btn.disabled = false; }
}
