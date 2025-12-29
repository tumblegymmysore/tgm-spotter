// js/roles/admin.js
import { supabaseClient, supabaseKey } from '../config.js';
import { showView, showSuccessModal, showToast, showErrorModal } from '../utils.js';
import { STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, REGISTRATION_FEE, ADULT_AGE_THRESHOLD } from '../config.js';
import { calculateAge } from '../utils.js';

// --- 1. DASHBOARD LOADER ---
export async function loadAdminDashboard(adminName) {
    showView('trainer'); // Re-using the Trainer layout structure
    
    // Update Header - Change title to Admin Dashboard
    const titleEl = document.querySelector('#trainer h1');
    if (titleEl) titleEl.innerText = 'Admin Dashboard';
    
    const welcomeEl = document.getElementById('trainer-welcome');
    if (welcomeEl) welcomeEl.innerText = `Admin Panel: ${adminName}`;
    
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

    // Update tab labels for admin context
    updateAdminTabs();
    
    // Override switchTab for admin context
    window.switchTab = function(tab) {
        document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
        document.getElementById(`view-${tab}`).classList.remove('hidden');
        document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-600','border-b-2'); b.classList.add('text-slate-500'); });
        document.getElementById(`tab-btn-${tab}`).classList.add('text-blue-600', 'border-b-2');
        
        // Load appropriate data based on tab
        if (tab === 'trials') {
            fetchAdminTrials();
        } else if (tab === 'inbox') {
            fetchPendingRegistrations();
        } else if (tab === 'batches') {
            fetchDeclinedRegistrations();
        } else if (tab === 'attendance') {
            fetchAllStudents();
        }
    };
    
    // Load Data - Start with pending trials
    await fetchAdminTrials();
}

// --- 2. ADMIN TABS UPDATE ---
function updateAdminTabs() {
    const trialsTab = document.getElementById('tab-btn-trials');
    const inboxTab = document.getElementById('tab-btn-inbox');
    const batchesTab = document.getElementById('tab-btn-batches');
    const attendanceTab = document.getElementById('tab-btn-attendance');
    
    if (trialsTab) {
        trialsTab.innerHTML = '<i class="fas fa-clipboard-list mr-2"></i>Pending Trials';
        trialsTab.onclick = () => { window.switchTab('trials'); fetchAdminTrials(); };
    }
    if (inboxTab) {
        inboxTab.innerHTML = '<i class="fas fa-file-invoice-dollar mr-2"></i>Registrations';
        inboxTab.onclick = () => { window.switchTab('inbox'); fetchPendingRegistrations(); };
    }
    if (batchesTab) {
        batchesTab.innerHTML = '<i class="fas fa-user-times mr-2"></i>Declined/Follow-ups';
        batchesTab.onclick = () => { window.switchTab('batches'); fetchDeclinedRegistrations(); };
    }
    if (attendanceTab) {
        attendanceTab.innerHTML = '<i class="fas fa-users mr-2"></i>All Students';
        attendanceTab.onclick = () => { window.switchTab('attendance'); fetchAllStudents(); };
    }
}

// --- 2A. FETCH ADMIN TRIALS (Pending Trials) ---
export async function fetchAdminTrials() {
    const listNew = document.getElementById('list-new-trials');
    const listDone = document.getElementById('list-completed-trials');
    
    if (!listNew) return;
    
    // Update titles
    const newRequestsTitle = listNew.previousElementSibling;
    if (newRequestsTitle) newRequestsTitle.innerHTML = '<i class="fas fa-star text-yellow-400 mr-2"></i> Pending Trials';
    const completedTitle = listDone.previousElementSibling;
    if (completedTitle) completedTitle.innerHTML = '<i class="fas fa-check-double mr-2"></i> Completed Trials';
    
    listNew.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading trials...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .in('status', ['Pending Trial', 'Trial Completed'])
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        listNew.innerHTML = '';
        listDone.innerHTML = '';
        
        if (!data || data.length === 0) {
            listNew.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No pending trials.</p>';
            return;
        }
        
        data.forEach(lead => {
            if (lead.status === 'Pending Trial') {
                listNew.innerHTML += createAdminTrialCard(lead);
            } else if (lead.status === 'Trial Completed') {
                listDone.innerHTML += createAdminCompletedTrialCard(lead);
            }
        });
        
        if (listNew.innerHTML === '') {
            listNew.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">All trials completed! 🎉</p>';
        }
        
    } catch (err) {
        console.error("Admin Trials Error:", err);
        listNew.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
    }
}

function createAdminTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border-l-4 border-yellow-400 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span></h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone || 'N/A'}</p>
            </div>
            <span class="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded">Pending</span>
        </div>
        ${lead.trial_scheduled_slot ? `
            <div class="bg-blue-50 p-2 rounded text-xs mb-2">
                <strong>Trial Slot:</strong> ${lead.trial_scheduled_slot}
            </div>
        ` : ''}
        <div class="flex gap-2">
            <button onclick="window.openAdminAssessment('${leadString}')" class="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition">
                <i class="fas fa-clipboard-check mr-1"></i> Assess
            </button>
            <button onclick="window.openChat('${leadString}')" class="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded hover:bg-slate-700 transition">
                <i class="fas fa-comment mr-1"></i> Message
            </button>
        </div>
    </div>`;
}

function createAdminCompletedTrialCard(lead) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name}</h4>
                <p class="text-xs text-slate-500">${lead.parent_name}</p>
            </div>
            <span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">Completed</span>
        </div>
        <div class="bg-slate-50 p-2 rounded text-xs mb-2">
            <strong>Batch:</strong> ${lead.recommended_batch || 'N/A'}<br>
            ${lead.feedback ? `<strong>Feedback:</strong> ${lead.feedback.substring(0, 50)}...` : ''}
        </div>
        <div class="flex gap-2">
            <button onclick="window.editAdminAssessment('${leadString}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                <i class="fas fa-edit mr-1"></i> Edit Assessment
            </button>
            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700 transition">
                <i class="fas fa-cog mr-1"></i> Set Package
            </button>
        </div>
    </div>`;
}

// --- 2. FETCH PENDING PAYMENTS ---
export async function fetchPendingRegistrations() {
    const listNew = document.getElementById('list-new-trials'); 
    const listDone = document.getElementById('list-completed-trials');
    
    if (!listNew) return;

    // Update Titles for Admin Context
    const newRequestsTitle = listNew.previousElementSibling;
    if (newRequestsTitle) newRequestsTitle.innerHTML = '<i class="fas fa-star text-yellow-400 mr-2"></i> Pending Registrations';
    
    const completedTitle = listDone.previousElementSibling;
    if (completedTitle) completedTitle.innerHTML = '<i class="fas fa-check-double mr-2"></i> Recently Enrolled';

    listNew.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading registrations...</p>';

    try {
        // First, let's get ALL leads to see what statuses exist (for debugging)
        const { data: allData, error: allError } = await supabaseClient
            .from('leads')
            .select('id, child_name, status')
            .order('created_at', { ascending: false })
            .limit(100);
        
        console.log('All leads statuses:', allData?.map(l => ({ name: l.child_name, status: l.status })));
        
        // Fetch all leads that need admin attention or are enrolled
        // Include: Registration Requested, Enrollment Requested, Ready to Pay, and Enrolled
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .in('status', ['Registration Requested', 'Enrollment Requested', 'Ready to Pay', 'Enrolled', 'Trial Completed'])
            .order('created_at', { ascending: false })
            .limit(50);
        
        console.log('Filtered leads:', data?.length, 'Statuses found:', [...new Set(data?.map(l => l.status))]);

        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        console.log('Fetched leads:', data?.length || 0);

        listNew.innerHTML = ''; 
        listDone.innerHTML = '';

        if (!data || data.length === 0) { 
            listNew.innerHTML = '<p class="text-slate-400 text-sm">No pending payments.</p>'; 
            return; 
        }

        let pendingCount = 0;
        let enrolledCount = 0;
        
        data.forEach(lead => {
            if (lead.status === 'Registration Requested' || lead.status === 'Enrollment Requested' || lead.status === 'Ready to Pay' || lead.status === 'Trial Completed') {
                listNew.innerHTML += createVerificationCard(lead);
                pendingCount++;
            } else if (lead.status === 'Enrolled') {
                listDone.innerHTML += createEnrolledCard(lead);
                enrolledCount++;
            }
        });
        
        if (pendingCount === 0) {
            listNew.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No pending registrations. All clear! 🎉</p>';
        }
        
        if (enrolledCount === 0) {
            listDone.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No enrolled students yet.</p>';
        }

    } catch (err) {
        console.error("Admin Fetch Error:", err);
        listNew.innerHTML = `<p class="text-red-500 text-sm">System Error: ${err.message}</p>`;
    }
}

// --- 3. CARDS ---

