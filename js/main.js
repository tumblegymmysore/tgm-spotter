// js/main.js

// --------------------------------------------------------------------------
// 1. SETUP SUPABASE
// --------------------------------------------------------------------------
const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// FIX: We name this 'supabaseClient' (not 'supabase') to avoid the name collision
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("System Loaded: Ready.");

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

    // 2. Check Main Phone (Strict 10 Digits)
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        alert("⚠️ Invalid Mobile Number\n\nPlease enter exactly 10 digits (e.g., 9900000000). Do not include +91.");
        return; 
    }

    // 3. Check Alternate Phone (If entered)
    if (rawAltPhone.length > 0) {
        const isMobile = /^[0-9]{10}$/.test(cleanAltPhone);
        const isLandline = cleanAltPhone.startsWith('0') && cleanAltPhone.length === 11;

        if (!isMobile && !isLandline) {
             alert("⚠️ Invalid Alternate Number\n\nMust be 10 digits (Mobile) or 11 digits starting with 0 (Landline).");
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
        // We use 'supabaseClient' here
        const { data, error } = await supabaseClient
            .from('leads')
            .insert([formData])
            .select();

        // --- HANDLE ERRORS ---
        if (error) {
            console.error("Supabase Error:", error);

            if (error.code === '23505' || error.message.includes('unique constraint')) {
                alert("⚠️ Registration Exists!\n\nThis student is already registered. Please Login or contact Admin.");
            } 
            else if (error.code === '23514' || error.message.includes('check_phone_format')) {
                alert("⚠️ System Rejected Phone Number.\n\nPlease ensure it is exactly 10 digits.");
            }
            else {
                alert("Error: " + error.message);
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
        alert("Something went wrong. Please try again.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
