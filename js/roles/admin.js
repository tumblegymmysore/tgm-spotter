// js/roles/admin.js
// Fix: Import from config and utils (UP one level)
import { supabaseClient } from '../config.js';
import { showView, showSuccessModal, showToast } from '../utils.js';

// NOTE: We do NOT import currentUser from auth.js anymore. 
// The user name is passed into loadAdminDashboard by main.js.

// --- 1. DASHBOARD LOADER ---
export async function loadAdminDashboard(adminName) {
    showView('trainer'); // Re-using the Trainer/Admin layout (id="trainer")
    
    // Update Header
    const welcomeEl = document.getElementById('trainer-welcome');
    if (welcomeEl) welcomeEl.innerText = `Admin Panel: ${adminName}`;
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Load Data
    await fetchPendingRegistrations();
    // We can also load the inbox if admins chat
    // fetchInbox(); 
}

// --- 2. FETCH PENDING PAYMENTS ---
export async function fetchPendingRegistrations() {
    const listNew = document.getElementById('list-new-trials'); // Re-using the "New" column
    const listDone = document.getElementById('list-completed-trials'); // Re-using the "Done" column
    
    if (!listNew) return;

    // Update Titles for Admin Context
    document.querySelector('#view-dashboard h3').innerText = "Payment Verifications";
    listNew.previousElementSibling.innerText = "Pending Verification";
    listDone.previousElementSibling.innerText = "Recently Enrolled";

    listNew.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Syncing payments...</p>';

    try {
        // Fetch "Registration Requested" (Needs Approval) AND "Enrolled" (History)
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .or('status.eq.Registration Requested,status.eq.Enrolled')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error("Admin Fetch Error:", error);
            listNew.innerHTML = `<div class="p-3 bg-red-50 text-red-600 text-xs rounded">Error: ${error.message}</div>`;
            return;
        }

        listNew.innerHTML = ''; 
        listDone.innerHTML = '';

        if (!data || data.length === 0) { 
            listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending payments.</p>'; 
            return; 
        }

        data.forEach(lead => {
            if (lead.status === 'Registration Requested') {
                listNew.innerHTML += createVerificationCard(lead);
            } else {
                listDone.innerHTML += createEnrolledCard(lead);
            }
        });
        
        if (listNew.innerHTML === '') listNew.innerHTML = '<p class="text-slate-400 text-sm">All payments verified.</p>';

    } catch (err) {
        console.error("Crash:", err);
        listNew.innerHTML = `<p class="text-red-500 text-sm">System Crash</p>`;
    }
}

// --- 3. CARDS ---

function createVerificationCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name}</h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone}</p>
            </div>
            <span class="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded">Action Required</span>
        </div>
        
        <div class="bg-slate-50 p-3 rounded border border-slate-100 text-xs mb-3">
            <p><strong>Package:</strong> ${lead.selected_package}</p>
            <p><strong>Amount:</strong> ₹${lead.package_price}</p>
            <p><strong>Start Date:</strong> ${lead.start_date || 'N/A'}</p>
            <div class="mt-2">
                <a href="${lead.payment_proof_url}" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800">
                    <i class="fas fa-paperclip mr-1"></i> View Payment Screenshot
                </a>
            </div>
        </div>

        <div class="flex gap-2">
            <button onclick="window.approvePayment('${lead.id}')" class="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-700 transition">
                <i class="fas fa-check mr-1"></i> Approve
            </button>
            <button onclick="window.rejectPayment('${lead.id}')" class="flex-1 bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 rounded hover:bg-red-100 transition">
                Reject
            </button>
        </div>
    </div>`;
}

function createEnrolledCard(lead) {
    return `
    <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 border-l-4 border-green-500 opacity-75 mb-3">
        <div class="flex justify-between items-center">
            <div>
                <h4 class="font-bold text-slate-700 text-sm">${lead.child_name}</h4>
                <p class="text-[10px] text-slate-500">${lead.selected_package}</p>
            </div>
            <span class="text-green-700 text-[10px] font-bold uppercase">Active</span>
        </div>
    </div>`;
}

// --- 4. ACTIONS (Exposed to Window in Main.js if needed, or bound here) ---

// We need to export these so main.js can bind them to window
export async function approvePayment(leadId) {
    if(!confirm("Confirm payment verification and enroll student?")) return;

    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({ 
                status: 'Enrolled', 
                payment_status: 'Paid',
                enrollment_date: new Date()
            })
            .eq('id', leadId);

        if (error) throw error;

        showSuccessModal("Student Enrolled!", "Payment verified and status updated.");
        fetchPendingRegistrations(); // Refresh list

    } catch (err) {
        alert("Error: " + err.message);
    }
}

export async function rejectPayment(leadId) {
    const reason = prompt("Enter reason for rejection (e.g., Image unclear):");
    if (!reason) return;

    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({ 
                status: 'Trial Completed', // Revert to previous state
                payment_status: 'Rejected',
                parent_note: `Admin Note: Payment Rejected - ${reason}`
            })
            .eq('id', leadId);

        if (error) throw error;

        showToast("Request Rejected");
        fetchPendingRegistrations();

    } catch (err) {
        alert("Error: " + err.message);
    }
}
