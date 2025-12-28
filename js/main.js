import { checkSession, handleLogin, handleMagicLink, handleLogout } from './auth.js';
import { handleIntakeSubmit } from './roles/parent.js';
// Import other role functions if you copied them to roles/ folders
// import { loadTrainerDashboard } from './roles/trainer.js'; 
import { calculateAgeDisplay, checkOther, scrollToSection, showPage } from './utils.js';
import { db } from './config.js';

// 1. ATTACH TO WINDOW (Makes HTML buttons work)
window.handleLogin = () => handleLogin(onSessionSuccess);
window.handleMagicLink = handleMagicLink;
window.handleLogout = handleLogout;

// REPLACE the existing 'window.handleIntakeSubmit' in js/main.js with this:

window.handleIntakeSubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerText;
    
    // 1. GET DATA
    const phone = document.getElementById('phone').value.trim();
    const altPhone = document.getElementById('alt_phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const k_name = document.getElementById('k_name').value.trim();
    const dob = document.getElementById('dob').value;
    
    // 2. FRONTEND VALIDATION (The "Phone Police")
    
    // A. Validate Main Mobile (Strict 10 Digits)
    const cleanPhone = phone.replace(/\D/g, ''); // Remove spaces/dashes
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
        alert("⚠️ Invalid Mobile Number\n\nPlease enter exactly 10 digits (e.g., 9900000000). Do not include +91.");
        return; // Stop here
    }

    // B. Validate Alternate Phone (10 digits OR 11 digits starting with 0)
    // We only check this if the user actually typed something
    if (altPhone) {
        const cleanAlt = altPhone.replace(/\D/g, '');
        const isMobile = /^[0-9]{10}$/.test(cleanAlt);
        const isLandline = cleanAlt.startsWith('0') && cleanAlt.length === 11;

        if (!isMobile && !isLandline) {
            alert("⚠️ Invalid Alternate Number\n\nMust be 10 digits (Mobile) or 11 digits starting with 0 (Landline).");
            return; // Stop here
        }
    }

    // 3. PREPARE SUBMISSION
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending...';

    const formData = {
        child_name: k_name,
        dob: dob,
        gender: document.getElementById('gender').value,
        parent_name: document.getElementById('p_name').value,
        phone: cleanPhone, // Send the clean number
        email: email,
        alternate_phone: altPhone,
        address: document.getElementById('address').value,
        medical_info: document.getElementById('medical').value,
        source: document.getElementById('source').value,
        intent: document.getElementById('intent').value,
        status: 'Pending Trial',
        submitted_at: new Date()
    };

    try {
        // 4. SEND TO DATABASE
        const { data, error } = await supabase
            .from('leads')
            .insert([formData])
            .select();

        // 5. HANDLE DUPLICATE ERROR
        if (error) {
            // Code 23505 = Unique Violation (Duplicate)
            if (error.code === '23505' || error.message.includes('unique constraint')) {
                alert("⚠️ Registration Exists!\n\nThis student is already registered. You cannot take an additional trial.\n\nPlease contact Admin or Login if you are already a member.");
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
            throw error; // Throw other errors to the catch block
        }

        // 6. SUCCESS
        document.getElementById('success-modal').classList.remove('hidden');
        btn.innerText = "Sent!";

        // Trigger Notification (Optional: Your backend does this automatically now)
        // fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', ... )

    } catch (err) {
        console.error('Error:', err);
        alert("Something went wrong. Please try again.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

window.calculateAgeDisplay = calculateAgeDisplay;
window.checkOther = checkOther;
window.scrollToSection = scrollToSection;



// 2. SESSION HANDLER
async function onSessionSuccess(user) {
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');
    
    // Simple Role Router
    const { data } = await db.from('user_roles').select('*').eq('id', user.id).single();
    const role = data ? data.role : 'parent';
    
    document.getElementById('user-role-badge').innerText = role.toUpperCase();
    
    // Dynamic Import based on Role (Performance Optimization)
    if(role === 'admin') {
        const { loadAdminDashboard } = await import('./roles/admin.js');
        window.loadAdminDashboard = loadAdminDashboard; // Make avail to HTML
        showPage('admin'); loadAdminDashboard();
    } else if(role === 'trainer') {
        const { loadTrainerDashboard } = await import('./roles/trainer.js');
        window.loadTrainerDashboard = loadTrainerDashboard;
        showPage('trainer'); loadTrainerDashboard();
    } else {
        const { loadParentData } = await import('./roles/parent.js');
        showPage('parent-portal'); loadParentData(user.email);
    }
}

// 3. START APP
checkSession(onSessionSuccess);