function createVerificationCard(lead) {
    const statusColors = {
        'Trial Completed': 'bg-blue-100 text-blue-700',
        'Enrollment Requested': 'bg-orange-100 text-orange-700',
        'Registration Requested': 'bg-purple-100 text-purple-700',
        'Ready to Pay': 'bg-green-100 text-green-700'
    };
    const statusColor = statusColors[lead.status] || 'bg-purple-100 text-purple-700';
    
    const hasPackage = lead.selected_package || lead.final_price;
    const showPaymentActions = lead.status === 'Registration Requested' && lead.payment_proof_url;
    
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name}</h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone || 'N/A'}</p>
            </div>
            <span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded">${lead.status || 'Pending'}</span>
        </div>
        
        <div class="bg-slate-50 p-3 rounded border border-slate-100 text-xs mb-3">
            <p><strong>Status:</strong> ${lead.status || 'N/A'}</p>
            ${hasPackage ? `
                <p><strong>Package:</strong> ${lead.selected_package || lead.recommended_batch || 'Not Set'}</p>
                <p><strong>Amount:</strong> ₹${lead.final_price || lead.package_price || '0'}</p>
            ` : `
                <p><strong>Recommended Batch:</strong> ${lead.recommended_batch || 'Not Set'}</p>
                <p class="text-orange-600"><strong>Action:</strong> Set package and pricing</p>
            `}
            ${lead.start_date ? `<p><strong>Start Date:</strong> ${lead.start_date}</p>` : ''}
            ${lead.payment_proof_url ? `
                <div class="mt-2">
                    <a href="${lead.payment_proof_url}" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800">
                        <i class="fas fa-paperclip mr-1"></i> View Payment Screenshot
                    </a>
                </div>
            ` : ''}
        </div>

        <div class="flex gap-2 mb-2">
            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                <i class="fas fa-cog mr-1"></i> ${hasPackage ? 'Modify Package' : 'Set Package'}
            </button>
        </div>
        ${showPaymentActions ? `
        <div class="flex gap-2">
            <button onclick="window.approvePayment('${lead.id}')" class="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-700 transition">
                <i class="fas fa-check mr-1"></i> Approve Payment
            </button>
            <button onclick="window.rejectPayment('${lead.id}')" class="flex-1 bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 rounded hover:bg-red-100 transition">
                Reject
            </button>
        </div>
        ` : ''}
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

// --- 4. ACTIONS ---

export async function approvePayment(leadId) {
    // Use a more user-friendly confirmation approach
    const confirmed = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Confirm Enrollment</h3>
                <p class="mb-6">Are you sure you want to verify payment and enroll this student?</p>
                <div class="flex gap-3">
                    <button onclick="this.closest('.modal-overlay').remove(); window.__adminConfirmResolve(true)" class="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg">Yes, Enroll</button>
                    <button onclick="this.closest('.modal-overlay').remove(); window.__adminConfirmResolve(false)" class="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        window.__adminConfirmResolve = resolve;
    });
    
    if (!confirmed) return;

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
        fetchPendingRegistrations(); 

    } catch (err) {
        showErrorModal("Approval Failed", err.message);
    }
}

export async function rejectPayment(leadId) {
    // Create a better rejection modal
    const reason = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Reject Payment</h3>
                <label class="block text-sm font-bold text-slate-700 mb-2">Reason for rejection:</label>
                <textarea id="reject-reason-input" class="input-field mb-4" rows="3" placeholder="e.g., Image unclear, Amount mismatch, etc."></textarea>
                <div class="flex gap-3">
                    <button onclick="const reason = document.getElementById('reject-reason-input').value.trim(); this.closest('.modal-overlay').remove(); window.__adminRejectResolve(reason || null)" class="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg">Reject</button>
                    <button onclick="this.closest('.modal-overlay').remove(); window.__adminRejectResolve(null)" class="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('reject-reason-input').focus();
        window.__adminRejectResolve = resolve;
    });
    
    if (!reason) return;

    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({ 
                status: 'Trial Completed', 
                payment_status: 'Rejected',
                parent_note: `Admin Note: Payment Rejected - ${reason}`
            })
            .eq('id', leadId);

        if (error) throw error;

        showToast("Request Rejected");
        fetchPendingRegistrations();

    } catch (err) {
        showErrorModal("Rejection Failed", err.message);
    }
}

// --- 5. PACKAGE MODIFICATION ---

export async function modifyAdminPackage(leadId) {
    try {
        const { data: lead, error } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (error) throw error;
        if (!lead) {
            showErrorModal("Error", "Student record not found.");
            return;
        }

        // Populate modal with current data
        document.getElementById('admin-pkg-lead-id').value = leadId;
        document.getElementById('admin-pkg-child-name').innerText = lead.child_name;
        document.getElementById('admin-pkg-status').innerText = lead.status || 'N/A';
        document.getElementById('admin-pkg-current-batch').innerText = lead.final_batch || lead.recommended_batch || 'Not Set';
        document.getElementById('admin-pkg-current-package').innerText = lead.selected_package || 'Not Set';
        document.getElementById('admin-pkg-current-price').innerText = lead.final_price || lead.package_price || '₹0';
        document.getElementById('admin-pkg-current-locked').innerText = lead.package_locked ? 'Yes' : 'No';

        // Reset form
        document.getElementById('admin-pkg-type').value = '';
        document.getElementById('admin-pkg-lock').checked = lead.package_locked || false;
        document.getElementById('admin-pkg-lock-type').value = lead.package_lock_type || 'one-time';
        
        // Hide all option sections
        ['standard', 'morning', 'pt', 'custom'].forEach(type => {
            document.getElementById(`admin-pkg-${type}-options`).classList.add('hidden');
        });

        // Show modal and populate custom fee overrides if they exist
        if (lead.reg_fee_override) {
            document.getElementById('admin-pkg-reg-fee-custom').value = lead.reg_fee_override;
            document.getElementById('admin-pkg-reg-fee-override').checked = true;
        }
        if (lead.package_fee_override) {
            document.getElementById('admin-pkg-fee-override').value = lead.package_fee_override;
            document.getElementById('admin-pkg-fee-override-flag').checked = true;
        }
        
        document.getElementById('admin-package-modal').classList.remove('hidden');
        window.calculateAdminPackageTotal();
        
        // Add event listeners for real-time calculation
        document.getElementById('admin-pkg-standard-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-morning-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-pt-level')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-pt-sessions')?.addEventListener('input', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-custom-price')?.addEventListener('input', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-reg-fee-custom')?.addEventListener('input', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-reg-fee-override')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-fee-override')?.addEventListener('input', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-fee-override-flag')?.addEventListener('change', window.calculateAdminPackageTotal);

    } catch (err) {
        showErrorModal("Error", err.message);
    }
}

