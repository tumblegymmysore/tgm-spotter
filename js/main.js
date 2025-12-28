// js/main.js

// --------------------------------------------------------------------------
// 1. SETUP SUPABASE
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready (v13 - Direct Payload).");

// --------------------------------------------------------------------------
// 2. AGE CALCULATOR
// --------------------------------------------------------------------------
window.calculateAgeDisplay = () => {
    const dobInput = document.getElementById('dob').value;
    if (!dobInput) return;

    const dob = new Date(dobInput);
    const today = new Date();
    
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    const displayEl = document.getElementById('age-display');
    const valueEl = document.getElementById('age-value');
    
    if (displayEl && valueEl) {
        valueEl.innerText = age;
        displayEl.classList.remove('hidden');
    }
};

// --------------------------------------------------------------------------
// 3. ERROR HELPER
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// 4. MAIN SUBMISSION HANDLER
// --------------------------------------------------------------------------
window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); 
    
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    // --- GET & CLEAN DATA ---
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // --- VALIDATION 1: MOBILE ---
    // Preserved your detailed message
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError(
            "Invalid Mobile Number", 
            "Please check the 'Mobile (WhatsApp)' field. It must be exactly 10 digits (e.g., 9900000000). Do not include +91 or spaces."
        );
        return; 
    }

    // --- VALIDATION 2: ALTERNATE PHONE ---
    // Preserved your Landline logic
    if (rawAltPhone.length > 0) {
        let isValid = false;
        if (cleanAltPhone.startsWith('0')) {
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) isValid = true;
        } else if (/^[0-9]{10}$/.test(cleanAltPhone)) {
             isValid = true;
        }
        if (!isValid) {
             showError(
                 "Invalid Emergency Contact", 
                 "The 'Emergency Contact' number seems incorrect.\n\n• If Mobile: 10 Digits\n• If Landline: Must start with '0' (Std Code)"
             );
             return; 
        }
    }

    // --- PREPARE DATA ---
    const sourceSelect = document.getElementById('source').value;
    const finalSource = sourceSelect === 'Other' ? document.getElementById('source_other').value : sourceSelect;

    const intentSelect = document.getElementById('intent').value;
    const finalIntent = intentSelect === 'Other' ? document.getElementById('intent_other').value : intentSelect;

    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: cleanPhone,      
        email: document.getElementById('email').value.trim(),
        alternate_phone: cleanAltPhone, 
        address: document.getElementById('address').value.trim(),
        medical_info: document.getElementById('medical').value.trim(),
        source: finalSource, 
        intent: finalIntent,
        marketing_consent: document.getElementById('marketing_check').checked,
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        // --- STEP A: SAVE TO DB ---
        // Note: We do NOT rely on the returned data here anymore.
        const { error } = await supabaseClient
            .from('leads')
            .insert([formData]);

        if (error) {
            console.error("DB Error:", error);
            if (error.code === '23505' || error.message.includes('unique constraint')) {
                // Preserved your specific duplicate message
                showError(
                    "Registration Exists!", 
                    "This student is already registered with us. You cannot take an additional trial session.\n\nPlease check with Admin, or Login/Register if you have already completed the trial."
                );
            } else if (error.code === '23514') {
                showError("System Rejected Phone", "Phone must be 10 digits.");
            } else {
                showError("System Error", error.message);
            }
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // --- STEP B: TRIGGER NOTIFICATION (Direct Mode) ---
        // This fixes the "No Email" issue
        btn.innerText =
