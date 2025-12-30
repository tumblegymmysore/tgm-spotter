import { supabaseClient, supabaseKey, ADULT_AGE_THRESHOLD } from '../config.js'; 
import { showView, showSuccessModal, showErrorModal, calculateAge } from '../utils.js';
import { getAllBatches, getEligibleStudents, recordAttendance, getAttendanceSummary } from '../attendance.js';

let currentAssessmentLead = null;

// --- 1. SKELETON ---
function getTrainerSkeleton() {
    return `
    <div class="bg-white p-4 rounded-lg border border-slate-100 animate-pulse mb-3">
        <div class="flex justify-between items-start mb-2">
            <div class="space-y-2 w-2/3">
                <div class="h-5 bg-slate-200 rounded w-1/2"></div>
                <div class="h-4 bg-slate-200 rounded w-1/3"></div>
            </div>
            <div class="h-6 w-16 bg-slate-200 rounded"></div>
        </div>
        <div class="h-10 bg-slate-200 rounded mt-3 w-full"></div>
    </div>`;
}

// --- 2. DASHBOARD ---
export async function loadTrainerDashboard(trainerName) {
    showView('trainer');
    const welcomeEl = document.getElementById('trainer-welcome');
    if (welcomeEl) welcomeEl.innerText = `Welcome back, ${trainerName}!`;
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
    await fetchTrials(); 
    fetchInbox(); 
}

export async function fetchTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');
    if (!listNew) return;

    listNew.innerHTML = getTrainerSkeleton() + getTrainerSkeleton();
    listDone.innerHTML = '<p class="text-xs text-slate-400">Loading history...</p>';

    try {
        const { data, error } = await supabaseClient.from('leads').select('*').order('submitted_at', { ascending: false });
        if (error) throw error;
        
        listNew.innerHTML = ''; listDone.innerHTML = '';
        if (!data || data.length === 0) { listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>'; return; }
        
        data.forEach(lead => {
            const card = createTrialCard(lead);
            if (lead.status === 'Pending Trial') listNew.innerHTML += card;
            else if (lead.status === 'Trial Completed') listDone.innerHTML += card;
        });
        
        if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending requests.</p>';
    } catch (err) { 
        console.error("Crash:", err); 
        listNew.innerHTML = `<p class="text-red-500 text-sm">System Error: ${err.message}</p>`; 
    }
}

function createTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';
    const age = calculateAge(lead.dob);
    const dobDisplay = lead.dob ? new Date(lead.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition mb-3">
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-blue-600 font-bold mt-1"><i class="fas fa-birthday-cake mr-1"></i>DOB: ${dobDisplay} • Age: ${age} Yrs</p>
                <button onclick="window.openChat('${leadString}')" class="mt-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full border border-blue-200 transition flex items-center">
                    <i class="fas fa-comment-dots mr-2"></i> Message Parent
                </button>
            </div>
            <div class="text-right"><span class="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200">${lead.status}</span></div>
        </div>
        ${isPending ? `
            <button onclick="window.openAssessment('${leadString}')" class="mt-3 w-full bg-slate-800 text-white text-xs font-bold py-2 rounded hover:bg-slate-900 transition shadow-lg">Start Assessment</button>
        ` : `
            <div class="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600"><strong>Result:</strong> ${lead.recommended_batch || 'N/A'}</div>
        `}
    </div>`;
}

// --- 3. ASSESSMENT ---
export async function openAssessment(leadString) {
    const lead = JSON.parse(decodeURIComponent(leadString));
    currentAssessmentLead = lead; 
    document.getElementById('assess-lead-id').value = lead.id;
    document.getElementById('assess-child-name').innerText = lead.child_name;
    document.getElementById('assess-feedback').value = '';
    ['listen', 'flex', 'strength', 'balance'].forEach(k => { document.getElementById(`skill-${k}`).checked = false; });
    document.getElementById('assess-pt').checked = false; 
    document.getElementById('assess-special').checked = false; 

    const age = calculateAge(lead.dob);
    let batch = "Toddler (3-5 Yrs)";
    
    if (age >= ADULT_AGE_THRESHOLD) batch = "Adult Fitness"; 
    else if (age >= 8) batch = "Intermediate (8+ Yrs)"; 
    else if (age >= 5) batch = "Beginner (5-8 Yrs)";
    
    document.getElementById('assess-batch').value = batch;
    
    // Load child info and siblings
    const dobDisplay = lead.dob ? new Date(lead.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
    document.getElementById('assess-child-info').innerHTML = `
        <div class="bg-blue-50 p-3 rounded-lg mb-3 border border-blue-200">
            <p class="text-sm font-bold text-blue-900 mb-1">👶 Little Gymnast Info</p>
            <p class="text-xs text-blue-800"><strong>Name:</strong> ${lead.child_name}</p>
            <p class="text-xs text-blue-800"><strong>DOB:</strong> ${dobDisplay}</p>
            <p class="text-xs text-blue-800"><strong>Age:</strong> ${age} Years</p>
        </div>
    `;
    
    // Fetch siblings
    try {
        const { data: siblings } = await supabaseClient
            .from('leads')
            .select('id, child_name, dob, status, recommended_batch')
            .eq('email', lead.email)
            .neq('id', lead.id)
            .in('status', ['Enrolled', 'Trial Completed', 'Registration Requested', 'Ready to Pay']);
        
        if (siblings && siblings.length > 0) {
            const siblingsHtml = siblings.map(s => {
                const sAge = calculateAge(s.dob);
                return `<p class="text-xs text-indigo-800"><strong>${s.child_name}</strong> (${sAge} Yrs) - ${s.recommended_batch || s.status}</p>`;
            }).join('');
            document.getElementById('assess-sibling-info').innerHTML = `
                <div class="bg-indigo-50 p-3 rounded-lg mb-3 border border-indigo-200">
                    <p class="text-sm font-bold text-indigo-900 mb-2">👨‍👩‍👧‍👦 Siblings Already in Class</p>
                    ${siblingsHtml}
                </div>
            `;
        } else {
            document.getElementById('assess-sibling-info').innerHTML = '';
        }
    } catch (e) {
        console.error('Error fetching siblings:', e);
        document.getElementById('assess-sibling-info').innerHTML = '';
    }
    
    document.getElementById('assessment-modal').classList.remove('hidden');
}

export async function submitAssessment() { 
    const btn = document.getElementById('btn-save-assess'); const orgTxt = btn.innerText;
    const feedback = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const pt = document.getElementById('assess-pt').checked;
    const special = document.getElementById('assess-special').checked; 
    
    if (!batch) return showErrorModal("Missing Info", "Please select a Recommended Batch.");
    btn.disabled = true; btn.innerText = "Saving...";

    const skills = {
        listening: document.getElementById('skill-listen').checked,
        flexibility: document.getElementById('skill-flex').checked,
        strength: document.getElementById('skill-strength').checked,
        balance: document.getElementById('skill-balance').checked,
        personal_training: pt, special_needs: special
    };

    try {
        const { error } = await supabaseClient.from('leads').update({ status: 'Trial Completed', feedback: feedback, recommended_batch: batch, skills_rating: skills, special_needs: special }).eq('id', currentAssessmentLead.id);
        if (error) throw error;
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ record: { ...currentAssessmentLead, feedback: feedback, recommended_batch: batch, skills_rating: skills, pt_recommended: pt, special_needs: special, type: 'feedback_email' } }) });
        document.getElementById('assessment-modal').classList.add('hidden');
        showSuccessModal("Assessment Saved!", "Evaluation saved and parent notified via email.");
        fetchTrials(); 
    } catch (e) { console.error(e); showErrorModal("Save Error", e.message); } finally { btn.disabled = false; btn.innerText = orgTxt; }
}

export async function fetchInbox() { /* Same as previous version */ 
    const container = document.getElementById('list-inbox');
    if (!container) return;
    try {
        const { data: messages, error } = await supabaseClient.from('messages').select(`*, leads (id, child_name, parent_name)`).order('created_at', { ascending: false });
        if (error || !messages || messages.length === 0) { container.innerHTML = '<div class="p-8 text-center text-slate-400">No conversations.</div>'; return; }
        const conversations = {}; let globalUnread = 0;
        messages.forEach(msg => {
            if (!msg.leads) return;
            const lid = msg.leads.id;
            if (!conversations[lid]) {
                conversations[lid] = { details: msg.leads, lastMessage: msg, unread: 0, messages: [] };
            }
            conversations[lid].messages.push(msg);
            // Update last message if this is more recent
            if (new Date(msg.created_at) > new Date(conversations[lid].lastMessage.created_at)) {
                conversations[lid].lastMessage = msg;
            }
            if (msg.sender_role !== 'trainer' && !msg.is_read) { conversations[lid].unread++; globalUnread++; }
        });
        
        // Sort conversations: unread first, then by most recent message
        const sortedConversations = Object.values(conversations).sort((a, b) => {
            if (a.unread > 0 && b.unread === 0) return -1;
            if (a.unread === 0 && b.unread > 0) return 1;
            return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
        });
        document.getElementById('inbox-badge')?.classList.toggle('hidden', globalUnread === 0);
        
        // Add filter buttons for read/unread
        const filterContainer = document.getElementById('inbox-filters');
        if (filterContainer) {
            filterContainer.innerHTML = `
                <button onclick="window.filterInbox('all')" id="filter-all" class="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">All</button>
                <button onclick="window.filterInbox('unread')" id="filter-unread" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700">Unread</button>
                <button onclick="window.filterInbox('read')" id="filter-read" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700">Read</button>
            `;
        }
        
        // Store conversations globally for filtering
        window.trainerConversations = sortedConversations;
        window.currentInboxFilter = 'all';
        
        renderInbox(sortedConversations);
    } catch (e) { console.warn("Inbox Error:", e); }
}

// Render inbox with filtering
function renderInbox(conversations) {
    const container = document.getElementById('list-inbox');
    if (!container) return;
    
    const filter = window.currentInboxFilter || 'all';
    const filtered = conversations.filter(conv => {
        if (filter === 'unread') return conv.unread > 0;
        if (filter === 'read') return conv.unread === 0;
        return true;
    });
    
    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400">No conversations found.</div>';
        return;
    }
    
    filtered.forEach(conv => {
        const leadString = encodeURIComponent(JSON.stringify(conv.details));
        const unreadClass = conv.unread > 0 ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-slate-50';
        container.innerHTML += `
            <div onclick="window.openChat('${leadString}')" class="cursor-pointer p-4 border-b border-slate-100 flex justify-between items-center ${unreadClass} transition">
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold mr-3 shrink-0">${conv.details.child_name.charAt(0)}</div>
                    <div class="overflow-hidden">
                        <h4 class="font-bold text-slate-800 text-sm truncate">${conv.details.parent_name}</h4>
                        <p class="text-xs text-slate-500 truncate w-48">${conv.lastMessage.sender_role === 'trainer' ? 'You: ' : ''}${conv.lastMessage.message_text}</p>
                    </div>
                </div>
                ${conv.unread > 0 ? `<span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${conv.unread}</span>` : ''}
            </div>`;
    });
}

// Filter inbox function
window.filterInbox = function(filter) {
    window.currentInboxFilter = filter;
    const conversations = window.trainerConversations || [];
    renderInbox(conversations);
    
    // Update button styles
    document.getElementById('filter-all')?.classList.toggle('bg-blue-600', filter === 'all');
    document.getElementById('filter-all')?.classList.toggle('text-white', filter === 'all');
    document.getElementById('filter-all')?.classList.toggle('bg-slate-200', filter !== 'all');
    document.getElementById('filter-all')?.classList.toggle('text-slate-700', filter !== 'all');
    
    document.getElementById('filter-unread')?.classList.toggle('bg-blue-600', filter === 'unread');
    document.getElementById('filter-unread')?.classList.toggle('text-white', filter === 'unread');
    document.getElementById('filter-unread')?.classList.toggle('bg-slate-200', filter !== 'unread');
    document.getElementById('filter-unread')?.classList.toggle('text-slate-700', filter !== 'unread');
    
    document.getElementById('filter-read')?.classList.toggle('bg-blue-600', filter === 'read');
    document.getElementById('filter-read')?.classList.toggle('text-white', filter === 'read');
    document.getElementById('filter-read')?.classList.toggle('bg-slate-200', filter !== 'read');
    document.getElementById('filter-read')?.classList.toggle('text-slate-700', filter !== 'read');
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-600','border-b-2'); b.classList.add('text-slate-500'); });
    document.getElementById(`tab-btn-${tab}`).classList.add('text-blue-600', 'border-b-2');
    if (tab === 'inbox') fetchInbox();
    if (tab === 'attendance') loadAttendanceView();
}
