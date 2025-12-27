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
window.handleIntakeSubmit = handleIntakeSubmit;
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
