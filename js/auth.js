import { db } from './config.js';
import { loadAdminDashboard } from './roles/admin.js';
import { loadTrainerDashboard } from './roles/trainer.js';
import { loadParentData } from './roles/parent.js';
import { showPage } from './utils.js';

export let currentUser = null;
export let currentUserName = "Staff";

export async function checkSession() {
    const { data: { session } } = await db.auth.getSession();
    if(session) handleSessionSuccess(session.user);
}

async function handleSessionSuccess(user) {
    currentUser = user;
    document.getElementById('nav-public').classList.add('hidden');
    document.getElementById('nav-private').classList.remove('hidden');

    const { data } = await db.from('user_roles').select('*').eq('id', user.id).single();
    const role = data ? data.role : 'parent';
    if(data && data.full_name) currentUserName = data.full_name;

    const switcher = document.getElementById('role-switcher');
    if(role === 'admin') {
        switcher.innerHTML = `<option value="admin">Admin</option><option value="parent">Parent View</option>`;
        switcher.classList.remove('hidden');
        loadAdminDashboard();
    } else if(role === 'trainer') {
        loadTrainerDashboard();
    } else {
        loadParentData(user.email);
    }
    document.getElementById('user-role-badge').innerText = role.toUpperCase();
    showPage(role === 'parent' ? 'parent-portal' : role);
}

export async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if(!email || !pass) { alert("Please enter credentials."); return; }
    
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) alert("Login Failed: " + error.message); 
    else { document.getElementById('login-modal').classList.add('hidden'); handleSessionSuccess(data.user); }
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

// SWITCH VIEW HANDLER
export function loadView(role) {
    if(role === 'admin') { showPage('admin'); loadAdminDashboard(); }
    else if(role === 'parent') { showPage('parent-portal'); loadParentData(currentUser.email); }
}
