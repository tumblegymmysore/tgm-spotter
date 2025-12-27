import { db } from './config.js';
import { showPage } from './utils.js';
// We import these dynamically in main to avoid circular dependencies usually, but here simple imports work if main handles binding
// For this structure, we'll keep auth logic pure.

export let currentUser = null;
export let currentUserName = "Staff";

export async function checkSession(callback) {
    const { data: { session } } = await db.auth.getSession();
    if(session) callback(session.user);
}

export async function handleLogin(callback) {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if(!email || !pass) { alert("Please enter credentials."); return; }
    
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) alert("Login Failed: " + error.message); 
    else { document.getElementById('login-modal').classList.add('hidden'); callback(data.user); }
}

export async function handleMagicLink() {
    const email = document.getElementById('login-email').value;
    if(!email) { alert("Enter email first"); return; }
    const { error } = await db.auth.signInWithOtp({ email: email });
    if (error) alert("Error: " + error.message);
    else alert("✅ Link Sent! Check your email.");
}

export async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}
