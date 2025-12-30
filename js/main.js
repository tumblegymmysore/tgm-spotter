// js/main.js (v50 - Fixed Utils + Admin Support)
import { supabaseClient } from './config.js';
import { showView, calculateAgeDisplay, checkOther, scrollToSection, showErrorModal } from './utils.js';
import * as Auth from './auth.js';

// ROLES IMPORTS
import * as Parent from './roles/parent.js';
import * as Trainer from './roles/trainer.js';
// Add Admin Import (If file exists, this works. If empty, ensure it has exports)
import * as Admin from './roles/admin.js'; 

console.log("System Loaded: Modular Router (v50).");

// --- GLOBAL BINDINGS ---
// Public
window.handleIntakeSubmit = Parent.handleIntakeSubmit;
window.calculateAgeDisplay = calculateAgeDisplay;
window.checkOther = checkOther;
window.scrollToSection = scrollToSection;

// Auth - Ensure functions are available immediately
// Use try-catch to handle any import errors gracefully
try {
    window.handleLogin = Auth.handleLogin;
    window.handleLogout = Auth.handleLogout;
    window.handleMagicLink = Auth.handleMagicLink;
    
    // Debug: Verify functions are bound
    console.log("Auth functions bound:", {
        handleLogin: typeof window.handleLogin,
        handleLogout: typeof window.handleLogout,
        handleMagicLink: typeof window.handleMagicLink
    });
    
    // Ensure functions are available even if module loading is delayed
    if (typeof window.handleLogin !== 'function') {
        console.error("handleLogin not properly bound!");
    }
} catch (err) {
    console.error("Error binding auth functions:", err);
    // Fallback: define stub functions
    window.handleLogin = function() {
        alert("Login function not loaded. Please refresh the page.");
        console.error("handleLogin not available");
    };
    window.handleLogout = function() {
        alert("Logout function not loaded. Please refresh the page.");
    };
    window.handleMagicLink = function() {
        alert("Magic link function not loaded. Please refresh the page.");
    };
}

// Parent
window.openRegistrationModal = Parent.openRegistrationModal;
window.submitRegistration = Parent.submitRegistration;
window.handlePackageChange = Parent.handlePackageChange;
window.openEditModal = Parent.openEditModal;
window.saveChildInfo = Parent.saveChildInfo;
window.openParentChat = Parent.openParentChat;
window.openFeedbackModal = Parent.openFeedbackModal;
window.submitParentFeedback = Parent.submitParentFeedback;

// Trainer
window.openAssessment = Trainer.openAssessment;
window.submitAssessment = Trainer.submitAssessment;
window.fetchTrials = Trainer.fetchTrials;
window.fetchInbox = Trainer.fetchInbox;
window.switchTab = Trainer.switchTab;

// Admin (Bind specific admin functions if you have them, e.g. window.loadAdminStats = Admin.loadStats)
window.approvePayment = Admin.approvePayment;
window.rejectPayment = Admin.rejectPayment;
window.fetchPendingRegistrations = Admin.fetchPendingRegistrations;
window.modifyAdminPackage = Admin.modifyAdminPackage;
window.updateAdminPackageOptions = Admin.updateAdminPackageOptions;
window.calculateAdminPackageTotal = Admin.calculateAdminPackageTotal;
window.saveAdminPackage = Admin.saveAdminPackage;
window.fetchAdminTrials = Admin.fetchAdminTrials;
window.openAdminAssessment = Admin.openAdminAssessment;
window.editAdminAssessment = Admin.editAdminAssessment;
window.saveAdminAssessment = Admin.saveAdminAssessment;
window.saveAdminAssessmentEdit = Admin.saveAdminAssessmentEdit;
window.fetchDeclinedRegistrations = Admin.fetchDeclinedRegistrations;
window.fetchAllStudents = Admin.fetchAllStudents;
window.editFollowUp = Admin.editFollowUp;
window.saveFollowUp = Admin.saveFollowUp;
window.editAdminForm = Admin.editAdminForm;
window.saveAdminFormEdit = Admin.saveAdminFormEdit;
window.openAdminFilters = Admin.openAdminFilters;
window.openAdminEmailTemplates = Admin.openAdminEmailTemplates;
window.openAdminSettings = Admin.openAdminSettings;
// Toggle parent info section
window.toggleParentInfo = function() {
    const content = document.getElementById('parent-info-content');
    const icon = document.getElementById('parent-info-icon');
    if (content && icon) {
        content.classList.toggle('hidden');
        icon.classList.toggle('rotate-180');
    }
};

window.togglePTValidityInput = function() {
    const validityType = document.getElementById('admin-pkg-pt-validity-type').value;
    const validityDateInput = document.getElementById('admin-pkg-pt-validity-date');
    if (validityType === 'specific') {
        validityDateInput.classList.remove('hidden');
        validityDateInput.required = true;
    } else {
        validityDateInput.classList.add('hidden');
        validityDateInput.required = false;
    }
};

// Add/Ensure these are in js/main.js
window.updatePackageOptions = Parent.updatePackageOptions;
window.checkApprovalRequirement = Parent.checkApprovalRequirement;
window.calculateTotal = Parent.calculateTotal;

// --- SHARED CHAT LOGIC ---
window.openChat = async (str) => {
    const l = JSON.parse(decodeURIComponent(str));
    document.getElementById('chat-header-name').innerText = l.parent_name || "Chat";
    document.getElementById('chat-student-name').innerText = l.child_name || "";
    document.getElementById('chat-lead-id').value = l.id;
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading messages...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-input').focus(), 100);

    await loadMessages(l.id); 
    
    // Mark Read Logic and update placeholder
    const isParent = !document.getElementById('parent-portal').classList.contains('hidden');
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.placeholder = isParent ? "Type a message to coach..." : "Type a message to parent...";
    }
    
    if (isParent) {
        // Parent reading Trainer msg
        await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', l.id).eq('sender_role', 'trainer');
    } else {
        // Staff reading Parent msg
        await supabaseClient.from('messages').update({ is_read: true }).eq('lead_id', l.id).neq('sender_role', 'trainer');
        document.getElementById('inbox-badge')?.classList.add('hidden');
    }
};