export function updateAdminPackageOptions() {
    const pkgType = document.getElementById('admin-pkg-type').value;
    
    // Hide all options
    ['standard', 'morning', 'pt', 'custom'].forEach(type => {
        document.getElementById(`admin-pkg-${type}-options`).classList.add('hidden');
    });

    if (pkgType === 'standard') {
        const select = document.getElementById('admin-pkg-standard-select');
        select.innerHTML = '<option value="">Select Package...</option>';
        STANDARD_PACKAGES.forEach(pkg => {
            select.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label} - ₹${pkg.price}</option>`;
        });
        document.getElementById('admin-pkg-standard-options').classList.remove('hidden');
    } else if (pkgType === 'morning') {
        document.getElementById('admin-pkg-morning-options').classList.remove('hidden');
    } else if (pkgType === 'pt') {
        document.getElementById('admin-pkg-pt-options').classList.remove('hidden');
    } else if (pkgType === 'custom') {
        document.getElementById('admin-pkg-custom-options').classList.remove('hidden');
    }

    window.calculateAdminPackageTotal();
}

export function calculateAdminPackageTotal() {
    const pkgType = document.getElementById('admin-pkg-type').value;
    let packageFee = 0;
    
    // Get registration fee (custom or standard)
    const regFeeOverride = document.getElementById('admin-pkg-reg-fee-custom');
    const regFeeOverrideFlag = document.getElementById('admin-pkg-reg-fee-override');
    let regFee = REGISTRATION_FEE;
    if (regFeeOverrideFlag && regFeeOverrideFlag.checked && regFeeOverride) {
        regFee = parseInt(regFeeOverride.value) || REGISTRATION_FEE;
    }
    document.getElementById('admin-pkg-reg-fee-display').innerText = regFee;

    // Calculate base package fee
    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (val) packageFee = parseInt(val.split('|')[1]);
    } else if (pkgType === 'morning') {
        const val = document.getElementById('admin-pkg-morning-select').value;
        if (val) packageFee = parseInt(val.split('|')[1]);
    } else if (pkgType === 'pt') {
        const level = document.getElementById('admin-pkg-pt-level').value;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        if (PT_RATES[level]) packageFee = PT_RATES[level] * sessions;
    } else if (pkgType === 'custom') {
        packageFee = parseInt(document.getElementById('admin-pkg-custom-price').value) || 0;
    }

    // Check for package fee override
    const feeOverride = document.getElementById('admin-pkg-fee-override');
    const feeOverrideFlag = document.getElementById('admin-pkg-fee-override-flag');
    if (feeOverrideFlag && feeOverrideFlag.checked && feeOverride && feeOverride.value) {
        packageFee = parseInt(feeOverride.value) || packageFee;
    }
    
    document.getElementById('admin-pkg-fee-display').innerText = packageFee;

    // Calculate total (add registration fee if not renewal)
    const status = document.getElementById('admin-pkg-status').innerText;
    let total = packageFee;
    if (status !== 'Enrolled' && packageFee > 0) {
        total += regFee;
    }

    document.getElementById('admin-pkg-total').innerText = total;
}

// Add event listeners for real-time calculation
if (typeof window !== 'undefined') {
    // This will be called when modal opens
    document.addEventListener('DOMContentLoaded', () => {
        // Event listeners will be added dynamically when modal opens
    });
}

export async function saveAdminPackage() {
    const leadId = document.getElementById('admin-pkg-lead-id').value;
    const pkgType = document.getElementById('admin-pkg-type').value;
    const isLocked = document.getElementById('admin-pkg-lock').checked;
    const lockType = document.getElementById('admin-pkg-lock-type').value;

    if (!pkgType) {
        showErrorModal("Selection Required", "Please select a package type.");
        return;
    }

    // Get custom fees
    const regFeeOverride = document.getElementById('admin-pkg-reg-fee-custom');
    const regFeeOverrideFlag = document.getElementById('admin-pkg-reg-fee-override');
    const feeOverride = document.getElementById('admin-pkg-fee-override');
    const feeOverrideFlag = document.getElementById('admin-pkg-fee-override-flag');
    
    let regFee = REGISTRATION_FEE;
    if (regFeeOverrideFlag && regFeeOverrideFlag.checked && regFeeOverride) {
        regFee = parseInt(regFeeOverride.value) || REGISTRATION_FEE;
    }
    
    let packageData = {
        package_locked: isLocked,
        package_lock_type: isLocked ? lockType : null,
        admin_modified: true,
        admin_modified_at: new Date(),
        // Custom fee flags
        reg_fee_override: regFeeOverrideFlag?.checked ? regFee : null,
        reg_fee_override_flag: regFeeOverrideFlag?.checked || false,
        package_fee_override: feeOverrideFlag?.checked && feeOverride?.value ? parseInt(feeOverride.value) : null,
        package_fee_override_flag: feeOverrideFlag?.checked || false
    };

    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (!val) {
            showErrorModal("Selection Required", "Please select a standard package.");
            return;
        }
        const [id, price, classes, months] = val.split('|');
        const pkg = STANDARD_PACKAGES.find(p => p.id === id);
        const basePrice = parseInt(price);
        const finalPackagePrice = packageData.package_fee_override || basePrice;
        
        packageData.selected_package = pkg.label;
        packageData.package_price = finalPackagePrice;
        packageData.final_price = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageData.package_classes = parseInt(classes);
        packageData.package_months = parseInt(months);
        packageData.admin_package_id = id;
    } else if (pkgType === 'morning') {
        const val = document.getElementById('admin-pkg-morning-select').value;
        if (!val) {
            showErrorModal("Selection Required", "Please select a morning package.");
            return;
        }
        const [id, price, classes, months] = val.split('|');
        const pkg = id.includes('adult') ? MORNING_PACKAGES.ADULT : MORNING_PACKAGES.CHILD;
        const basePrice = parseInt(price);
        const finalPackagePrice = packageData.package_fee_override || basePrice;
        
        packageData.selected_package = pkg.label;
        packageData.package_price = finalPackagePrice;
        packageData.final_price = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageData.package_classes = parseInt(classes);
        packageData.package_months = parseInt(months);
        packageData.admin_package_id = id;
    } else if (pkgType === 'pt') {
        const level = document.getElementById('admin-pkg-pt-level').value;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        if (!sessions) {
            showErrorModal("Input Required", "Please enter number of PT sessions.");
            return;
        }
        const basePrice = PT_RATES[level] * sessions;
        const finalPackagePrice = packageData.package_fee_override || basePrice;
        
        packageData.selected_package = `PT (${level}) - ${sessions} Classes`;
        packageData.package_price = finalPackagePrice;
        packageData.final_price = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageData.package_classes = sessions;
        packageData.package_months = 1; // PT is typically monthly
        packageData.admin_package_id = `pt_${level}_${sessions}`;
    } else if (pkgType === 'custom') {
        const name = document.getElementById('admin-pkg-custom-name').value.trim();
        const price = parseInt(document.getElementById('admin-pkg-custom-price').value) || 0;
        const classes = parseInt(document.getElementById('admin-pkg-custom-classes').value) || 0;
        const months = parseInt(document.getElementById('admin-pkg-custom-months').value) || 0;
        
        if (!name || !price || !classes || !months) {
            showErrorModal("Input Required", "Please fill all custom package fields.");
            return;
        }
        const finalPackagePrice = packageData.package_fee_override || price;
        
        packageData.selected_package = name;
        packageData.package_price = finalPackagePrice;
        packageData.final_price = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageData.package_classes = classes;
        packageData.package_months = months;
        packageData.admin_package_id = `custom_${Date.now()}`;
    }

    // Update status to "Ready to Pay" if it was "Enrollment Requested"
    const currentStatus = document.getElementById('admin-pkg-status').innerText;
    if (currentStatus === 'Enrollment Requested' || currentStatus === 'Trial Completed') {
        packageData.status = 'Ready to Pay';
        packageData.final_batch = document.getElementById('admin-pkg-current-batch').innerText;
    }

    try {
        const { error } = await supabaseClient
            .from('leads')
            .update(packageData)
            .eq('id', leadId);

        if (error) throw error;

        document.getElementById('admin-package-modal').classList.add('hidden');
        showSuccessModal("Package Updated!", "Package details have been saved. Parent can now proceed with payment.");
        fetchPendingRegistrations();

    } catch (err) {
        showErrorModal("Save Failed", err.message);
    }
}

// --- 6. ADMIN ASSESSMENT FUNCTIONS ---
export function openAdminAssessment(leadString) {
    // Reuse trainer assessment modal but with admin capabilities
    const lead = JSON.parse(decodeURIComponent(leadString));
    document.getElementById('assess-lead-id').value = lead.id;
    document.getElementById('assess-child-name').innerText = lead.child_name;
    document.getElementById('assess-feedback').value = lead.feedback || '';
    
    // Set existing values if assessment already done
    if (lead.skills_rating) {
        document.getElementById('skill-listen').checked = lead.skills_rating.listening || false;
        document.getElementById('skill-flex').checked = lead.skills_rating.flexibility || false;
        document.getElementById('skill-strength').checked = lead.skills_rating.strength || false;
        document.getElementById('skill-balance').checked = lead.skills_rating.balance || false;
        document.getElementById('assess-pt').checked = lead.skills_rating.personal_training || false;
        document.getElementById('assess-special').checked = lead.special_needs || false;
    } else {
        ['listen', 'flex', 'strength', 'balance'].forEach(k => { document.getElementById(`skill-${k}`).checked = false; });
        document.getElementById('assess-pt').checked = false;
        document.getElementById('assess-special').checked = false;
    }
    
    const age = calculateAge(lead.dob);
    let batch = lead.recommended_batch || "Toddler (3-5 Yrs)";
    if (age >= ADULT_AGE_THRESHOLD) batch = "Adult Fitness";
    else if (age >= 8) batch = "Intermediate (8+ Yrs)";
    else if (age >= 5) batch = "Beginner (5-8 Yrs)";
    
    document.getElementById('assess-batch').value = batch;
    document.getElementById('assessment-modal').classList.remove('hidden');
    
    // Update save button for admin
    const saveBtn = document.getElementById('btn-save-assess');
    if (saveBtn) {
        saveBtn.onclick = () => window.saveAdminAssessment();
        saveBtn.innerHTML = '<span>Save Assessment</span><i class="fas fa-paper-plane ml-2"></i>';
    }
}

export async function editAdminAssessment(leadString) {
    // Open assessment for editing with option to re-send email
    const lead = JSON.parse(decodeURIComponent(leadString));
    
    // Create admin assessment modal with email option
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'admin-edit-assessment-modal';
    modal.innerHTML = `
        <div class="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="bg-purple-600 p-4 text-white flex justify-between items-center mb-4 rounded-t-lg">
                <h3 class="font-bold text-lg"><i class="fas fa-edit mr-2"></i> Edit Assessment & Feedback</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="text-purple-100 hover:text-white">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6">
                <input type="hidden" id="admin-edit-assess-lead-id" value="${lead.id}">
                <h4 class="text-xl font-bold mb-4">${lead.child_name}</h4>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold text-slate-700 mb-2">Trainer Feedback</label>
                    <textarea id="admin-edit-feedback" rows="4" class="input-field w-full">${lead.feedback || ''}</textarea>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold text-slate-700 mb-2">Recommended Batch</label>
                    <select id="admin-edit-batch" class="input-field w-full">
                        <option value="Toddler (3-5 Yrs)" ${lead.recommended_batch === 'Toddler (3-5 Yrs)' ? 'selected' : ''}>Toddler (3-5 Yrs)</option>
                        <option value="Beginner (5-8 Yrs)" ${lead.recommended_batch === 'Beginner (5-8 Yrs)' ? 'selected' : ''}>Beginner (5-8 Yrs)</option>
                        <option value="Intermediate (8+ Yrs)" ${lead.recommended_batch === 'Intermediate (8+ Yrs)' ? 'selected' : ''}>Intermediate (8+ Yrs)</option>
                        <option value="Adult Fitness" ${lead.recommended_batch === 'Adult Fitness' ? 'selected' : ''}>Adult Fitness</option>
                    </select>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold text-slate-700 mb-2">Skills Assessment</label>
                    <div class="grid grid-cols-2 gap-3">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="admin-edit-skill-listen" ${lead.skills_rating?.listening ? 'checked' : ''} class="w-5 h-5">
                            <span>Listening</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="admin-edit-skill-flex" ${lead.skills_rating?.flexibility ? 'checked' : ''} class="w-5 h-5">
                            <span>Flexibility</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="admin-edit-skill-strength" ${lead.skills_rating?.strength ? 'checked' : ''} class="w-5 h-5">
                            <span>Strength</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="admin-edit-skill-balance" ${lead.skills_rating?.balance ? 'checked' : ''} class="w-5 h-5">
                            <span>Balance</span>
                        </label>
                    </div>
                </div>
                
                <div class="mb-4 space-y-2">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="admin-edit-pt" ${lead.skills_rating?.personal_training ? 'checked' : ''} class="w-5 h-5">
                        <span class="font-bold">Recommend Personal Training</span>
                    </label>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="admin-edit-special" ${lead.special_needs ? 'checked' : ''} class="w-5 h-5">
                        <span class="font-bold">Special Needs / Autism</span>
                    </label>
                </div>
                
                <div class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-4">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="admin-resend-email" class="w-5 h-5 accent-yellow-600">
                        <span class="font-bold text-yellow-900">Re-send feedback email to parent</span>
                    </label>
                    <p class="text-xs text-yellow-700 mt-2">If checked, parent will receive updated assessment via email</p>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition">Cancel</button>
                    <button onclick="window.saveAdminAssessmentEdit()" class="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition">
                        <i class="fas fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export async function saveAdminAssessment() {
    // Save assessment (same as trainer but with admin context)
    const leadId = document.getElementById('assess-lead-id').value;
    const feedback = document.getElementById('assess-feedback').value;
    const batch = document.getElementById('assess-batch').value;
    const pt = document.getElementById('assess-pt').checked;
    const special = document.getElementById('assess-special').checked;
    
    if (!batch) {
        showErrorModal("Missing Info", "Please select a Recommended Batch.");
        return;
    }
    
    const skills = {
        listening: document.getElementById('skill-listen').checked,
        flexibility: document.getElementById('skill-flex').checked,
        strength: document.getElementById('skill-strength').checked,
        balance: document.getElementById('skill-balance').checked,
        personal_training: pt,
        special_needs: special
    };
    
    try {
        const { error } = await supabaseClient.from('leads').update({
            status: 'Trial Completed',
            feedback: feedback,
            recommended_batch: batch,
            skills_rating: skills,
            special_needs: special
        }).eq('id', leadId);
        
        if (error) throw error;
        
        // Send email notification
        const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', leadId).single();
        await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
                record: { ...lead, feedback: feedback, recommended_batch: batch, skills_rating: skills, pt_recommended: pt, special_needs: special, type: 'feedback_email' }
            })
        });
        
        document.getElementById('assessment-modal').classList.add('hidden');
        showSuccessModal("Assessment Saved!", "Evaluation saved and parent notified via email.");
        fetchAdminTrials();
    } catch (e) {
        console.error(e);
        showErrorModal("Save Error", e.message);
    }
}

