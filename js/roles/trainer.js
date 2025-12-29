// js/roles/trainer.js (v59 - Consistent Age Logic)
import { supabaseClient, ADULT_AGE_THRESHOLD } from '../config.js'; // Imported Constant
import { showView, showSuccessModal, calculateAge } from '../utils.js';

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
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
        if (error) { listNew.innerHTML = `<div class="p-3 bg-red-50 text-red-600 text-xs rounded">Access Denied: ${error.message}</div>`; return; }
        
        listNew.innerHTML = ''; listDone.innerHTML = '';
        if (!data || data.length === 0) { listNew.innerHTML = '<p class="text-slate-400 text-sm">No new requests.</p>'; return; }
        
        data.forEach(lead => {
            const card = createTrialCard(lead);
            if (lead.status === 'Pending Trial') listNew.innerHTML += card;
            else if (lead.status === 'Trial Completed') listDone.innerHTML += card;
        });
        
        if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending requests.</p>';
    } catch (err) { console.error("Crash:", err); listNew.innerHTML = `<p class="text-red-500 text-sm">System Crash</p>`; }
}

function createTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    const isPending = lead.status === 'Pending Trial';
    const colorClass = isPending ? 'border-l-4 border-yellow-400' : 'border-l-4 border-green-500 opacity-75';
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border border-slate-200 ${colorClass} hover:shadow-md transition mb-3">
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
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

// --- 3. ASSESSMENT (FIXED AGE LOGIC) ---
export function openAssessment(leadString) {
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
    
    // LOGIC UPDATE: Use Constant (15+)
    if (age >= ADULT_AGE_THRESHOLD) batch = "Adult Fitness"; 
    else if (age >= 8) batch = "Intermediate (8+ Yrs)"; 
    else if (age >= 5) batch = "Beginner (5-8 Yrs)";
    
    document.getElementById('assess-batch').value = batch;
    document.getElementById('assessment-modal').classList.remove('hidden');
}

// ... (Keep existing submitAssessment, fetchInbox, switchTab) ...
export async function submitAssessment() { 
    const btn = document.getElementById('btn-save-assess'); const orgTxt = btn.innerText;
    const feedback = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const pt = document.getElementById('assess-pt').checked;
    const special = document.getElementById('assess-special').checked; 
    
    if (!batch) return alert("Please select a Recommended Batch.");
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
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseClient.supabaseKey}` }, body: JSON.stringify({ record: { ...currentAssessmentLead, feedback: feedback, recommended_batch: batch, skills_rating: skills, pt_recommended: pt, special_needs: special, type: 'feedback_email' } }) });
        document.getElementById('assessment-modal').classList.add('hidden');
        showSuccessModal("Assessment Saved!", "Evaluation saved and parent notified via email.");
        fetchTrials(); 
    } catch (e) { console.error(e); alert("Error saving assessment."); } finally { btn.disabled = false; btn.innerText = orgTxt; }
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
            if (!conversations[lid]) conversations[lid] = { details: msg.leads, lastMessage: msg, unread: 0 };
            if (msg.sender_role !== 'trainer' && !msg.is_read) { conversations[lid].unread++; globalUnread++; }
        });
        document.getElementById('inbox-badge')?.classList.toggle('hidden', globalUnread === 0);
        container.innerHTML = '';
        Object.values(conversations).forEach(conv => {
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
    } catch (e) { console.warn("Inbox Error:", e); }
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-600','border-b-2'); b.classList.add('text-slate-500'); });
    document.getElementById(`tab-btn-${tab}`).classList.add('text-blue-600', 'border-b-2');
    if (tab === 'inbox') fetchInbox();
}