window.loadMessages = async (leadId) => {
    const container = document.getElementById('chat-history');
    const { data } = await supabaseClient.from('messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true });
    if (!data) return;
    container.innerHTML = '';
    
    // Determine "Me" based on view
    const isParent = !document.getElementById('parent-portal').classList.contains('hidden');
    
    data.forEach(msg => {
        // If I am Parent, 'parent' is Me. If I am Staff, 'trainer' is Me.
        const isMe = isParent ? (msg.sender_role !== 'trainer') : (msg.sender_role === 'trainer');
        
        // XSS-safe: Create elements instead of innerHTML
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
        
        const bubble = document.createElement('div');
        bubble.className = `${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm`;
        bubble.textContent = msg.message_text || '';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'text-[9px] text-slate-400 mt-1 px-1';
        timeSpan.textContent = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        msgDiv.appendChild(bubble);
        msgDiv.appendChild(timeSpan);
        container.appendChild(msgDiv);
    });
    container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const leadId = document.getElementById('chat-lead-id').value;
    const isParent = !document.getElementById('parent-portal').classList.contains('hidden');
    
    const role = isParent ? 'parent' : 'trainer'; // Admin also uses 'trainer' role for chat usually
    const senderName = document.getElementById('user-role-badge') ? document.getElementById('user-role-badge').innerText : "User";

    const container = document.getElementById('chat-history');
    // XSS-safe: Create elements instead of innerHTML
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex flex-col items-end';
    const bubble = document.createElement('div');
    bubble.className = 'bg-blue-600 text-white rounded-br-none px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm opacity-50';
    bubble.textContent = text;
    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    input.value = '';

    await supabaseClient.from('messages').insert([{ lead_id: leadId, sender_role: role, sender_name: senderName, message_text: text }]);
    await window.loadMessages(leadId);
    
    // Refresh Inbox if Trainer/Admin
    if(!isParent) Trainer.fetchInbox();
};

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden')); });
document.getElementById('chat-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.sendChatMessage(); });

// Ensure login functions are always available - add event listeners immediately
function setupLoginButtons() {
    const loginBtn = document.getElementById('btn-login-password');
    if (loginBtn) {
        // Remove any existing listeners and add new one
        const newLoginBtn = loginBtn.cloneNode(true);
        loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);
        
        newLoginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Login button clicked");
            
            if (typeof window.handleLogin === 'function') {
                await window.handleLogin();
            } else {
                console.error("window.handleLogin is not a function:", typeof window.handleLogin);
                showErrorModal("Login Error", "Login function not available. Please refresh the page.");
            }
            return false;
        });
    }
    
    const magicLinkBtn = document.getElementById('btn-login-magic');
    if (magicLinkBtn) {
        const newMagicBtn = magicLinkBtn.cloneNode(true);
        magicLinkBtn.parentNode.replaceChild(newMagicBtn, magicLinkBtn);
        
        newMagicBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.handleMagicLink === 'function') {
                await window.handleMagicLink();
            } else {
                console.error("window.handleMagicLink is not a function");
                showErrorModal("Error", "Magic link function not available. Please refresh the page.");
            }
            return false;
        });
    }
}

// Setup buttons when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLoginButtons);
} else {
    setupLoginButtons();
}

// Also setup after a short delay to catch dynamically loaded modals
setTimeout(setupLoginButtons, 500);

// --- INITIALIZATION ---
async function initSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error("Session error:", error);
            showView('landing');
            return;
        }
        
        if (session) {
            const user = session.user;
            let finalName = user.email.split('@')[0];
            let finalRole = "";

            const { data: roleData } = await supabaseClient.from('user_roles').select('role, full_name').eq('id', user.id).maybeSingle();
            if (roleData) { finalName = roleData.full_name || finalName; finalRole = roleData.role; }

            if (!roleData) {
                const { data: leadData } = await supabaseClient.from('leads').select('parent_name').eq('email', user.email).limit(1).maybeSingle();
                if (leadData?.parent_name) finalName = leadData.parent_name;
            }

            finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
            document.getElementById('user-role-badge').innerText = finalName;
            document.getElementById('landing').classList.add('hidden');
            document.getElementById('nav-public').classList.add('hidden');
            document.getElementById('nav-private').classList.remove('hidden');
            document.getElementById('nav-private').classList.add('flex');

            const trainerEmails = ['tumblegymmysore@gmail.com', 'trainer@tgm.com'];
            
            // --- ROUTING LOGIC ---
            if (finalRole === 'admin') {
                // If admin.js has a load function, use it. Otherwise fallback to Trainer view.
                if (Admin && Admin.loadAdminDashboard) {
                    Admin.loadAdminDashboard(finalName);
                } else {
                    Trainer.loadTrainerDashboard(finalName); // Fallback
                }
            } else if (finalRole === 'trainer' || trainerEmails.includes(user.email) || user.email.includes('trainer')) {
                Trainer.loadTrainerDashboard(finalName);
            } else {
                Parent.loadParentDashboard(user.email);
            }
        } else {
            showView('landing');
            document.getElementById('nav-public').classList.remove('hidden');
        }
    } catch (err) {
        console.error("Initialization error:", err);
        showView('landing');
        document.getElementById('nav-public').classList.remove('hidden');
    }
}
initSession();
