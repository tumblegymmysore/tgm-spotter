// js/main.js
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Helper for Error Modal
function showError(title, message) {
    const titleEl = document.getElementById('error-title');
    const msgEl = document.getElementById('error-msg');
    const modalEl = document.getElementById('error-modal');
    if (titleEl && msgEl && modalEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;
        modalEl.classList.remove('hidden');
    } else {
        alert(`⚠️ ${title}\n\n${message}`);
    }
}

window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); 
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    // 1. GET & CLEAN PHONE NUMBERS
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // 2. VALIDATIONS
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError("Invalid Mobile Number", "Mobile number must be exactly 10 digits.");
        return; 
    }
    if (rawAltPhone.length > 0) {
        let isValid = false;
        if (cleanAltPhone.startsWith('0')) {
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) isValid = true;
        } else if (/^[0-9]{10}$/.test(cleanAltPhone)) isValid = true;

        if (!isValid) {
             showError("Invalid Emergency Contact", "Must be 10 digits (Mobile) or start with 0 (Landline).");
             return; 
        }
    }

    // 3. CAPTURE "OTHER" FIELDS CORRECTLY
    const sourceSelect = document.getElementById('source').value;
    const finalSource = sourceSelect === 'Other' 
        ? document.getElementById('source_other').value 
        : sourceSelect;

    const intentSelect = document.getElementById('intent').value;
    const finalIntent = intentSelect === 'Other' 
        ? document.getElementById('intent_other').value 
        : intentSelect;

    btn.disabled = true;
    btn.innerText = "Saving...";

    // 4. PREPARE DATA
    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: cleanPhone,      
        email: document.getElementById('email').value.trim(),
        alternate_phone: cleanAltPhone, // Now capturing correctly
        address: document.getElementById('address').value.trim(), // Now capturing correctly
        medical_info: document.getElementById('medical').value.trim(),
        source: finalSource, // Fixed the NULL issue
        intent: finalIntent,
        marketing_consent: document.getElementById('marketing_check').checked, // New field
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .insert([formData])
            .select();

        if (error) {
            console.error("Supabase Error:", error);
            if (error.code === '23505' || error.message.includes('unique constraint')) {
                showError("Registration Exists", "Student already registered.");
            } else if (error.code === '23514') {
                showError("Invalid Phone", "System rejected the phone format.");
            } else {
                showError("System Error", error.message);
            }
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // TRIGGER NOTIFICATION
        btn.innerText = "Notifying...";
        fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ record: data[0] }) 
        }).catch(err => console.error(err));

        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

    } catch (err) {
        showError("Unexpected Error", "Something went wrong.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
