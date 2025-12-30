// js/roles/admin.js
import { supabaseClient, supabaseKey, CLASS_SCHEDULE, HOLIDAYS_MYSORE, TRIAL_EXCLUDED_DAYS } from '../config.js';
import { showView, showSuccessModal, showToast, showErrorModal, calculateAge, getFinalPrice, getPackageMetadata } from '../utils.js';
import { STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, REGISTRATION_FEE, ADULT_AGE_THRESHOLD } from '../config.js';
import { getAllBatches, getEligibleStudents, recordAttendance, getAttendanceSummary } from '../attendance.js';

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
    
    // Show admin search bar
    const searchBar = document.getElementById('admin-search-bar');
    if (searchBar) searchBar.classList.remove('hidden');
    
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
            loadAdminAttendanceView();
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

// Global filter state
let adminFilters = {
    search: '',
    status: [],
    ageGroup: [],
    trialDateFrom: null,
    trialDateTo: null,
    expiryDateFrom: null,
    expiryDateTo: null
};

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
        let query = supabaseClient
            .from('leads')
            .select('*');
        
        // Apply status filter
        if (adminFilters.status.length > 0) {
            query = query.in('status', adminFilters.status);
        } else {
            query = query.in('status', ['Pending Trial', 'Trial Completed']);
        }
        
        // Apply date filters
        if (adminFilters.trialDateFrom) {
            query = query.gte('trial_scheduled_slot', adminFilters.trialDateFrom);
        }
        if (adminFilters.trialDateTo) {
            query = query.lte('trial_scheduled_slot', adminFilters.trialDateTo);
        }
        
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(200);
        
        if (error) throw error;
        
        // Apply client-side filters (search, age group, expiry)
        let filteredData = data || [];
        
        // Search filter
        if (adminFilters.search) {
            const searchLower = adminFilters.search.toLowerCase();
            filteredData = filteredData.filter(lead => 
                lead.child_name?.toLowerCase().includes(searchLower) ||
                lead.parent_name?.toLowerCase().includes(searchLower) ||
                lead.phone?.includes(adminFilters.search) ||
                lead.email?.toLowerCase().includes(searchLower)
            );
        }
        
        // Age group filter
        if (adminFilters.ageGroup.length > 0) {
            filteredData = filteredData.filter(lead => {
                if (!lead.dob) return false;
                const age = calculateAge(lead.dob);
                return adminFilters.ageGroup.some(group => {
                    if (group === '0-5') return age < 5;
                    if (group === '5-8') return age >= 5 && age < 8;
                    if (group === '8-14') return age >= 8 && age < 14;
                    if (group === '15+') return age >= 15;
                    return false;
                });
            });
        }
        
        // Expiry date filter (for enrolled students)
        if (adminFilters.expiryDateFrom || adminFilters.expiryDateTo) {
            filteredData = filteredData.filter(lead => {
                if (lead.status !== 'Enrolled') return false;
                
                // Get package_months from metadata if stored in parent_note
                let packageMonths = lead.package_months;
                if (!packageMonths && lead.parent_note) {
                    const metaMatch = lead.parent_note.match(/\[PACKAGE_META\](.*?)\[\/PACKAGE_META\]/);
                    if (metaMatch) {
                        try {
                            const meta = JSON.parse(metaMatch[1]);
                            packageMonths = meta.package_months;
                        } catch (e) {
                            console.warn('Could not parse package metadata for expiry', e);
                        }
                    }
                }
                
                if (!packageMonths) return false;
                
                // Calculate expiry date (enrollment_date may not exist, use created_at)
                const startDate = new Date(lead.created_at);
                const expiryDate = new Date(startDate);
                expiryDate.setMonth(expiryDate.getMonth() + (packageMonths || 0));
                
                if (adminFilters.expiryDateFrom && expiryDate < new Date(adminFilters.expiryDateFrom)) return false;
                if (adminFilters.expiryDateTo && expiryDate > new Date(adminFilters.expiryDateTo)) return false;
                return true;
            });
        }
        
        listNew.innerHTML = '';
        listDone.innerHTML = '';
        
        if (filteredData.length === 0) {
            listNew.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No matching trials found.</p>';
            return;
        }
        
        filteredData.forEach(lead => {
            if (lead.status === 'Pending Trial') {
                listNew.innerHTML += createAdminTrialCard(lead);
            } else if (lead.status === 'Trial Completed') {
                listDone.innerHTML += createAdminCompletedTrialCard(lead);
            }
        });
        
        if (listNew.innerHTML === '') {
            listNew.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">All trials completed! 🎉</p>';
        }
        
        // Update active filters display
        updateActiveFiltersDisplay();
        
    } catch (err) {
        console.error("Admin Trials Error:", err);
        listNew.innerHTML = `<p class="text-red-500 text-sm">Error: ${err.message}</p>`;
    }
}

// Handle search input
window.handleAdminSearch = function() {
    const searchInput = document.getElementById('admin-search-input');
    if (searchInput) {
        adminFilters.search = searchInput.value.trim();
        fetchAdminTrials();
    }
};

