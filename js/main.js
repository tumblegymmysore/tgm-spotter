// js/main.js

// Initialize Supabase
const supabaseUrl = 'YOUR_SUPABASE_URL_HERE'; // <--- CHECK THIS IS FILLED
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY_HERE'; // <--- CHECK THIS IS FILLED
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --------------------------------------------------------------------------
// MAIN SUBMISSION HANDLER
// --------------------------------------------------------------------------
window.handleIntakeSubmit = async (e) => {
    e.preventDefault(); // Stop page reload
    
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;

    // 1. GET RAW VALUES
    const rawPhone = document.getElementById('phone').value.trim();
    const rawAltPhone = document.getElementById('alt_phone').value.trim();
    const email = document.getElementById('email').value.trim();
    
    // 2. FRONTEND VALIDATION (The "Phone Police")

    // A. Clean the numbers (remove spaces, dashes, +91)
    const cleanPhone = rawPhone.replace(/\D/g, ''); 
    const cleanAltPhone = rawAltPhone.replace(/\D/g, '');

    // Rule: Main Phone must be EXACTLY 10 digits
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        alert("⚠️ Invalid Mobile Number\n\nPlease enter exactly 10 digits (e.g., 9900000000). Do not include +91 or spaces.");
        return; // STOP EXECUTION
    }

    // Rule: Alternate Phone (if typed) must be 10 or 11 digits
    if (rawAltPhone.length > 0) {
        // Allow 10 (Mobile) OR 11 (Landline starting with 0)
        const isMobile = /^[0-9]{10}$/.test(cleanAltPhone);
        const isLandline = cleanAltPhone.startsWith('0') && cleanAltPhone.length === 11;

        if (!isMobile && !isLandline) {
             alert("⚠️ Invalid Alternate Number\n\nMust be 10 digits (Mobile) or 11 digits starting with 0 (Landline).");
             return; // STOP EXECUTION
        }
    }

    // 3. LOCK BUTTON
    btn.disabled = true;
    btn.innerHTML = 'Wait...';

    // 4. PREPARE DATA OBJECT
    const formData = {
        child_name: document.getElementById('k_name').value.trim(),
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value.trim(),
        phone: cleanPhone,       // Send the CLEAN 10-digit version
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
        // 5. SEND TO SUPABASE
        const { data, error } = await supabase
            .from('leads')
            .insert([formData])
            .select();

        // 6. ERROR TRAPPING
        if (error) {
            console.error("Supabase Error:", error);

            // Check for Duplicate (Code 23505)
            if (error.code === '23505' || error.message.includes('unique constraint')) {
                alert("⚠️ Registration Exists!\n\nThis student is already registered.\n\nPlease Login if you are already a member, or contact Admin.");
            } 
            // Check for DB Constraint Violation (Bad Phone that sneaked past JS)
            else if (error.code === '23514' || error.message.includes('check_phone_format')) {
                alert("⚠️ System Rejected Phone Number.\n\nPlease ensure it is exactly 10 digits.");
            }
            else {
                alert("Error: " + error.message);
            }

            // Unlock button so they can fix it
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // 7. SUCCESS
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

    } catch (err) {
        console.error("Unexpected Error:", err);
        alert("Something went wrong. Please try again.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// ... (Rest of your login/logout functions should be here) ...
