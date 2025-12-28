// js/main.js

// --------------------------------------------------------------------------
// 1. SETUP SUPABASE
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready.");

// --------------------------------------------------------------------------
// 2. AGE CALCULATOR (New Feature)
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
        
        // Optional: Warn if too young/old
        if (age < 3) alert("Note: Minimum age is usually 3 years.");
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
    
    // --- VALIDATION ---
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // Mobile Check
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError("Invalid Mobile Number", "Please enter exactly 10 digits (e.g., 9900000000). No +91.");
        return; 
    }

    // Alternate Phone Check
    if (rawAltPhone.length > 0) {
        let isValid = false;
        if (cleanAltPhone.startsWith('0')) { // Landline
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) isValid = true;
        } else if (/^[0-9]{10}$/.test(cleanAltPhone)) { // Mobile
             isValid = true;
        }

        if (!isValid) {
             showError("Invalid Emergency Contact", "Mobile (10 digits) or Landline (Start with 0).");
             return; 
        }
    }

    // Capture Fields
    const sourceSelect = document.getElementById('source').value;
    const finalSource = sourceSelect === 'Other' ? document.getElementById('source_other').value : sourceSelect;

    const intentSelect = document.getElementById('intent').value;
    const finalIntent = intentSelect === 'Other' ? document.getElementById('intent_other').value : intentSelect;

    btn.disabled = true;
    btn.innerText = "Saving...";

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
                showError("Registration Exists!", "Student already registered. Please Login or contact Admin.");
            } else if (error.code === '23514') {
                showError("System Rejected Phone", "Phone must be 10 digits.");
            } else {
                showError("System Error", error.message);
            }
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // --- TRIGGER NOTIFICATION (Fixed Logic) ---
        btn.innerText = "Notifying...";
        console.log("Attempting to send email for:", data[0].child_name);

        // We use the EXACT same fetch method that worked in your console test
        const notifyResponse = await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({ record: data[0] }) 
        });

        // Log result for debugging
        if (notifyResponse.ok) {
            console.log("Email Notification Sent Successfully!");
        } else {
            console.error("Email Failed:", await notifyResponse.text());
        }

        // --- SUCCESS ---
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

    } catch (err) {
        console.error("Unexpected Error:", err);
        showError("Unexpected Error", "Something went wrong.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
