// js/main.js

// --------------------------------------------------------------------------
// 1. SETUP SUPABASE
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready (v12).");

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
    
    // Adjust if birthday hasn't happened yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    // Show result
    const displayEl = document.getElementById('age-display');
    const valueEl = document.getElementById('age-value');
    
    if (displayEl && valueEl) {
        valueEl.innerText = age;
        displayEl.classList.remove('hidden');
    }
};

// --------------------------------------------------------------------------
// 3. HELPER: Show Custom Error Modal
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

    // --- GET DATA ---
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    
    // --- FRONTEND VALIDATION ---

    // 1. Clean the numbers (remove spaces, dashes)
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // 2. Validate MAIN MOBILE (Strict 10 Digits)
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError(
            "Invalid Mobile Number", 
            "Please check the 'Mobile (WhatsApp)' field. It must be exactly 10 digits (e.g., 9900000000). Do not include +91 or spaces."
        );
        return; 
    }

    // 3. Validate ALTERNATE PHONE (Flexible Landline Logic)
    if (rawAltPhone.length > 0) {
        let isValid = false;
        
        // Case A: Starts with 0 (Landline) -> Allow 10 to 12 digits
        if (cleanAltPhone.startsWith('0')) {
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) isValid = true;
        } 
        // Case B: Mobile -> Must be 10 digits
        else if (/^[0-9]{10}$/.test(cleanAltPhone)) {
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

    // --- CAPTURE "OTHER" FIELDS ---
    const sourceSelect = document.getElementById('source').value;
    const finalSource = sourceSelect === 'Other' 
        ? document.getElementById('source_other').value 
        : sourceSelect;

    const intentSelect = document.getElementById('intent').value;
    const finalIntent = intentSelect === 'Other' 
        ? document.getElementById('intent_other').value 
        : intentSelect;

    // --- LOCK BUTTON ---
    btn.disabled = true;
    btn.innerText = "Saving...";

    // --- PREPARE DATA ---
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

    try {
        // --- SAVE TO DB ---
        const { data, error } = await supabaseClient
            .from('leads')
            .insert([formData])
            .select();

        if (error) {
            console.error("Supabase Error:", error);

            if (error.code === '23505' || error.message.includes('unique constraint')) {
                showError(
                    "Registration Exists!", 
                    "This student is already registered with us. You cannot take an additional trial session.\n\nPlease check with Admin, or Login/Register if you have already completed the trial."
                );
            } 
            else if (error.code === '23514' || error.message.includes('check_phone_format')) {
                showError(
                    "System Rejected Phone", 
                    "The phone number format was rejected by the system. Please ensure it is strictly 10 digits."
                );
            }
            else {
                showError("System Error", error.message);
            }

            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // --- TRIGGER NOTIFICATION (Robust Version) ---
        btn.innerText = "Notifying...";
        console.log("Triggering email for:", data[0].child_name);

        const notifyResponse = await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({ record: data[0] }) 
        });

        if (notifyResponse.ok) {
            console.log("Notification Request Sent.");
        } else {
            console.warn("Notification Request Failed (Data still saved):", await notifyResponse.text());
        }

        // --- SUCCESS UI ---
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

    } catch (err) {
        console.error("Unexpected Error:", err);
        showError("Unexpected Error", "Something went wrong. Please check your internet connection.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
