// js/main.js

// --------------------------------------------------------------------------
// 1. SETUP SUPABASE
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready.");

// --------------------------------------------------------------------------
// HELPER: Show Custom Error Modal
// --------------------------------------------------------------------------
function showError(title, message) {
    document.getElementById('error-title').innerText = title;
    document.getElementById('error-msg').innerText = message;
    document.getElementById('error-modal').classList.remove('hidden');
}

// --------------------------------------------------------------------------
// 2. MAIN SUBMISSION HANDLER
// --------------------------------------------------------------------------
window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); 
    
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    // --- GET DATA ---
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const email = document.getElementById('email').value.trim();
    
    // --- FRONTEND VALIDATION ---

    // 1. Clean the numbers (remove spaces, dashes)
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // 2. Validate MAIN MOBILE (Strict 10 Digits)
    // Must be exactly 10 digits.
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        showError(
            "Invalid Mobile Number", 
            "Please check the 'Mobile (WhatsApp)' field. It must be exactly 10 digits (e.g., 9900000000)."
        );
        return; 
    }

    // 3. Validate ALTERNATE PHONE (Flexible Landline Logic)
    if (rawAltPhone.length > 0) {
        let isValid = false;

        // Case A: Starts with 0 (Landline) -> Allow 10 to 12 digits total
        if (cleanAltPhone.startsWith('0')) {
             if (cleanAltPhone.length >= 10 && cleanAltPhone.length <= 12) {
                 isValid = true;
             }
        } 
        // Case B: Does NOT start with 0 (Mobile) -> Must be 10 digits
        else if (/^[0-9]{10}$/.test(cleanAltPhone)) {
             isValid = true;
        }

        if (!isValid) {
             showError(
                 "Invalid Emergency Contact", 
                 "The 'Emergency Contact' number seems incorrect. If it is a Landline, ensure it starts with '0' (Std Code)."
             );
             return; 
        }
    }

    // --- LOCK BUTTON ---
    btn.disabled = true;
    btn.innerText = "Sending...";

    // --- PREPARE DATA ---
    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: cleanPhone,      
        email: email,
        alternate_phone: cleanAltPhone,
        address: document.getElementById('address').value,
        medical_info: document.getElementById('medical').value,
        source: document.getElementById('source').value,
        intent: document.getElementById('intent').value,
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    try {
        // --- SEND TO DATABASE ---
        const { data, error } = await supabaseClient
            .from('leads')
            .insert([formData])
            .select();

        // --- HANDLE ERRORS ---
        if (error) {
            console.error("Supabase Error:", error);

            if (error.code === '23505' || error.message.includes('unique constraint')) {
                showError(
                    "Registration Exists", 
                    "This student is already registered with us. You cannot take an additional trial session.\n\nPlease check with Admin, or Login if you are already a member."
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

        // --- SUCCESS ---
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

    } catch (err) {
        console.error("Unexpected Error:", err);
        showError("Unexpected Error", "Something went wrong. Please check your internet connection and try again.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
