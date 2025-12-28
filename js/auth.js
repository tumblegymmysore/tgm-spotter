// js/auth.js (v47 - Debug Enabled)
import { supabaseClient } from './config.js';

export async function handleLogin() {
    console.log("Login Button Clicked"); // DEBUG

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    console.log("Sending request to Supabase...");
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login Error:", error);
        alert("Login Failed: " + error.message);
    } else {
        console.log("Login Success:", data);
        document.getElementById('login-modal').classList.add('hidden');
        window.location.reload(); 
    }
}

export async function handleLogout() {
    console.log("Logging Out...");
    await supabaseClient.auth.signOut();
    window.location.reload();
}

export async function handleMagicLink() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        alert("Please enter your email address first.");
        return;
    }
    const { error } = await supabaseClient.auth.signInWithOtp({ email: email });
    if (error) alert("Error: " + error.message);
    else alert("✅ Magic Link Sent! Check your email.");
}