// Update active filters display
function updateActiveFiltersDisplay() {
    const container = document.getElementById('admin-active-filters');
    if (!container) return;
    
    const activeFilters = [];
    if (adminFilters.search) activeFilters.push({ label: `Search: "${adminFilters.search}"`, type: 'search' });
    if (adminFilters.status.length > 0) activeFilters.push({ label: `Status: ${adminFilters.status.join(', ')}`, type: 'status' });
    if (adminFilters.ageGroup.length > 0) activeFilters.push({ label: `Age: ${adminFilters.ageGroup.join(', ')}`, type: 'ageGroup' });
    if (adminFilters.trialDateFrom || adminFilters.trialDateTo) {
        activeFilters.push({ label: `Trial Date: ${adminFilters.trialDateFrom || 'Any'} - ${adminFilters.trialDateTo || 'Any'}`, type: 'trialDate' });
    }
    if (adminFilters.expiryDateFrom || adminFilters.expiryDateTo) {
        activeFilters.push({ label: `Expiry: ${adminFilters.expiryDateFrom || 'Any'} - ${adminFilters.expiryDateTo || 'Any'}`, type: 'expiryDate' });
    }
    
    if (activeFilters.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = activeFilters.map(f => `
        <span class="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2">
            ${f.label}
            <button onclick="window.removeAdminFilter('${f.type}')" class="text-blue-500 hover:text-blue-700">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');
}

window.removeAdminFilter = function(type) {
    if (type === 'search') {
        adminFilters.search = '';
        document.getElementById('admin-search-input').value = '';
    } else if (type === 'status') {
        adminFilters.status = [];
    } else if (type === 'ageGroup') {
        adminFilters.ageGroup = [];
    } else if (type === 'trialDate') {
        adminFilters.trialDateFrom = null;
        adminFilters.trialDateTo = null;
    } else if (type === 'expiryDate') {
        adminFilters.expiryDateFrom = null;
        adminFilters.expiryDateTo = null;
    }
    fetchAdminTrials();
};

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
            <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-3">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-xs font-bold text-blue-900 mb-1"><i class="fas fa-calendar-check mr-1"></i>Trial Slot</p>
                        <p class="text-sm font-bold text-blue-700">${lead.trial_scheduled_slot}</p>
                    </div>
                    <button onclick="window.editAdminForm('${leadString}')" class="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-700 transition">
                        <i class="fas fa-edit mr-1"></i> Change Slot
                    </button>
                </div>
            </div>
        ` : ''}
        <div class="flex gap-2">
            <button onclick="window.editAdminForm('${leadString}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                <i class="fas fa-edit mr-1"></i> Edit Form
            </button>
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
        
        // Highlight new registrations (created in last 24 hours)
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        let pendingCount = 0;
        let enrolledCount = 0;
        
        data.forEach(lead => {
            const createdDate = new Date(lead.created_at || lead.submitted_at);
            const isNew = createdDate >= oneDayAgo;
            
            if (lead.status === 'Registration Requested' || lead.status === 'Enrollment Requested' || lead.status === 'Ready to Pay' || lead.status === 'Trial Completed') {
                listNew.innerHTML += createVerificationCard(lead, isNew);
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

function createVerificationCard(lead, isNew = false) {
    const statusColors = {
        'Trial Completed': 'bg-blue-100 text-blue-700',
        'Enrollment Requested': 'bg-orange-100 text-orange-700',
        'Registration Requested': 'bg-purple-100 text-purple-700',
        'Ready to Pay': 'bg-green-100 text-green-700'
    };
    const statusColor = statusColors[lead.status] || 'bg-purple-100 text-purple-700';
    const newBadge = isNew ? '<span class="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse font-bold">NEW!</span>' : '';
    
    // Get final_price from metadata
    const finalPrice = getFinalPrice(lead);
    const meta = getPackageMetadata(lead);
    const selectedPkg = meta?.selected_package || lead.selected_package;
    const hasPackage = selectedPkg || finalPrice;
    const showPaymentActions = lead.status === 'Registration Requested' && lead.payment_proof_url;
    
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${isNew ? 'border-red-500 bg-red-50' : 'border-purple-500'} mb-3 hover:shadow-md transition ${isNew ? 'animate-pulse' : ''}">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-slate-800">${lead.child_name}${newBadge}</h4>
                <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone || 'N/A'}</p>
            </div>
            <span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded">${lead.status || 'Pending'}</span>
        </div>
        
        <div class="bg-slate-50 p-3 rounded border border-slate-100 text-xs mb-3">
            <p><strong>Status:</strong> ${lead.status || 'N/A'}</p>
            ${hasPackage ? `
                <p><strong>Package:</strong> ${selectedPkg || lead.recommended_batch || 'Not Set'}</p>
                <p><strong>Amount:</strong> ₹${finalPrice || meta?.package_price || lead.package_price || '0'}</p>
            ` : `
                <p><strong>Recommended Batch:</strong> ${lead.recommended_batch || 'Not Set'}</p>
                <p class="text-orange-600"><strong>Action:</strong> Set package and pricing</p>
            `}
            ${lead.start_date ? `<p><strong>Start Date:</strong> ${lead.start_date}</p>` : ''}
            ${meta?.pt_request ? `
                <div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                    <p class="font-bold text-amber-900 mb-1"><i class="fas fa-dumbbell mr-1"></i> Personal Training Request</p>
                    <p><strong>Preferred Start:</strong> ${new Date(meta.pt_request.preferred_start_date).toLocaleDateString('en-IN')}</p>
                    ${meta.pt_request.notes ? `<p><strong>Notes:</strong> ${meta.pt_request.notes}</p>` : ''}
                    <p class="text-xs text-amber-700 mt-1">Admin to set: Rate per session, Number of sessions, Validity period</p>
                </div>
            ` : ''}
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
    const meta = getPackageMetadata(lead);
    const selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
    return `
    <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 border-l-4 border-green-500 opacity-75 mb-3">
        <div class="flex justify-between items-center">
            <div>
                <h4 class="font-bold text-slate-700 text-sm">${lead.child_name}</h4>
                <p class="text-[10px] text-slate-500">${selectedPkg}</p>
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
        // Only update fields that exist - enrollment_date may not exist in schema
        const { error } = await supabaseClient
            .from('leads')
            .update({ 
                status: 'Enrolled', 
                payment_status: 'Paid'
                // enrollment_date removed - may not exist in schema
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
        document.getElementById('admin-pkg-current-batch').innerText = lead.recommended_batch || 'Not Set';
        // Get package data from metadata or direct fields
        const meta = getPackageMetadata(lead);
        const selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
        const packagePrice = meta?.package_price || lead.package_price || 0;
        const finalPrice = getFinalPrice(lead);
        document.getElementById('admin-pkg-current-package').innerText = selectedPkg;
        document.getElementById('admin-pkg-current-price').innerText = finalPrice || packagePrice || '₹0';
        const isLocked = meta?.package_locked || lead.package_locked || false;
        document.getElementById('admin-pkg-current-locked').innerText = isLocked ? 'Yes' : 'No';

        // Reset form
        document.getElementById('admin-pkg-type').value = '';
        
        // Check if this is an adult PT request
        const ptRequestInfo = document.getElementById('admin-pt-request-info');
        const ptRequestDetails = document.getElementById('admin-pt-request-details');
        if (meta?.pt_request && meta.pt_request.type === 'adult_pt_request') {
            ptRequestInfo.classList.remove('hidden');
            ptRequestDetails.innerHTML = `
                <p><strong>Preferred Start Date:</strong> ${new Date(meta.pt_request.preferred_start_date).toLocaleDateString('en-IN')}</p>
                ${meta.pt_request.notes ? `<p><strong>Notes:</strong> ${meta.pt_request.notes}</p>` : ''}
            `;
            // Pre-fill start date
            document.getElementById('admin-pkg-pt-start-date').value = meta.pt_request.preferred_start_date;
            // Auto-select PT type
            document.getElementById('admin-pkg-type').value = 'pt';
            window.updateAdminPackageOptions();
        } else {
            ptRequestInfo.classList.add('hidden');
        }
        
        // Get lock status from metadata or direct field (already declared above, reuse)
        document.getElementById('admin-pkg-lock').checked = isLocked;
        
        // Get package_lock_type from metadata
        let lockType = meta?.package_lock_type || 'one-time';
        document.getElementById('admin-pkg-lock-type').value = lockType;
        
        // Hide all option sections
        ['standard', 'morning', 'pt', 'custom'].forEach(type => {
            document.getElementById(`admin-pkg-${type}-options`).classList.add('hidden');
        });

        // Show modal and populate custom fee overrides if they exist
        // Extract from parent_note if stored there
        let customFees = null;
        if (lead.parent_note) {
            const feeMatch = lead.parent_note.match(/\[ADMIN_FEES\](.*?)\[\/ADMIN_FEES\]/);
            if (feeMatch) {
                try {
                    customFees = JSON.parse(feeMatch[1]);
                } catch (e) {
                    console.warn('Could not parse custom fees', e);
                }
            }
        }
        
        if (customFees?.reg_fee_override) {
            document.getElementById('admin-pkg-reg-fee-custom').value = customFees.reg_fee_override;
            document.getElementById('admin-pkg-reg-fee-override').checked = true;
        }
        if (customFees?.package_fee_override) {
            document.getElementById('admin-pkg-fee-override').value = customFees.package_fee_override;
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
        // Set minimum date for start date (today)
        const startDateEl = document.getElementById('admin-pkg-pt-start-date');
        if (startDateEl) {
            startDateEl.min = new Date().toISOString().split('T')[0];
        }
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
    
    // Build package data - SAFE APPROACH: Only update status field
    // Store ALL package data in parent_note metadata to avoid column errors
    let packageData = {
        // Only update status - this should definitely exist
        // All other fields stored in metadata below
    };
    
    // Store custom fee overrides and additional metadata in parent_note as JSON
    const customFees = {
        reg_fee_override: regFeeOverrideFlag?.checked ? regFee : null,
        reg_fee_override_flag: regFeeOverrideFlag?.checked || false,
        package_fee_override: feeOverrideFlag?.checked && feeOverride?.value ? parseInt(feeOverride.value) : null,
        package_fee_override_flag: feeOverrideFlag?.checked || false
    };
    
    // Additional package metadata to store
    const packageMetadata = {
        package_lock_type: isLocked ? lockType : null,
        package_classes: null, // Will be set below
        package_months: null    // Will be set below
    };
    
    // Fetch current lead to get existing parent_note
    const { data: currentLead } = await supabaseClient
        .from('leads')
        .select('parent_note')
        .eq('id', leadId)
        .single();
    
    // Build metadata string to store in parent_note
    let metadataNote = '';
    if (customFees.reg_fee_override_flag || customFees.package_fee_override_flag) {
        metadataNote += `[ADMIN_FEES]${JSON.stringify(customFees)}[/ADMIN_FEES]`;
    }

    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (!val) {
            showErrorModal("Selection Required", "Please select a standard package.");
            return;
        }
        const [id, price, classes, months] = val.split('|');
        const pkg = STANDARD_PACKAGES.find(p => p.id === id);
        const basePrice = parseInt(price);
        const finalPackagePrice = customFees.package_fee_override || basePrice;
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = pkg.label;
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = parseInt(classes);
        packageMetadata.package_months = parseInt(months);
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
           } else if (pkgType === 'morning') {
               const val = document.getElementById('admin-pkg-morning-select').value;
               if (!val) {
                   showErrorModal("Selection Required", "Please select a morning package.");
                   return;
               }
               const [id, price, classes, months] = val.split('|');
               const pkg = MORNING_PACKAGES.CHILD; // Same for all now
               const basePrice = parseInt(price);
               const finalPackagePrice = customFees.package_fee_override || basePrice;
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = pkg.label;
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = parseInt(classes);
        packageMetadata.package_months = parseInt(months);
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
    } else if (pkgType === 'pt') {
        const rate = parseInt(document.getElementById('admin-pkg-pt-rate').value) || 0;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        const startDate = document.getElementById('admin-pkg-pt-start-date').value;
        const validityType = document.getElementById('admin-pkg-pt-validity-type').value;
        const validityDate = document.getElementById('admin-pkg-pt-validity-date').value;
        
        if (!rate || !sessions) {
            showErrorModal("Input Required", "Please enter rate per session and number of sessions.");
            return;
        }
        
        if (!startDate) {
            showErrorModal("Date Required", "Please select a start date for Personal Training.");
            return;
        }
        
        // Calculate validity end date
        let validityEndDate = null;
        if (validityType === 'specific') {
            if (!validityDate) {
                showErrorModal("Date Required", "Please select an end date for validity.");
                return;
            }
            validityEndDate = validityDate;
        } else {
            const start = new Date(startDate);
            const months = validityType === 'month' ? 1 : validityType === 'quarter' ? 3 : validityType === 'halfyearly' ? 6 : 12;
            validityEndDate = new Date(start);
            validityEndDate.setMonth(validityEndDate.getMonth() + months);
            validityEndDate = validityEndDate.toISOString().split('T')[0];
        }
        
        const basePrice = rate * sessions;
        const finalPackagePrice = customFees.package_fee_override || basePrice;
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = `PT - ${sessions} Classes @ ₹${rate}/session`;
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = sessions;
        packageMetadata.package_months = null; // PT uses specific dates
        packageMetadata.pt_details = {
            rate_per_session: rate,
            sessions: sessions,
            start_date: startDate,
            validity_type: validityType,
            validity_end_date: validityEndDate
        };
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
    } else if (pkgType === 'custom') {
        const name = document.getElementById('admin-pkg-custom-name').value.trim();
        const price = parseInt(document.getElementById('admin-pkg-custom-price').value) || 0;
        const classes = parseInt(document.getElementById('admin-pkg-custom-classes').value) || 0;
        const months = parseInt(document.getElementById('admin-pkg-custom-months').value) || 0;
        
        if (!name || !price || !classes || !months) {
            showErrorModal("Input Required", "Please fill all custom package fields.");
            return;
        }
        const finalPackagePrice = customFees.package_fee_override || price;
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = name;
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = classes;
        packageMetadata.package_months = months;
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
    }

    // Update status to "Ready to Pay" if it was "Enrollment Requested"
    const currentStatus = document.getElementById('admin-pkg-status').innerText;
    if (currentStatus === 'Enrollment Requested' || currentStatus === 'Trial Completed') {
        packageData.status = 'Ready to Pay';
        // Use recommended_batch instead of final_batch (which doesn't exist in DB)
        const currentBatch = document.getElementById('admin-pkg-current-batch').innerText;
        if (currentBatch && currentBatch !== 'Not Set') {
            packageData.recommended_batch = currentBatch;
        }
    }

    // ALWAYS store package metadata in parent_note (all package data goes here to avoid column errors)
    const existingNote = currentLead?.parent_note || '';
    const metaNote = `[PACKAGE_META]${JSON.stringify(packageMetadata)}[/PACKAGE_META]`;
    // Remove old metadata notes if exist
    let cleanedNote = existingNote.replace(/\[PACKAGE_META\].*?\[\/PACKAGE_META\]/g, '').trim();
    cleanedNote = cleanedNote.replace(/\[ADMIN_FEES\].*?\[\/ADMIN_FEES\]/g, '').trim();
    
    // Combine all metadata
    if (metadataNote) {
        packageData.parent_note = cleanedNote ? `${cleanedNote}\n${metadataNote}\n${metaNote}` : `${metadataNote}\n${metaNote}`;
    } else {
        packageData.parent_note = cleanedNote ? `${cleanedNote}\n${metaNote}` : metaNote;
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
    modal.className = 'modal-overlay z-50';
    modal.id = 'admin-edit-assessment-modal';
    modal.innerHTML = `
        <div class="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" style="margin: 2rem auto;">
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
                    <label class="block text-sm font-bold text-slate-700 mb-2">Strengths Observed</label>
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
                const pkgMeta = getPackageMetadata(lead);
                const pkgName = pkgMeta?.selected_package || lead.selected_package || 'N/A';
                html += `<div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                        <span class="font-bold">${lead.child_name}</span>
                        <span class="text-xs text-slate-500 ml-2">${pkgName}</span>
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

// --- 11. ADMIN FILTERS MODAL ---
export function openAdminFilters() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay z-50';
    modal.id = 'admin-filters-modal';
    modal.innerHTML = `
        <div class="modal-content max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="bg-blue-600 p-4 text-white flex justify-between items-center mb-4 rounded-t-lg">
                <h3 class="font-bold text-lg"><i class="fas fa-filter mr-2"></i> Advanced Filters</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="text-blue-100 hover:text-white">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- Status Filter -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Status</label>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        ${['Pending Trial', 'Trial Completed', 'Enrollment Requested', 'Ready to Pay', 'Registration Requested', 'Enrolled', 'Follow Up'].map(status => `
                            <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                                <input type="checkbox" value="${status}" class="filter-status-checkbox" 
                                    ${adminFilters.status.includes(status) ? 'checked' : ''}>
                                <span class="text-xs font-bold">${status}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Age Group Filter -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Age Group</label>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        ${['0-5', '5-8', '8-14', '15+'].map(group => `
                            <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                                <input type="checkbox" value="${group}" class="filter-age-checkbox"
                                    ${adminFilters.ageGroup.includes(group) ? 'checked' : ''}>
                                <span class="text-xs font-bold">${group} Years</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Trial Date Range -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Trial Date From</label>
                        <input type="date" id="filter-trial-from" value="${adminFilters.trialDateFrom || ''}" class="input-field w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Trial Date To</label>
                        <input type="date" id="filter-trial-to" value="${adminFilters.trialDateTo || ''}" class="input-field w-full">
                    </div>
                </div>
                
                <!-- Expiry Date Range (for enrolled students) -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Package Expiry From</label>
                        <input type="date" id="filter-expiry-from" value="${adminFilters.expiryDateFrom || ''}" class="input-field w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Package Expiry To</label>
                        <input type="date" id="filter-expiry-to" value="${adminFilters.expiryDateTo || ''}" class="input-field w-full">
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="window.clearAdminFilters()" class="flex-1 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-50 transition">Clear All</button>
                    <button onclick="window.applyAdminFilters()" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">Apply Filters</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.applyAdminFilters = function() {
    // Get status filters
    adminFilters.status = Array.from(document.querySelectorAll('.filter-status-checkbox:checked')).map(cb => cb.value);
    
    // Get age group filters
    adminFilters.ageGroup = Array.from(document.querySelectorAll('.filter-age-checkbox:checked')).map(cb => cb.value);
    
    // Get date filters
    adminFilters.trialDateFrom = document.getElementById('filter-trial-from').value || null;
    adminFilters.trialDateTo = document.getElementById('filter-trial-to').value || null;
    adminFilters.expiryDateFrom = document.getElementById('filter-expiry-from').value || null;
    adminFilters.expiryDateTo = document.getElementById('filter-expiry-to').value || null;
    
    document.getElementById('admin-filters-modal').remove();
    fetchAdminTrials();
};

window.clearAdminFilters = function() {
    adminFilters = {
        search: '',
        status: [],
        ageGroup: [],
        trialDateFrom: null,
        trialDateTo: null,
        expiryDateFrom: null,
        expiryDateTo: null
    };
    document.getElementById('admin-search-input').value = '';
    document.getElementById('admin-filters-modal').remove();
    fetchAdminTrials();
};

// --- 12. EMAIL TEMPLATE TRIGGERS ---
export function openAdminEmailTemplates() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay z-50';
    modal.id = 'admin-email-modal';
    modal.innerHTML = `
        <div class="modal-content max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="bg-blue-600 p-4 text-white flex justify-between items-center mb-4 rounded-t-lg">
                <h3 class="font-bold text-lg"><i class="fas fa-envelope mr-2"></i> Send Email Notifications</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="text-blue-100 hover:text-white">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- Template Selection -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Email Template</label>
                    <select id="email-template-select" class="input-field w-full" onchange="window.updateEmailPreview()">
                        <option value="">Select Template...</option>
                        <option value="promotion">Promotion / Special Offer</option>
                        <option value="event">Event Announcement</option>
                        <option value="birthday">Birthday Wish</option>
                        <option value="festival">Festival Greeting</option>
                        <option value="reminder">Payment Reminder</option>
                        <option value="custom">Custom Message</option>
                    </select>
                </div>
                
                <!-- Custom Message (if selected) -->
                <div id="email-custom-section" class="hidden">
                    <label class="block text-sm font-bold text-slate-700 mb-2">Custom Message</label>
                    <textarea id="email-custom-message" rows="5" class="input-field w-full" placeholder="Enter your custom message..."></textarea>
                </div>
                
                <!-- Preview -->
                <div id="email-preview" class="bg-slate-50 p-4 rounded-lg border border-slate-200 hidden">
                    <h4 class="font-bold text-sm mb-2">Preview:</h4>
                    <div id="email-preview-content" class="text-sm text-slate-600"></div>
                </div>
                
                <!-- Recipient Selection -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Send To</label>
                    <div class="space-y-2">
                        <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                            <input type="checkbox" id="email-all-students" class="email-recipient" value="all">
                            <span class="text-sm font-bold">All Active Students</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                            <input type="checkbox" id="email-pending-trials" class="email-recipient" value="pending">
                            <span class="text-sm font-bold">Pending Trials</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                            <input type="checkbox" id="email-enrolled" class="email-recipient" value="enrolled">
                            <span class="text-sm font-bold">Enrolled Students</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                            <input type="checkbox" id="email-selected" class="email-recipient" value="selected">
                            <span class="text-sm font-bold">Selected Students (from current view)</span>
                        </label>
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-50 transition">Cancel</button>
                    <button onclick="window.sendAdminEmails()" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">
                        <i class="fas fa-paper-plane mr-2"></i>Send Emails
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.updateEmailPreview = function() {
    const template = document.getElementById('email-template-select').value;
    const preview = document.getElementById('email-preview');
    const previewContent = document.getElementById('email-preview-content');
    const customSection = document.getElementById('email-custom-section');
    
    if (template === 'custom') {
        customSection.classList.remove('hidden');
        preview.classList.add('hidden');
        return;
    }
    
    customSection.classList.add('hidden');
    
    const templates = {
        promotion: '🎉 Special Promotion! Get 20% off on your next package. Limited time offer!',
        event: '📅 Join us for our upcoming event! Details coming soon.',
        birthday: '🎂 Happy Birthday! Wishing you a wonderful year ahead filled with health and happiness!',
        festival: '🎊 Festival Greetings! May this festive season bring you joy and prosperity!',
        reminder: '⏰ Friendly reminder: Your payment is due soon. Please complete payment to continue your classes.'
    };
    
    if (template && templates[template]) {
        previewContent.textContent = templates[template];
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
};

window.sendAdminEmails = async function() {
    const template = document.getElementById('email-template-select').value;
    const customMessage = document.getElementById('email-custom-message').value;
    const recipients = Array.from(document.querySelectorAll('.email-recipient:checked')).map(cb => cb.value);
    
    if (!template) {
        showErrorModal("Selection Required", "Please select an email template.");
        return;
    }
    
    if (recipients.length === 0) {
        showErrorModal("Selection Required", "Please select at least one recipient group.");
        return;
    }
    
    // Get recipient leads
    let leads = [];
    try {
        if (recipients.includes('all')) {
            const { data } = await supabaseClient.from('leads').select('*').in('status', ['Pending Trial', 'Trial Completed', 'Enrolled']);
            leads = data || [];
        } else {
            const statuses = [];
            if (recipients.includes('pending')) statuses.push('Pending Trial');
            if (recipients.includes('enrolled')) statuses.push('Enrolled');
            
            if (statuses.length > 0) {
                const { data } = await supabaseClient.from('leads').select('*').in('status', statuses);
                leads = data || [];
            }
        }
        
        if (leads.length === 0) {
            showErrorModal("No Recipients", "No students found matching the selected criteria.");
            return;
        }
        
        // Send emails
        const message = template === 'custom' ? customMessage : null;
        for (const lead of leads) {
            await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                    record: { ...lead, type: 'admin_notification', template: template, custom_message: message }
                })
            });
        }
        
        document.getElementById('admin-email-modal').remove();
        showSuccessModal("Emails Sent!", `${leads.length} email(s) sent successfully.`);
        
    } catch (err) {
        showErrorModal("Send Failed", err.message);
    }
};

// --- 13. ADMIN SETTINGS (Trial Date Suppression) ---
export function openAdminSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay z-50';
    modal.id = 'admin-settings-modal';
    
    // Load saved settings from localStorage or config
    const savedSuppressedDates = JSON.parse(localStorage.getItem('admin_suppressed_dates') || '[]');
    const savedHolidays = JSON.parse(localStorage.getItem('admin_holidays') || '[]');
    
    modal.innerHTML = `
        <div class="modal-content max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="bg-purple-600 p-4 text-white flex justify-between items-center mb-4 rounded-t-lg">
                <h3 class="font-bold text-lg"><i class="fas fa-cog mr-2"></i> Admin Settings</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="text-purple-100 hover:text-white">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- Suppressed Trial Dates -->
                <div class="bg-red-50 p-5 rounded-xl border border-red-200">
                    <h4 class="font-bold text-red-900 mb-3 flex items-center">
                        <i class="fas fa-calendar-times mr-2"></i> Suppressed Trial Dates
                    </h4>
                    <p class="text-xs text-red-700 mb-3">These dates will be excluded from trial slot generation (trainer unavailable, special events, etc.)</p>
                    <div class="flex gap-2 mb-3">
                        <input type="date" id="suppress-date-input" class="input-field flex-1">
                        <button onclick="window.addSuppressedDate()" class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition">
                            <i class="fas fa-plus mr-1"></i>Add Date
                        </button>
                    </div>
                    <div id="suppressed-dates-list" class="space-y-2">
                        ${savedSuppressedDates.map(date => `
                            <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-red-200">
                                <span class="text-sm font-bold">${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <button onclick="window.removeSuppressedDate('${date}')" class="text-red-600 hover:text-red-800">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Holiday Master -->
                <div class="bg-blue-50 p-5 rounded-xl border border-blue-200">
                    <h4 class="font-bold text-blue-900 mb-3 flex items-center">
                        <i class="fas fa-calendar-alt mr-2"></i> Holiday Master (${new Date().getFullYear()})
                    </h4>
                    <p class="text-xs text-blue-700 mb-3">Add holidays that will be excluded from all trial slot generation</p>
                    <div class="flex gap-2 mb-3">
                        <input type="date" id="holiday-date-input" class="input-field flex-1">
                        <input type="text" id="holiday-name-input" placeholder="Holiday name..." class="input-field flex-1">
                        <button onclick="window.addHoliday()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                            <i class="fas fa-plus mr-1"></i>Add
                        </button>
                    </div>
                    <div id="holidays-list" class="space-y-2">
                        ${savedHolidays.map(h => `
                            <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-200">
                                <div>
                                    <span class="text-sm font-bold">${h.name}</span>
                                    <span class="text-xs text-slate-500 ml-2">${new Date(h.date).toLocaleDateString('en-IN')}</span>
                                </div>
                                <button onclick="window.removeHoliday('${h.date}')" class="text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-50 transition">Close</button>
                    <button onclick="window.saveAdminSettings()" class="flex-1 bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition">
                        <i class="fas fa-save mr-2"></i>Save Settings
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.addSuppressedDate = function() {
    const dateInput = document.getElementById('suppress-date-input');
    const date = dateInput.value;
    if (!date) return;
    
    const saved = JSON.parse(localStorage.getItem('admin_suppressed_dates') || '[]');
    if (!saved.includes(date)) {
        saved.push(date);
        localStorage.setItem('admin_suppressed_dates', JSON.stringify(saved));
        openAdminSettings(); // Reload modal
    }
};

window.removeSuppressedDate = function(date) {
    const saved = JSON.parse(localStorage.getItem('admin_suppressed_dates') || '[]');
    const filtered = saved.filter(d => d !== date);
    localStorage.setItem('admin_suppressed_dates', JSON.stringify(filtered));
    openAdminSettings(); // Reload modal
};

window.addHoliday = function() {
    const dateInput = document.getElementById('holiday-date-input');
    const nameInput = document.getElementById('holiday-name-input');
    const date = dateInput.value;
    const name = nameInput.value.trim();
    
    if (!date || !name) return;
    
    const saved = JSON.parse(localStorage.getItem('admin_holidays') || '[]');
    if (!saved.find(h => h.date === date)) {
        saved.push({ date, name });
        localStorage.setItem('admin_holidays', JSON.stringify(saved));
        openAdminSettings(); // Reload modal
    }
};

window.removeHoliday = function(date) {
    const saved = JSON.parse(localStorage.getItem('admin_holidays') || '[]');
    const filtered = saved.filter(h => h.date !== date);
    localStorage.setItem('admin_holidays', JSON.stringify(filtered));
    openAdminSettings(); // Reload modal
};

window.saveAdminSettings = function() {
    showSuccessModal("Settings Saved!", "All settings have been saved. Changes will apply to new trial slot generation.");
    document.getElementById('admin-settings-modal').remove();
};

// --- 10. ADMIN FORM EDITING ---
export function editAdminForm(leadString) {
    const lead = JSON.parse(decodeURIComponent(leadString));
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay z-50';
    modal.id = 'admin-edit-form-modal';
    modal.innerHTML = `
        <div class="modal-content max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="bg-purple-600 p-4 text-white flex justify-between items-center mb-4 rounded-t-lg sticky top-0 z-10">
                <h3 class="font-bold text-lg"><i class="fas fa-edit mr-2"></i> Edit Student Form</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="text-purple-100 hover:text-white">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6">
                <input type="hidden" id="admin-edit-lead-id" value="${lead.id}">
                
                <!-- Prominent Trial Slot Change Section -->
                <div class="bg-blue-50 p-5 rounded-xl border-2 border-blue-300 mb-6 shadow-sm">
                    <h4 class="font-bold text-blue-900 mb-3 flex items-center">
                        <i class="fas fa-calendar-check mr-2 text-xl"></i> Change Trial Slot (Most Common Edit)
                    </h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-blue-900 mb-2">Current Slot</label>
                            <div class="bg-white p-3 rounded-lg border border-blue-200">
                                <p class="text-sm font-bold text-blue-700">${lead.trial_scheduled_slot || 'Not Set'}</p>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-blue-900 mb-2">New Trial Slot</label>
                            <div id="admin-trial-slots-container" class="grid grid-cols-2 gap-2">
                                <p class="text-xs text-slate-400 col-span-2">Generating slots...</p>
                            </div>
                            <input type="hidden" id="admin-new-trial-slot" value="${lead.trial_scheduled_slot || ''}">
                        </div>
                    </div>
                </div>
                
                <!-- Child Details -->
                <div class="bg-slate-50 p-5 rounded-xl mb-4">
                    <h4 class="font-bold text-slate-800 mb-4">Child's Details</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Child Name</label>
                            <input type="text" id="admin-edit-child-name" value="${lead.child_name || ''}" class="input-field w-full">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                            <input type="date" id="admin-edit-dob" value="${lead.dob || ''}" class="input-field w-full" onchange="window.generateAdminTrialSlots()">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                            <select id="admin-edit-gender" class="input-field w-full">
                                <option value="">Select</option>
                                <option value="Male" ${lead.gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option value="Female" ${lead.gender === 'Female' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Intent / Goal</label>
                            <input type="text" id="admin-edit-intent" value="${lead.intent || ''}" class="input-field w-full">
                        </div>
                    </div>
                </div>
                
                <!-- Parent Details -->
                <div class="bg-slate-50 p-5 rounded-xl mb-4">
                    <h4 class="font-bold text-slate-800 mb-4">Parent's Details</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Parent Name</label>
                            <input type="text" id="admin-edit-parent-name" value="${lead.parent_name || ''}" class="input-field w-full">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Email</label>
                            <input type="email" id="admin-edit-email" value="${lead.email || ''}" class="input-field w-full">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                            <input type="tel" id="admin-edit-phone" value="${lead.phone || ''}" class="input-field w-full">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Alternate Phone</label>
                            <input type="tel" id="admin-edit-alt-phone" value="${lead.alt_phone || ''}" class="input-field w-full">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs font-bold text-slate-700 mb-1">Address</label>
                            <textarea id="admin-edit-address" rows="2" class="input-field w-full">${lead.address || ''}</textarea>
                        </div>
                    </div>
                </div>
                
                <!-- Medical Info -->
                <div class="bg-slate-50 p-5 rounded-xl mb-4">
                    <h4 class="font-bold text-slate-800 mb-4">Medical Information</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-bold text-slate-700 mb-1">Medical Conditions / Allergies</label>
                            <textarea id="admin-edit-medical" rows="3" class="input-field w-full">${lead.medical_info || ''}</textarea>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <button onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition">Cancel</button>
                    <button onclick="window.saveAdminFormEdit()" class="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition">
                        <i class="fas fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Generate trial slots
    setTimeout(() => {
        window.generateAdminTrialSlots();
    }, 100);
}

// Generate trial slots for admin edit form
window.generateAdminTrialSlots = function() {
    const dob = document.getElementById('admin-edit-dob')?.value;
    const container = document.getElementById('admin-trial-slots-container');
    if (!container || !dob) {
        if (container) container.innerHTML = '<p class="text-xs text-slate-400 col-span-2">Enter DOB to see slots</p>';
        return;
    }
    
    // Reuse parent slot generation logic
    const age = calculateAge(dob);
    const slots = [];
    let datePointer = new Date();
    datePointer.setDate(datePointer.getDate() + 1);
    
    // Use imported constants
    
    // Get admin-suppressed dates from localStorage
    const suppressedDates = JSON.parse(localStorage.getItem('admin_suppressed_dates') || '[]');
    const adminHolidays = JSON.parse(localStorage.getItem('admin_holidays') || '[]');
    const adminHolidayDates = adminHolidays.map(h => h.date);
    
    let iterations = 0;
    while (slots.length < 8 && iterations < 30) {
        const dayOfWeek = datePointer.getDay();
        const dateStr = datePointer.toISOString().split('T')[0];
        const isHoliday = HOLIDAYS_MYSORE.includes(dateStr) || adminHolidayDates.includes(dateStr);
        const isExcluded = TRIAL_EXCLUDED_DAYS.includes(dayOfWeek);
        const isSuppressed = suppressedDates.includes(dateStr);
        
        if (!isHoliday && !isExcluded && !isSuppressed) {
            let validTime = null;
            const block = (dayOfWeek === 6) ? CLASS_SCHEDULE.SATURDAY : (dayOfWeek === 0) ? CLASS_SCHEDULE.SUNDAY : CLASS_SCHEDULE.EVENING;
            if (block && block.days.includes(dayOfWeek)) {
                const slot = block.slots.find(s => age >= s.min && age < s.max);
                if (slot) validTime = slot.time;
            }
            if (validTime) {
                slots.push({ 
                    iso: dateStr, 
                    display: datePointer.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), 
                    time: validTime 
                });
            }
        }
        datePointer.setDate(datePointer.getDate() + 1);
        iterations++;
    }
    
    container.innerHTML = '';
    if (slots.length === 0) {
        container.innerHTML = '<p class="text-xs text-red-500 col-span-2">No slots available</p>';
        return;
    }
    
    slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `p-2 rounded-lg border border-blue-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition text-left text-xs`;
        btn.innerHTML = `<div class="font-bold text-slate-600 mb-0.5">${slot.display}</div><div class="text-blue-700 font-bold">${slot.time}</div>`;
        btn.onclick = () => {
            document.querySelectorAll('#admin-trial-slots-container button').forEach(b => {
                b.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-100');
                b.classList.add('bg-white');
            });
            btn.classList.add('ring-2', 'ring-blue-500', 'bg-blue-100');
            document.getElementById('admin-new-trial-slot').value = `${slot.iso} | ${slot.time}`;
        };
        container.appendChild(btn);
    });
};

export async function saveAdminFormEdit() {
    const leadId = document.getElementById('admin-edit-lead-id').value;
    const newSlot = document.getElementById('admin-new-trial-slot').value;
    
    const updateData = {
        child_name: document.getElementById('admin-edit-child-name').value.trim(),
        dob: document.getElementById('admin-edit-dob').value,
        gender: document.getElementById('admin-edit-gender').value,
        intent: document.getElementById('admin-edit-intent').value.trim(),
        parent_name: document.getElementById('admin-edit-parent-name').value.trim(),
        email: document.getElementById('admin-edit-email').value.trim().toLowerCase(),
        phone: document.getElementById('admin-edit-phone').value.trim(),
        alt_phone: document.getElementById('admin-edit-alt-phone').value.trim(),
        address: document.getElementById('admin-edit-address').value.trim(),
        medical_info: document.getElementById('admin-edit-medical').value.trim()
    };
    
    if (newSlot) {
        updateData.trial_scheduled_slot = newSlot;
    }
    
    try {
        const { error } = await supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', leadId);
        
        if (error) throw error;
        
        document.getElementById('admin-edit-form-modal').remove();
        showSuccessModal("Form Updated!", "All changes have been saved successfully.");
        fetchAdminTrials();
    } catch (err) {
        showErrorModal("Save Failed", err.message);
    }
}