export async function saveAdminAssessmentEdit() {
    const leadId = document.getElementById('admin-edit-assess-lead-id').value;
    const feedback = document.getElementById('admin-edit-feedback').value;
    const batch = document.getElementById('admin-edit-batch').value;
    const resendEmail = document.getElementById('admin-resend-email').checked;
    
    const skills = {
        listening: document.getElementById('admin-edit-skill-listen').checked,
        flexibility: document.getElementById('admin-edit-skill-flex').checked,
        strength: document.getElementById('admin-edit-skill-strength').checked,
        balance: document.getElementById('admin-edit-skill-balance').checked,
        personal_training: document.getElementById('admin-edit-pt').checked,
        special_needs: document.getElementById('admin-edit-special').checked
    };
    
    try {
        const { error } = await supabaseClient.from('leads').update({
            feedback: feedback,
            recommended_batch: batch,
            skills_rating: skills,
            special_needs: skills.special_needs
        }).eq('id', leadId);
        
        if (error) throw error;
        
        // Re-send email if requested
        if (resendEmail) {
            const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', leadId).single();
            await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                    record: { ...lead, feedback: feedback, recommended_batch: batch, skills_rating: skills, pt_recommended: skills.personal_training, special_needs: skills.special_needs, type: 'feedback_email' }
                })
            });
        }
        
        document.getElementById('admin-edit-assessment-modal').remove();
        showSuccessModal("Assessment Updated!", resendEmail ? "Changes saved and email sent to parent." : "Changes saved.");
        fetchAdminTrials();
    } catch (e) {
        console.error(e);
        showErrorModal("Save Error", e.message);
    }
}

