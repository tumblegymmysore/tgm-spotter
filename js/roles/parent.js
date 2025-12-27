import { db, REGISTRATION_FEE, SPECIAL_RATES } from '../config.js';
import { showToast, getAge } from '../utils.js';

export async function handleIntakeSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    // ... (Data Collection - abbreviated for brevity, same as before) ...
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
        
        // FIX 4: Show Success Modal instead of just Toast
        document.getElementById('success-modal').classList.remove('hidden');
        
        // EMAIL NOTE: Real email sending to admins requires Supabase Edge Functions.
        // Client-side code cannot securely send emails without exposing API keys.

    } catch (err) { alert("Error: " + err.message); btn.innerText = originalText; btn.disabled = false; } 
}

// ... (Rest of Parent Logic: loadParentData, openRegistrationModal etc. from V13) ...
// Copy the rest of the Parent Logic from the V13 script here.
