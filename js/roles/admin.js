// js/roles/admin.js
import { supabaseClient } from '../config.js';
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
    const trialsTab = document.getElementById('tab-btn-trials');
    if (trialsTab) {
        trialsTab.innerHTML = '<i class="fas fa-clipboard-list mr-2"></i>Pending Registrations';
        trialsTab.onclick = () => window.switchTab('trials');
    }

    // Load Data
    await fetchPendingRegistrations();
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

        // Show modal
        document.getElementById('admin-package-modal').classList.remove('hidden');
        window.calculateAdminPackageTotal();
        
        // Add event listeners for real-time calculation
        document.getElementById('admin-pkg-standard-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-morning-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-pt-level')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-pt-sessions')?.addEventListener('input', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-custom-price')?.addEventListener('input', window.calculateAdminPackageTotal);

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
    let total = 0;
    const regFee = parseInt(document.getElementById('admin-pkg-reg-fee').innerText) || REGISTRATION_FEE;

    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (val) total = parseInt(val.split('|')[1]);
    } else if (pkgType === 'morning') {
        const val = document.getElementById('admin-pkg-morning-select').value;
        if (val) total = parseInt(val.split('|')[1]);
    } else if (pkgType === 'pt') {
        const level = document.getElementById('admin-pkg-pt-level').value;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        if (PT_RATES[level]) total = PT_RATES[level] * sessions;
    } else if (pkgType === 'custom') {
        total = parseInt(document.getElementById('admin-pkg-custom-price').value) || 0;
    }

    // Add registration fee if not renewal (check if status is not renewal)
    const status = document.getElementById('admin-pkg-status').innerText;
    if (status !== 'Enrolled' && total > 0) {
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

    let packageData = {
        package_locked: isLocked,
        package_lock_type: isLocked ? lockType : null,
        admin_modified: true,
        admin_modified_at: new Date()
    };

    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (!val) {
            showErrorModal("Selection Required", "Please select a standard package.");
            return;
        }
        const [id, price, classes, months] = val.split('|');
        const pkg = STANDARD_PACKAGES.find(p => p.id === id);
        packageData.selected_package = pkg.label;
        packageData.package_price = parseInt(price);
        packageData.final_price = parseInt(price) + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? REGISTRATION_FEE : 0);
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
        packageData.selected_package = pkg.label;
        packageData.package_price = parseInt(price);
        packageData.final_price = parseInt(price) + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? REGISTRATION_FEE : 0);
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
        packageData.selected_package = `PT (${level}) - ${sessions} Classes`;
        packageData.package_price = PT_RATES[level] * sessions;
        packageData.final_price = packageData.package_price + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? REGISTRATION_FEE : 0);
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
        packageData.selected_package = name;
        packageData.package_price = price;
        packageData.final_price = price + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? REGISTRATION_FEE : 0);
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
