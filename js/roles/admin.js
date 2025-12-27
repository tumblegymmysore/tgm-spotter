import { db } from '../config.js';
import { showToast } from '../utils.js';
import { currentUser } from '../auth.js';

export async function loadAdminDashboard() {
    if(!currentUser) return;
    const { data } = await db.from('leads').select('*').order('created_at', { ascending: false });
    
    document.getElementById('stat-total').innerText = data.length;
    document.getElementById('stat-reqs').innerText = data.filter(l => l.status === 'Registration Requested').length;
    document.getElementById('stat-active').innerText = data.filter(l => l.status === 'Enrolled').length;
    document.getElementById('stat-trials').innerText = data.filter(l => l.status === 'Pending Trial').length;

    const list = document.getElementById('admin-list');
    list.innerHTML = '';
    data.forEach(l => {
        let alert = l.status === 'Registration Requested' ? '<span class="text-red-500 font-bold animate-pulse">!</span>' : '';
        let btnAction = l.status === 'Registration Requested' ? 
            `<button onclick="window.openAdminModal(${l.id})" class="text-white bg-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">Verify</button>` : 
            `<button onclick="window.openAdminModal(${l.id})" class="text-slate-500 border px-3 py-1 rounded text-xs hover:bg-slate-50">View</button>`;
        
        list.innerHTML += `<tr class="border-b hover:bg-slate-50"><td class="p-4 font-bold text-slate-700">${l.child_name} ${alert}</td><td class="p-4 text-sm">${l.parent_name}</td><td class="p-4 text-xs font-bold text-slate-500 uppercase">${l.status}</td><td class="p-4">${btnAction}</td></tr>`;
    });
}

export async function openAdminModal(id) {
    const { data } = await db.from('leads').select('*').eq('id', id).single();
    if(!data) return;

    const content = document.getElementById('admin-modal-body');
    let proofImg = data.payment_proof_url ? `<a href="${data.payment_proof_url}" target="_blank"><img src="${data.payment_proof_url}" class="h-40 w-full object-cover border rounded mt-2 hover:opacity-90"></a>` : '<div class="text-gray-400 text-xs mt-2">No proof uploaded</div>';

    content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-sm mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div><span class="text-xs font-bold text-slate-400 uppercase">Child</span><br><b>${data.child_name}</b></div>
            <div><span class="text-xs font-bold text-slate-400 uppercase">Package</span><br><b>${data.selected_package || '-'}</b></div>
            <div><span class="text-xs font-bold text-slate-400 uppercase">Price</span><br><b>₹${data.package_price || '-'}</b></div>
            <div><span class="text-xs font-bold text-slate-400 uppercase">Start</span><br><b>${data.start_date || '-'}</b></div>
        </div>
        <div class="mb-4">
            <label class="text-xs font-bold uppercase text-slate-500">Payment Proof</label><br>
            ${proofImg}
        </div>
        ${data.status === 'Registration Requested' ? `<button onclick="window.adminApprove(${data.id})" class="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 shadow transition">Approve & Enroll Student</button>` : ''}
    `;
    document.getElementById('admin-modal').classList.remove('hidden');
}

export async function adminApprove(id) {
    if(!confirm("Confirm Payment Verified? This will enroll the student.")) return;
    const { error } = await db.from('leads').update({ status: 'Enrolled', payment_status: 'Paid' }).eq('id', id);
    if(error) alert("Error");
    else { showToast("Student Enrolled!"); document.getElementById('admin-modal').classList.add('hidden'); loadAdminDashboard(); }
}
