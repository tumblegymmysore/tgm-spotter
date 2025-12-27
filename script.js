// CONFIGURATION
const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

let db = null;
let currentUser = null;
let currentRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { createClient } = supabase; 
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check if session exists
    const { data: { session } } = await db.auth.getSession();
    if(session) {
        handleSessionSuccess(session.user);
    }
});

// --- AUTH LOGIC ---

function switchAuth(tab) {
    document.getElementById('tab-login').className = tab === 'login' ? 'auth-tab active' : 'auth-tab';
    document.getElementById('tab-signup').className = tab === 'signup' ? 'auth-tab active' : 'auth-tab';
    
    if(tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if(error) {
        document.getElementById('auth-message').innerText = error.message;
    } else {
        handleSessionSuccess(data.user);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const phone = document.getElementById('signup-phone').value;

    // 1. Create Auth User
    const { data, error } = await db.auth.signUp({ email: email, password: pass });
    
    if(error) {
        document.getElementById('auth-message').innerText = error.message;
        return;
    }

    // 2. Assign 'parent' role in database
    if(data.user) {
        const { error: roleError } = await db.from('user_roles').insert([
            { id: data.user.id, role: 'parent', email: email }
        ]);
        
        // 3. Link Phone to this email for lookup later
        // Note: Ideally we store phone in auth metadata, but here we assume user will fill the Intake Form next
        
        alert("Account Created! You are logged in.");
        handleSessionSuccess(data.user);
    }
}

async function handleLogout() {
    await db.auth.signOut();
    window.location.reload();
}

async function resetPassword() {
    const email = prompt("Enter your email to reset password:");
    if(email) {
        const { error } = await db.auth.resetPasswordForEmail(email);
        if(error) alert("Error: " + error.message);
        else alert("Check your email for the reset link!");
    }
}

// --- SESSION HANDLER & ROUTER ---

async function handleSessionSuccess(user) {
    currentUser = user;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');

    // Fetch Role
    const { data } = await db.from('user_roles').select('role').eq('id', user.id).single();
    
    currentRole = data ? data.role : 'parent'; // Default to parent
    document.getElementById('user-role-badge').innerText = currentRole.toUpperCase();

    // Route to correct page
    if(currentRole === 'admin') {
        showPage('admin');
        fetchLeads();
    } else if (currentRole === 'trainer') {
        showPage('trainer');
        loadTrainerDashboard();
    } else {
        // Parent: Check if they have a child connected via email match
        // Note: For V1, we just show the Intake form or Portal
        showPage('parent-portal');
        loadParentData(user.email);
    }
}

// --- APP LOGIC ---

async function loadParentData(email) {
    // Find child based on parent email match
    const { data } = await db.from('leads').select('*').eq('email', email);
    
    const content = document.getElementById('parent-content');
    if(!data || data.length === 0) {
        content.innerHTML = `
            <div class="text-center">
                <p class="mb-4">No student record found linked to this email.</p>
                <button onclick="showPage('landing')" class="bg-blue-600 text-white px-4 py-2 rounded">Register New Student</button>
            </div>`;
    } else {
        let html = '';
        data.forEach(child => {
            html += `<div class="mb-4 border-b pb-4">
                <h3 class="font-bold text-xl">${child.child_name}</h3>
                <p>Status: <span class="font-bold text-blue-600">${child.status}</span></p>
                <p class="text-sm text-gray-500">Batch: ${child.age_group || 'Pending'}</p>
            </div>`;
        });
        content.innerHTML = html;
    }
}

// --- SHARED UI ---
function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}

// --- FORM & TRAINER LOGIC (Simplified for V10) ---
// (Paste your existing handleIntakeSubmit, loadTrainerDashboard, fetchLeads logic here if needed, 
//  but ensure they use the global 'db' variable)
//  ... [Previous V9 Logic for Forms goes here] ...