// --- 7. DECLINED REGISTRATIONS ---
export async function fetchDeclinedRegistrations() {
    const container = document.getElementById('view-batches');
    if (!container) return;
    
    container.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading declined registrations...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .in('status', ['Follow Up', 'Trial Completed'])
            .order('follow_up_date', { ascending: true })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        container.innerHTML = '';
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="bg-white p-8 rounded-2xl shadow text-center"><p class="text-slate-400">No declined registrations or follow-ups.</p></div>';
            return;
        }
        
        // Group by follow-up date
        const today = new Date().toISOString().split('T')[0];
        const overdue = [];
        const upcoming = [];
        const noDate = [];
        
        data.forEach(lead => {
            if (lead.follow_up_date) {
                if (lead.follow_up_date < today) {
                    overdue.push(lead);
                } else {
                    upcoming.push(lead);
                }
            } else {
                noDate.push(lead);
            }
        });
        
        let html = '<div class="space-y-6">';
        
        if (overdue.length > 0) {
            html += `<div class="bg-red-50 p-4 rounded-xl border border-red-200 mb-4">
                <h3 class="font-bold text-red-900 mb-3"><i class="fas fa-exclamation-triangle mr-2"></i>Overdue Follow-ups (${overdue.length})</h3>
                <div class="space-y-3">`;
            overdue.forEach(lead => html += createFollowUpCard(lead, true));
            html += '</div></div>';
        }
        
        if (upcoming.length > 0) {
            html += `<div class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-4">
                <h3 class="font-bold text-yellow-900 mb-3"><i class="fas fa-calendar-alt mr-2"></i>Upcoming Follow-ups (${upcoming.length})</h3>
                <div class="space-y-3">`;
            upcoming.forEach(lead => html += createFollowUpCard(lead, false));
            html += '</div></div>';
        }
        
        if (noDate.length > 0) {
            html += `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 class="font-bold text-slate-900 mb-3"><i class="fas fa-question-circle mr-2"></i>No Follow-up Date (${noDate.length})</h3>
                <div class="space-y-3">`;
            noDate.forEach(lead => html += createFollowUpCard(lead, false));
            html += '</div></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Declined Registrations Error:", err);
        container.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
    }
}

