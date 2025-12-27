import { db } from '../config.js';
import { showToast, getAge } from '../utils.js';
import { currentUser, currentUserName } from '../auth.js';

let currentTrialId = null;

export async function loadTrainerDashboard() {
    if(!currentUser) return;
    const list = document.getElementById('trial-list');
    list.innerHTML = '<div class="text-center p-4">Loading...</div>';
    
    const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const { data } = await db.from('leads').select('*')
        .or(`status.eq.Pending Trial,and(status.eq.Trial Completed,trial_completed_at.gt.${yesterday})`)
        .order('created_at', {ascending: true});

    list.innerHTML = '';
    if(!data || data.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 p-4">No active trials</div>'; return; }
    
    data.forEach(l => {
        const isDone = l.status === 'Trial Completed';
        const badge = isDone ? `<span class="bg-green-100 text-green-700 px-2 text-xs rounded font-bold">Done</span>` : `<span class="bg-yellow-100 text-yellow-700 px-2 text-xs rounded font-bold">Pending</span>`;
        
        list.innerHTML += `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center mb-3">
            <div>
                <div class="font-bold text-slate-800 text-lg">${l.child_name}</div> 
                <div class="text-xs text-slate-500 font-bold uppercase">${getAge(l.dob)} Years • ${l.intent}</div>
                <div class="mt-1">${badge}</div>
            </div>
            <button onclick="window.openTrialModal(${l.id}, '${l.child_name}', ${getAge(l.dob)}, '${l.status}', '${l.trainer_feedback||''}', '${l.recommended_batch||''}')" 
                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition">Assess</button>
        </div>`;
    });
}

export function openTrialModal(id, name, age, status, feedback, batch) {
    currentTrialId = id;
    document.getElementById('modal-child-name').innerText = `${name} (${age} Yrs)`;
    document.getElementById('trainer-feedback').value = feedback;
    
    let rec = batch;
    if(!rec) {
        if(age < 5) rec = '3-5 Yrs'; else if(age < 8) rec = '5-8 Yrs'; else if(age < 18) rec = '8+ Yrs'; else rec = 'Adult';
    }
    document.getElementById('trainer-batch').value = rec;
    
    const isReadOnly = status === 'Trial Completed';
    document.getElementById('btn-save-trial').classList.toggle('hidden', isReadOnly);
    document.getElementById('btn-edit-trial').classList.toggle('hidden', !isReadOnly);
    document.getElementById('trainer-feedback').disabled = isReadOnly;
    document.getElementById('trainer-batch').disabled = isReadOnly;

    document.getElementById('trial-modal').classList.remove('hidden');
}

export function enableTrialEdit() {
    document.getElementById('trainer-feedback').disabled = false;
    document.getElementById('trainer-batch').disabled = false;
    document.getElementById('btn-save-trial').classList.remove('hidden');
    document.getElementById('btn-edit-trial').classList.add('hidden');
}

export async function submitTrialResult() {
    const feedback = document.getElementById('trainer-feedback').value;
    const batch = document.getElementById('trainer-batch').value;
    if(!feedback) { alert("Feedback required"); return; }

    const { error } = await db.from('leads').update({
        status: 'Trial Completed', trial_completed_at: new Date(),
        trainer_feedback: feedback, recommended_batch: batch,
        trainer_name: currentUserName, age_group: batch 
    }).eq('id', currentTrialId);

    if(error) alert("Error: " + error.message); 
    else { showToast("Saved Successfully"); document.getElementById('trial-modal').classList.add('hidden'); loadTrainerDashboard(); }
}
