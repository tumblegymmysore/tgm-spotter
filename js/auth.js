import { supabaseClient } from './config.js';
import { showErrorModal, showSuccessModal } from './utils.js';

export async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showErrorModal("Input Required", "Please enter both email and password.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login Error:", error);
        showErrorModal("Login Failed", "Invalid email or password.");
    } else {
        document.getElementById('login-modal').classList.add('hidden');
        window.location.reload(); 
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