function createFollowUpCard(lead, isOverdue) {
    const leadString = encodeURIComponent(JSON.stringify(lead));
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${isOverdue ? 'border-red-500' : 'border-orange-400'} mb-3">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name}</h4>
                <p class="text-xs text-slate-500">${lead.parent_name} • ${lead.phone || 'N/A'}</p>
            </div>
            <span class="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded">${lead.status}</span>
        </div>
        <div class="bg-slate-50 p-3 rounded text-xs mb-2">
            <p><strong>Reason:</strong> ${lead.feedback_reason || 'Not specified'}</p>
            <p><strong>Follow-up Date:</strong> ${lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString('en-IN') : 'Not set'}</p>
            ${lead.parent_note ? `<p><strong>Notes:</strong> ${lead.parent_note}</p>` : ''}
        </div>
        <div class="flex gap-2">
            <button onclick="window.editFollowUp('${lead.id}')" class="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition">
                <i class="fas fa-edit mr-1"></i> Edit Follow-up
            </button>
            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-700 transition">
                <i class="fas fa-redo mr-1"></i> Re-open Registration
            </button>
        </div>
    </div>`;
}

// --- 8. ALL STUDENTS VIEW ---
export async function fetchAllStudents() {
    const container = document.getElementById('view-attendance');
    if (!container) return;
    
    container.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading all students...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        
        if (error) throw error;
        
        // Group by status
        const grouped = {};
        data.forEach(lead => {
            const status = lead.status || 'Unknown';
            if (!grouped[status]) grouped[status] = [];
            grouped[status].push(lead);
        });
        
        let html = '<div class="space-y-6">';
        html += `<div class="bg-white p-4 rounded-xl shadow-sm mb-4">
            <h3 class="font-bold text-lg mb-4">Total Students: ${data.length}</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">`;
        
        Object.keys(grouped).forEach(status => {
            html += `<div class="text-center p-3 bg-slate-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${grouped[status].length}</div>
                <div class="text-xs text-slate-600 mt-1">${status}</div>
            </div>`;
        });
        
        html += '</div></div>';
        
        // Show enrolled students
        if (grouped['Enrolled']) {
            html += '<div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="font-bold mb-4">Enrolled Students</h3><div class="space-y-2">';
            grouped['Enrolled'].forEach(lead => {
                html += `<div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                        <span class="font-bold">${lead.child_name}</span>
                        <span class="text-xs text-slate-500 ml-2">${lead.selected_package || 'N/A'}</span>
                    </div>
                    <button onclick="window.modifyAdminPackage('${lead.id}')" class="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                        Edit Package
                    </button>
                </div>`;
            });
            html += '</div></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error("All Students Error:", err);
        container.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
    }
}

