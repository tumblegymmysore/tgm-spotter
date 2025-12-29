import { supabaseClient } from './config.js';
import { showErrorModal, showSuccessModal } from './utils.js';

export async function handleLogin() {
    console.log("handleLogin called"); // Debug log
    try {
        const emailEl = document.getElementById('login-email');
        const passwordEl = document.getElementById('login-password');
        
        if (!emailEl || !passwordEl) {
            console.error("Login form elements not found");
            alert("Login form not found. Please refresh the page.");
            return;
        }
        
        const email = emailEl.value.trim();
        const password = passwordEl.value;

        if (!email || !password) {
            showErrorModal("Input Required", "Please enter both email and password.");
            return;
        }

        console.log("Attempting login for:", email);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error("Login Error:", error);
            showErrorModal("Login Failed", error.message || "Invalid email or password.");
        } else {
            console.log("Login successful");
            const modal = document.getElementById('login-modal');
            if (modal) modal.classList.add('hidden');
            window.location.reload(); 
        }
    } catch (err) {
        console.error("Login function error:", err);
        showErrorModal("Login Error", "An unexpected error occurred. Please try again.");
    }
}

export async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

export async function handleMagicLink() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        showErrorModal("Input Required", "Please enter your email address first.");
        return;
    }
    const { error } = await supabaseClient.auth.signInWithOtp({ email: email });
    if (error) showErrorModal("Error", error.message);
    else showSuccessModal("Link Sent", "✅ Magic Link Sent! Check your email.");
}
