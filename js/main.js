// js/main.js (v46 - The Modular Router)

// 1. IMPORTS (Connecting the pieces)
import { supabaseClient } from './config.js';
import { showView, calculateAgeDisplay, checkOther, scrollToSection } from './utils.js';
import * as Auth from './auth.js';
import * as Parent from './parent.js';
import * as Trainer from './trainer.js';

console.log("System Loaded: Modular Router (v46).");

// --- 2. GLOBAL BINDINGS (Making functions available to HTML) ---

// Public Form
window.handleIntakeSubmit = Parent.handleIntakeSubmit;
window.calculateAgeDisplay = calculateAgeDisplay;
window.checkOther = checkOther;
window.scrollToSection = scrollToSection;

// Auth
window.handleLogin = Auth.handleLogin;
window.handleLogout = Auth.handleLogout;
window.handleMagicLink = Auth.handleMagicLink;

// Parent Dashboard
window.openRegistrationModal = Parent.openRegistrationModal;
window.submitRegistration = Parent.submitRegistration;
window.handlePackageChange = Parent.handlePackageChange;
window.openEditModal = Parent.openEditModal;
window.saveChildInfo = Parent.saveChildInfo;
window.openParentChat = Parent.openParentChat;
window.openFeedbackModal = Parent.openFeedbackModal;
window.submitParentFeedback = Parent.submitParentFeedback;

// Trainer Dashboard
window.openAssessment = Trainer.openAssessment;
window.submitAssessment = Trainer.submitAssessment;
window.fetchTrials = Trainer.fetchTrials;
window.fetchInbox = Trainer.fetchInbox;
window.switchTab = Trainer.switchTab;

// --- 3. SHARED CHAT LOGIC (Used by both Parent & Trainer) ---

window.openChat = async (str) => {
    const l = JSON.parse(decodeURIComponent(str));
    
    // UI Setup
    document.getElementById('chat-header-name').innerText = l.parent_name || "Chat";
    document.getElementById('chat-student-name').innerText = l.child_name || "";
    document.getElementById('chat-lead-id').value = l.id;
    document.getElementById('chat-history').innerHTML = '<p class="text-center text-xs text-slate-400 mt-4">Loading messages...</p>';
    document.getElementById('chat-modal').classList.remove('hidden');
    
    // Focus Input for Keyboard (User Request)
    setTimeout(() => document.getElementById('chat-input').focus(), 100);

    await loadMessages(l.id); 
    
    // Mark Read Logic
    const isTrainer = !document.getElementById('trainer').classList.contains('hidden');
    
    if (isTrainer) {
        // Trainer reading Parent message
        await supabaseClient.from('messages')
            .update({ is_read: true })
            .eq('lead_id', l.id)
            .neq('sender_role', 'trainer');
        document.getElementById('inbox-badge')?.classList.add('hidden');
    } else {
        // Parent reading Trainer message
        await supabaseClient.from('messages')
            .update({ is_read: true })
            .eq('lead_id', l.id)
            .eq('sender_role', 'trainer');
    }
};

window.loadMessages = async (leadId) => {
    const container = document.getElementById('chat-history');
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
        
    if (!data) return;
    container.innerHTML = '';
    
    const isTrainer = !document.getElementById('trainer').classList.contains('hidden');
    
    data.forEach(msg => {
        // If I am Trainer, my messages are 'trainer'. If I am Parent, my messages are 'parent'
        const isMe = isTrainer ? (msg.sender_role === 'trainer') : (msg.sender_role !== 'trainer');
        
        container.innerHTML += `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                <div class="${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm">
                    ${msg.message_text}
                </div>
                <span class="text-[9px] text-slate-400 mt-1 px-1">
                    ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
            </div>
        `;
    });
    container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const leadId = document.getElementById('chat-lead-id').value;
    const isTrainer = !document.getElementById('trainer').classList.contains('hidden');
    
    const role = isTrainer ? 'trainer' : 'parent';
    
    // Get Name safely
    let senderName = "User";
    if (document.getElementById('user-role-badge')) {
        senderName = document.getElementById('user-role-badge').innerText;
    }

    // Optimistic UI Update
    const container = document.getElementById('chat-history');
    container.innerHTML += `
        <div class="flex flex-col items-end">
            <div class="bg-blue-600 text-white rounded-br-none px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm opacity-50">
                ${text}
            </div>
        </div>`;
    container.scrollTop = container.scrollHeight;
    input.value = '';

    // Send to DB
    await supabaseClient.from('messages').insert([{ 
        lead_id: leadId, 
        sender_role: role, 
        sender_name: senderName, 
        message_text: text 
    }]);

    await window.loadMessages(leadId);
    if(isTrainer) Trainer.fetchInbox();
};

// --- 4. KEYBOARD SHORTCUTS (User Request) ---
document.addEventListener('keydown', (e) => {
    // Esc to Close Modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    }
});

// Enter to Send Chat
const chatInput = document.getElementById('chat-input');
if(chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') window.sendChatMessage();
    });
}

// --- 5. INITIALIZATION & ROUTING ---
async function initSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            const user = session.user;
            const email = user.email;
            let finalName = email.split('@')[0];
            let finalRole = "";

            // 1. Check Role Table
            const { data: roleData } = await supabaseClient.from('user_roles').select('role, full_name').eq('id', user.id).maybeSingle();
            if (roleData) { 
                finalName = roleData.full_name || finalName; 
                finalRole = roleData.role; 
            }

            // 2. Check Parent Data
            if (!finalRole) {
                const { data: leadData } = await supabaseClient.from('leads').select('parent_name').eq('email', email).limit(1).maybeSingle();
                if (leadData?.parent_name) finalName = leadData.parent_name;
            }

            // Capitalize Name
            finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);

            // Update UI
            document.getElementById('user-role-badge').innerText = finalName;
            document.getElementById('landing').classList.add('hidden');
            document.getElementById('nav-public').classList.add('hidden');
            document.getElementById('nav-private').classList.remove('hidden');
            document.getElementById('nav-private').classList.add('flex');

            // Route
            const trainerEmails = ['tumblegymmysore@gmail.com', 'trainer@tgm.com'];
            if (finalRole === 'trainer' || finalRole === 'admin' || trainerEmails.includes(email) || email.includes('trainer')) {
                Trainer.loadTrainerDashboard(finalName);
            } else {
                Parent.loadParentDashboard(email);
            }
        } else {
            showView('landing');
            document.getElementById('nav-public').classList.remove('hidden');
        }
    } catch (e) { console.error("Init Error:", e); }
}

initSession();