// --- 9. FOLLOW-UP EDITING ---
export function editFollowUp(leadId) {
    // Create modal for editing follow-up
    supabaseClient.from('leads').select('*').eq('id', leadId).single().then(({ data: lead, error }) => {
        if (error) {
            showErrorModal("Error", error.message);
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Edit Follow-up</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Follow-up Date</label>
                        <input type="date" id="edit-followup-date" value="${lead.follow_up_date || ''}" class="input-field w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Reason</label>
                        <input type="text" id="edit-followup-reason" value="${lead.feedback_reason || ''}" class="input-field w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Notes</label>
                        <textarea id="edit-followup-notes" rows="3" class="input-field w-full">${lead.parent_note || ''}</textarea>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-50">Cancel</button>
                        <button onclick="window.saveFollowUp('${leadId}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    });
}

export async function saveFollowUp(leadId) {
    const date = document.getElementById('edit-followup-date').value;
    const reason = document.getElementById('edit-followup-reason').value;
    const notes = document.getElementById('edit-followup-notes').value;
    
    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({
                follow_up_date: date || null,
                feedback_reason: reason || null,
                parent_note: notes || null
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        document.querySelector('#edit-followup-date').closest('.modal-overlay').remove();
        showSuccessModal("Follow-up Updated!", "Changes saved successfully.");
        fetchDeclinedRegistrations();
    } catch (err) {
        showErrorModal("Save Failed", err.message);
    }
}
