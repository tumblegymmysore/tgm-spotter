// js/auth.js
import { supabaseClient } from './config.js';

// 1. Handle Login (Email & Password)
export async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert("Login Failed: " + error.message);
    } else {
        // Hide modal and reload to let main.js handle routing
        document.getElementById('login-modal').classList.add('hidden');
        window.location.reload(); 
    }
}

// 2. Handle Magic Link (Passwordless)
export async function handleMagicLink() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        alert("Please enter your email address first.");
        return;
    }

    const { error } = await supabaseClient.auth.signInWithOtp({ email: email });

    if (error) {
        alert("Error sending link: " + error.message);
    } else {
        alert("✅ Magic Link Sent! Please check your email inbox.");
    }
}

// 3. Handle Logout
export async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload(); // Reloads to show Landing Page
}
