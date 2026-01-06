// js/roles/admin.js
import { supabaseClient, supabaseKey, CLASS_SCHEDULE, HOLIDAYS_MYSORE, TRIAL_EXCLUDED_DAYS, ENABLE_FINANCE_FEATURES } from '../config.js';
import { showView, showSuccessModal, showToast, showErrorModal, calculateAge, getFinalPrice, getPackageMetadata, getChildPhotoThumbnail } from '../utils.js';
import { STANDARD_PACKAGES, MORNING_PACKAGES, PT_RATES, REGISTRATION_FEE, ADULT_AGE_THRESHOLD } from '../config.js';
import { getAllBatches, getEligibleStudents, recordAttendance, getAttendanceSummary, getAttendanceHistory } from '../attendance.js';

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
        
        // Show/hide search bars based on tab
        const trialsSearchBar = document.getElementById('admin-search-bar-trials');
        const registrationsSearchBar = document.getElementById('admin-search-bar-registrations');
        if (trialsSearchBar) trialsSearchBar.classList.add('hidden');
        if (registrationsSearchBar) registrationsSearchBar.classList.add('hidden');
        
        // Load appropriate data based on tab
        if (tab === 'trials') {
            // Show trials search bar
            if (trialsSearchBar) trialsSearchBar.classList.remove('hidden');
            fetchAdminTrials();
        } else if (tab === 'registrations') {
            // Show registrations search bar
            if (registrationsSearchBar) registrationsSearchBar.classList.remove('hidden');
            fetchPendingRegistrations();
        } else if (tab === 'inbox') {
            // Inbox tab shows messages/conversations
            fetchAdminInbox();
        } else if (tab === 'batches') {
            fetchDeclinedRegistrations();
        } else if (tab === 'attendance') {
            loadAdminAttendanceView();
        }
    };
    
    // Load Data - Start with trials tab
    window.switchTab('trials');
}

// --- 2. ADMIN TABS UPDATE ---
function updateAdminTabs() {
    const trialsTab = document.getElementById('tab-btn-trials');
    const registrationsTab = document.getElementById('tab-btn-registrations');
    const inboxTab = document.getElementById('tab-btn-inbox');
    const batchesTab = document.getElementById('tab-btn-batches');
    const attendanceTab = document.getElementById('tab-btn-attendance');
    
    if (trialsTab) {
        trialsTab.innerHTML = '<i class="fas fa-clipboard-list mr-2"></i>Trials';
        trialsTab.onclick = () => { window.switchTab('trials'); };
    }
    if (registrationsTab) {
        registrationsTab.innerHTML = '<i class="fas fa-file-invoice-dollar mr-2"></i>Registrations';
        registrationsTab.onclick = () => { window.switchTab('registrations'); };
    }
    if (inboxTab) {
        inboxTab.innerHTML = '<i class="fas fa-inbox mr-2"></i>Messages';
        inboxTab.onclick = () => { window.switchTab('inbox'); };
    }
    if (batchesTab) {
        batchesTab.innerHTML = '<i class="fas fa-user-times mr-2"></i>Declined';
        batchesTab.onclick = () => { window.switchTab('batches'); };
    }
    if (attendanceTab) {
        attendanceTab.innerHTML = '<i class="fas fa-users mr-2"></i>All Students';
        attendanceTab.onclick = () => { window.switchTab('attendance'); };
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
            // Use Promise.all for async filtering
            const filteredResults = await Promise.all(
                filteredData.map(async (lead) => {
                    if (lead.status !== 'Enrolled') return { lead, include: false };
                    
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
                    
                    if (!packageMonths) return { lead, include: false };
                    
                    // Calculate expiry date using first attendance date, not expected start date
                    const firstAttendanceDate = await getFirstAttendanceDate(lead.id);
                    // Use first attendance date if available, otherwise fallback to expected start date or created_at
                    let startDate;
                    if (firstAttendanceDate) {
                        startDate = new Date(firstAttendanceDate);
                    } else {
                        // Try to get expected_start_date from metadata
                        const metaMatch = lead.parent_note?.match(/\[PACKAGE_META\](.*?)\[\/PACKAGE_META\]/);
                        if (metaMatch) {
                            try {
                                const meta = JSON.parse(metaMatch[1]);
                                if (meta.expected_start_date) {
                                    startDate = new Date(meta.expected_start_date);
                                } else {
                                    startDate = new Date(lead.created_at);
                                }
                            } catch (e) {
                                startDate = new Date(lead.created_at);
                            }
                        } else {
                            startDate = new Date(lead.created_at);
                        }
                    }
                    const expiryDate = new Date(startDate);
                    expiryDate.setMonth(expiryDate.getMonth() + (packageMonths || 0));
                    
                    if (adminFilters.expiryDateFrom && expiryDate < new Date(adminFilters.expiryDateFrom)) return { lead, include: false };
                    if (adminFilters.expiryDateTo && expiryDate > new Date(adminFilters.expiryDateTo)) return { lead, include: false };
                    return { lead, include: true };
                })
            );
            filteredData = filteredResults.filter(r => r.include).map(r => r.lead);
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
    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border-l-4 border-yellow-400 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                ${photoThumbnail}
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 hover:text-purple-600 transition">${lead.child_name} <span class="text-xs font-normal text-slate-500">(${lead.gender})</span> <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i></h4>
                    <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                    <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone || 'N/A'}</p>
                </div>
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
    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
    return `
    <div class="bg-slate-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                ${photoThumbnail}
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 hover:text-purple-600 transition">${lead.child_name} <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i></h4>
                    <p class="text-xs text-slate-500">${lead.parent_name}</p>
                </div>
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

// --- 2. FETCH PENDING REGISTRATIONS ---
export async function fetchPendingRegistrations() {
    const listPending = document.getElementById('list-pending-registrations'); 
    const listEnrolled = document.getElementById('list-enrolled-students');
    
    if (!listPending) return;

    listPending.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading registrations...</p>';
    if (listEnrolled) listEnrolled.innerHTML = '';

    try {
        // Fetch all leads that need admin attention or are enrolled
        // Include: Registration Requested, Enrollment Requested, Ready to Pay (only if finance enabled), and Enrolled
        // Order by created_at descending to show latest cards first
        const statusesToFetch = ['Registration Requested', 'Enrollment Requested', 'Enrolled', 'Trial Completed'];
        if (ENABLE_FINANCE_FEATURES) {
            statusesToFetch.push('Ready to Pay');
        }
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .in('status', statusesToFetch)
            .order('created_at', { ascending: false })
            .limit(200); // Increased limit to ensure we get all pending registrations

        if (error) {
            console.error('Database error:', error);
            throw error;
        }

        listPending.innerHTML = ''; 
        if (listEnrolled) listEnrolled.innerHTML = '';

        if (!data || data.length === 0) { 
            listPending.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No pending registrations.</p>'; 
            if (listEnrolled) listEnrolled.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No enrolled students yet.</p>';
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
            
            const canEnroll = lead.status === 'Registration Requested' || lead.status === 'Enrollment Requested' || lead.status === 'Trial Completed' || (ENABLE_FINANCE_FEATURES && lead.status === 'Ready to Pay');
            if (canEnroll) {
                listPending.innerHTML += createVerificationCard(lead, isNew);
                pendingCount++;
            } else if (lead.status === 'Enrolled') {
                if (listEnrolled) listEnrolled.innerHTML += createEnrolledCard(lead);
                enrolledCount++;
            }
        });
        
        if (pendingCount === 0) {
            listPending.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No pending registrations. All clear! 🎉</p>';
        }
        
        if (enrolledCount === 0 && listEnrolled) {
            listEnrolled.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No enrolled students yet.</p>';
        }

    } catch (err) {
        console.error("Admin Fetch Error:", err);
        listPending.innerHTML = `<p class="text-red-500 text-sm">System Error: ${err.message}</p>`;
    }
}

// Handle search for registrations tab
window.handleAdminSearchRegistrations = function() {
    const searchInput = document.getElementById('admin-search-input-registrations');
    if (searchInput) {
        // Filter registrations based on search
        const searchTerm = searchInput.value.trim().toLowerCase();
        const pendingCards = document.querySelectorAll('#list-pending-registrations > div');
        const enrolledCards = document.querySelectorAll('#list-enrolled-students > div');
        
        [...pendingCards, ...enrolledCards].forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(searchTerm) || !searchTerm) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }
};

// --- ADMIN INBOX: View all conversations (trainer-parent, admin-parent, admin-trainer) ---
export async function fetchAdminInbox() {
    const container = document.getElementById('list-inbox');
    if (!container) return;
    
    container.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse">Loading conversations...</p>';
    
    try {
        // Fetch ALL messages with lead details
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`*, leads (id, child_name, parent_name, email, phone)`)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Messages fetch error:', error);
            container.innerHTML = `<p class="text-red-500 text-sm">Error loading messages: ${error.message}</p>`;
            return;
        }
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-slate-400">No conversations yet.</div>';
            return;
        }
        
        // Group messages by lead_id and sender_role to create conversations
        const conversations = {};
        let globalUnread = 0;
        
        messages.forEach(msg => {
            if (!msg.leads) return;
            const lid = msg.leads.id;
            const convKey = `${lid}_${msg.sender_role}`; // Separate conversations for trainer and admin with same parent
            
            if (!conversations[convKey]) {
                conversations[convKey] = {
                    leadId: lid,
                    details: msg.leads,
                    senderRole: msg.sender_role,
                    lastMessage: msg,
                    unread: 0,
                    messages: []
                };
            }
            
            conversations[convKey].messages.push(msg);
            
            // Update last message if this is more recent
            if (new Date(msg.created_at) > new Date(conversations[convKey].lastMessage.created_at)) {
                conversations[convKey].lastMessage = msg;
            }
            
            // Count unread messages (not from admin and not read)
            if (msg.sender_role !== 'admin' && !msg.is_read) {
                conversations[convKey].unread++;
                globalUnread++;
            }
        });
        
        // Sort conversations: unread first, then by most recent message
        const sortedConversations = Object.values(conversations).sort((a, b) => {
            if (a.unread > 0 && b.unread === 0) return -1;
            if (a.unread === 0 && b.unread > 0) return 1;
            return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
        });
        
        // Add filter buttons
        const filterContainer = document.getElementById('inbox-filters');
        if (filterContainer) {
            filterContainer.innerHTML = `
                <button onclick="window.filterAdminInbox('all')" id="admin-filter-all" class="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">All</button>
                <button onclick="window.filterAdminInbox('unread')" id="admin-filter-unread" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700">Unread</button>
                <button onclick="window.filterAdminInbox('read')" id="admin-filter-read" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700">Read</button>
            `;
        }
        
        // Store conversations globally for filtering
        window.adminConversations = sortedConversations;
        window.currentAdminInboxFilter = 'all';
        
        renderAdminInbox(sortedConversations);
        
    } catch (e) {
        console.error("Admin Inbox Error:", e);
        container.innerHTML = `<p class="text-red-500 text-sm">Error: ${e.message}</p>`;
    }
}

// Render admin inbox with filtering
function renderAdminInbox(conversations) {
    const container = document.getElementById('list-inbox');
    if (!container) return;
    
    const filter = window.currentAdminInboxFilter || 'all';
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
        const senderLabel = conv.senderRole === 'trainer' ? 'Trainer' : conv.senderRole === 'admin' ? 'Admin' : 'Parent';
        const senderIcon = conv.senderRole === 'trainer' ? '👨‍🏫' : conv.senderRole === 'admin' ? '👤' : '👨‍👩‍👧';
        
        const photoThumbnail = getChildPhotoThumbnail(conv.details, 'w-10 h-10');
        container.innerHTML += `
            <div onclick="window.openChat('${leadString}')" class="cursor-pointer p-4 border-b border-slate-100 flex justify-between items-center ${unreadClass} transition">
                <div class="flex items-center flex-1">
                    ${photoThumbnail}
                    <div class="overflow-hidden flex-1 ml-3">
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="font-bold text-slate-800 text-sm">${conv.details.parent_name}</h4>
                            <span class="text-xs text-slate-500">${senderIcon} ${senderLabel}</span>
                        </div>
                        <p class="text-xs text-slate-500 truncate">${conv.lastMessage.sender_role === 'admin' ? 'You: ' : conv.lastMessage.sender_role === 'trainer' ? 'Trainer: ' : 'Parent: '}${conv.lastMessage.message_text}</p>
                    </div>
                </div>
                ${conv.unread > 0 ? `<span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">${conv.unread}</span>` : ''}
            </div>`;
    });
}

// Filter admin inbox function
window.filterAdminInbox = function(filter) {
    window.currentAdminInboxFilter = filter;
    const conversations = window.adminConversations || [];
    renderAdminInbox(conversations);
    
    // Update button styles
    ['all', 'unread', 'read'].forEach(f => {
        const btn = document.getElementById(`admin-filter-${f}`);
        if (btn) {
            if (f === filter) {
                btn.classList.remove('bg-slate-200', 'text-slate-700');
                btn.classList.add('bg-blue-600', 'text-white');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-slate-200', 'text-slate-700');
            }
        }
    });
}

// --- 3. CARDS ---

function createVerificationCard(lead, isNew = false) {
    const statusColors = {
        'Trial Completed': 'bg-blue-100 text-blue-700',
        'Enrollment Requested': 'bg-orange-100 text-orange-700',
        'Registration Requested': 'bg-purple-100 text-purple-700',
        'Ready to Pay': 'bg-green-100 text-green-700',
        'Enrolled': 'bg-emerald-100 text-emerald-700'
    };
    const statusColor = statusColors[lead.status] || 'bg-purple-100 text-purple-700';
    const newBadge = isNew ? '<span class="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW!</span>' : '';
    
    // Get final_price from metadata
    const finalPrice = getFinalPrice(lead);
    const meta = getPackageMetadata(lead);
    const selectedPkg = meta?.selected_package || lead.selected_package;
    const hasPackage = selectedPkg || finalPrice;
    // Get payment_mode from metadata (stored in parent_note) - only if finance features enabled
    const paymentMode = ENABLE_FINANCE_FEATURES ? (meta?.payment_mode || lead.payment_mode || null) : null;
    // Show payment actions for Registration Requested status (both UPI and Cash) - only if finance features enabled
    const showPaymentActions = ENABLE_FINANCE_FEATURES && lead.status === 'Registration Requested' && (lead.payment_proof_url || paymentMode === 'Cash');
    
    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
    
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${isNew ? 'border-red-500 bg-red-50' : 'border-purple-500'} mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                ${photoThumbnail}
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 hover:text-purple-600 transition">${lead.child_name}${newBadge} <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i></h4>
                    <p class="text-xs text-slate-500">Parent: ${lead.parent_name}</p>
                    <p class="text-xs text-slate-500 font-mono mt-1">${lead.phone || 'N/A'}</p>
                </div>
            </div>
            <span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded">${lead.status || 'Pending'}</span>
        </div>
        
        <div class="bg-slate-50 p-3 rounded border border-slate-100 text-xs mb-3">
            <p><strong>Status:</strong> ${lead.status || 'N/A'}</p>
            ${hasPackage ? `
                <p><strong>Package:</strong> ${selectedPkg || lead.recommended_batch || 'Not Set'}</p>
                ${ENABLE_FINANCE_FEATURES ? `<p><strong>Amount:</strong> ₹${finalPrice || meta?.package_price || lead.package_price || '0'}</p>` : ''}
            ` : `
                <p><strong>Recommended Batch:</strong> ${lead.recommended_batch || 'Not Set'}</p>
                <p class="text-orange-600"><strong>Action:</strong> Set package${ENABLE_FINANCE_FEATURES ? ' and pricing' : ''}</p>
            `}
            ${lead.start_date ? `<p><strong>Start Date:</strong> ${lead.start_date}</p>` : ''}
            ${ENABLE_FINANCE_FEATURES && paymentMode ? `<p><strong>Payment Mode:</strong> ${paymentMode}</p>` : ''}
            ${meta?.pt_request ? `
                <div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                    <p class="font-bold text-amber-900 mb-1"><i class="fas fa-dumbbell mr-1"></i> Personal Training Request</p>
                    <p><strong>Preferred Start:</strong> ${new Date(meta.pt_request.preferred_start_date).toLocaleDateString('en-IN')}</p>
                    ${meta.pt_request.notes ? `<p><strong>Notes:</strong> ${meta.pt_request.notes}</p>` : ''}
                    <p class="text-xs text-amber-700 mt-1">Admin to set: Rate per session, Number of sessions, Validity period</p>
                </div>
            ` : ''}
            ${ENABLE_FINANCE_FEATURES && lead.payment_proof_url ? `
                <div class="mt-2">
                    <a href="${lead.payment_proof_url}" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800">
                        <i class="fas fa-paperclip mr-1"></i> View Payment Screenshot
                    </a>
                </div>
            ` : ENABLE_FINANCE_FEATURES && paymentMode === 'Cash' ? `
                <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p class="text-xs text-green-800 font-semibold"><i class="fas fa-money-bill-wave mr-1"></i> Cash Payment - Verify on first day</p>
                </div>
            ` : ''}
        </div>

        <div class="flex gap-2 mb-2">
            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                <i class="fas fa-cog mr-1"></i> ${hasPackage ? 'Modify Package' : 'Set Package'}
            </button>
            <button onclick="window.openChat('${encodeURIComponent(JSON.stringify(lead))}')" class="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded hover:bg-slate-700 transition">
                <i class="fas fa-comment mr-1"></i> Message
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
    let selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
    
    // Remove price from package name if finance features are disabled
    if (!ENABLE_FINANCE_FEATURES && selectedPkg !== 'Not Set') {
        selectedPkg = selectedPkg.replace(/\s*-\s*₹\d+.*$/, '').replace(/\s*@\s*₹\d+\/session/gi, '').trim();
    }
    
    // Get end date (renewal date) - use actual_end_date if available, otherwise calculate from start date + months
    let endDate = null;
    let startDate = null;
    
    if (meta?.actual_end_date) {
        endDate = new Date(meta.actual_end_date);
    } else if (meta?.actual_start_date && meta?.package_months) {
        startDate = new Date(meta.actual_start_date);
        const calculatedEnd = new Date(startDate);
        calculatedEnd.setMonth(calculatedEnd.getMonth() + meta.package_months);
        endDate = calculatedEnd;
    } else if (meta?.expected_start_date && meta?.package_months) {
        startDate = new Date(meta.expected_start_date);
        const calculatedEnd = new Date(startDate);
        calculatedEnd.setMonth(calculatedEnd.getMonth() + meta.package_months);
        endDate = calculatedEnd;
    } else if (meta?.pt_details?.validity_end_date) {
        endDate = new Date(meta.pt_details.validity_end_date);
    }
    
    const formattedEndDate = endDate ? endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Set';
    
    // Get batch
    const batch = lead.recommended_batch || 'Not Set';
    
    // Get classes/sessions info
    const totalClasses = meta?.package_classes || meta?.pt_details?.sessions || null;
    const remainingClasses = meta?.remaining_classes !== undefined ? meta.remaining_classes : null;
    
    // Calculate age
    const age = lead.dob ? calculateAge(lead.dob) : null;
    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
    
    return `
    <div class="bg-white p-4 rounded-lg border border-slate-200 border-l-4 border-green-500 mb-3 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                ${photoThumbnail}
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 text-sm hover:text-purple-600 transition mb-1">
                        ${lead.child_name} <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i>
                </h4>
                <div class="text-xs text-slate-600 space-y-1">
                    <div><strong>Package:</strong> ${selectedPkg}</div>
                    <div><strong>Batch:</strong> ${batch}</div>
                    ${age ? `<div><strong>Age:</strong> ${age} years</div>` : ''}
                    <div><strong>End Date:</strong> <span class="font-bold text-blue-700">${formattedEndDate}</span></div>
                    ${totalClasses !== null ? `
                        <div class="mt-1">
                            <strong>Classes:</strong> 
                            ${remainingClasses !== null ? `<span class="text-green-700">${remainingClasses}/${totalClasses}</span>` : `<span>${totalClasses}</span>`}
                        </div>
                    ` : ''}
                </div>
            </div>
            <span class="text-green-700 text-[10px] font-bold uppercase bg-green-50 px-2 py-1 rounded">Active</span>
        </div>
        <div class="flex gap-2 mt-2">
            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                <i class="fas fa-cog mr-1"></i> Modify Package
            </button>
            <button onclick="window.openChat('${encodeURIComponent(JSON.stringify(lead))}')" class="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded hover:bg-slate-700 transition">
                <i class="fas fa-comment mr-1"></i> Message
            </button>
        </div>
    </div>`;
}

// --- 4. ACTIONS ---

export async function approvePayment(leadId) {
    // Safety check: Don't allow payment approval if finance features are disabled
    if (!ENABLE_FINANCE_FEATURES) {
        showErrorModal("Feature Disabled", "Finance features are currently disabled.");
        return;
    }
    
    try {
        // Fetch lead details to get payment mode and other info
        const { data: lead, error: fetchError } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();
        
        if (fetchError || !lead) {
            showErrorModal("Error", "Could not fetch student details.");
            return;
        }
        
        const meta = getPackageMetadata(lead);
        const paymentMode = meta?.payment_mode || lead.payment_mode || null;
        const paymentProofUrl = lead.payment_proof_url;
        const finalPrice = getFinalPrice(lead);
        const selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
        
        // Get current admin name
        const currentAdminName = document.getElementById('user-role-badge')?.innerText || 'Admin';
        
        // Fetch team members (admin and trainer roles)
        const { data: teamMembers } = await supabaseClient
            .from('user_roles')
            .select('full_name, role')
            .in('role', ['admin', 'trainer'])
            .order('full_name');
        
        const teamList = teamMembers || [];
        const defaultTeamMember = currentAdminName;
        
        // Create comprehensive approval modal
        const approvalData = await new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay z-50';
            modal.innerHTML = `
                <div class="modal-content max-w-2xl">
                    <h3 class="text-xl font-bold mb-4 text-green-700"><i class="fas fa-check-circle mr-2"></i>Verify Payment & Enroll Student</h3>
                    
                    <div class="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
                        <h4 class="font-bold text-blue-900 mb-2 text-sm">Student Information</h4>
                        <p class="text-sm text-blue-800"><strong>Name:</strong> ${lead.child_name}</p>
                        <p class="text-sm text-blue-800"><strong>Parent:</strong> ${lead.parent_name}</p>
                        <p class="text-sm text-blue-800"><strong>Package:</strong> ${selectedPkg}</p>
                        ${ENABLE_FINANCE_FEATURES ? `<p class="text-sm text-blue-800"><strong>Total Amount:</strong> ₹${finalPrice || '0'}</p>` : ''}
                    </div>
                    
                    <div class="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-4">
                        <h4 class="font-bold text-purple-900 mb-3 text-sm">Payment Verification Details</h4>
                        
                        <div class="mb-3">
                            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Payment Mode</label>
                            <div class="bg-white p-3 rounded-lg border border-purple-200">
                                <span class="font-bold text-purple-700">${paymentMode || 'Not Specified'}</span>
                            </div>
                        </div>
                        
                        ${paymentProofUrl ? `
                        <div class="mb-3">
                            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Payment Proof</label>
                            <div class="bg-white p-3 rounded-lg border border-purple-200">
                                <a href="${paymentProofUrl}" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800 flex items-center">
                                    <i class="fas fa-paperclip mr-2"></i> View Payment Screenshot
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${paymentMode === 'Cash' ? `
                        <div class="mb-3">
                            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Payment Collected By *</label>
                            <select id="payment-collected-by" class="input-field w-full" required>
                                ${teamList.map(member => 
                                    `<option value="${member.full_name || member.email}" ${(member.full_name || member.email) === defaultTeamMember ? 'selected' : ''}>${member.full_name || member.email} (${member.role})</option>`
                                ).join('')}
                                ${teamList.length === 0 ? `<option value="${defaultTeamMember}" selected>${defaultTeamMember} (Admin)</option>` : ''}
                            </select>
                            <p class="text-xs text-slate-500 mt-1">Select who collected the cash payment</p>
                        </div>
                        ` : ''}
                        
                        <div class="mb-3">
                            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Verification Notes (Optional)</label>
                            <textarea id="verification-notes" rows="3" class="input-field w-full" placeholder="Any additional notes about payment verification, receipt number, transaction ID, etc."></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Verification Date</label>
                            <input type="date" id="verification-date" class="input-field w-full" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 mt-6">
                        <button onclick="const data = { collectedBy: document.getElementById('payment-collected-by')?.value || '${defaultTeamMember}', notes: document.getElementById('verification-notes').value, date: document.getElementById('verification-date').value }; this.closest('.modal-overlay').remove(); window.__adminApprovalResolve(data)" class="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-check mr-2"></i>Verify & Enroll
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove(); window.__adminApprovalResolve(null)" class="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-300 transition">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            window.__adminApprovalResolve = resolve;
        });
        
        if (!approvalData) return;
        
        // Build verification metadata
        const verificationMeta = {
            verified_by: currentAdminName,
            verified_date: approvalData.date,
            payment_collected_by: approvalData.collectedBy || currentAdminName,
            verification_notes: approvalData.notes || null,
            payment_mode: paymentMode,
            verified_at: new Date().toISOString()
        };
        
        // Store verification details in parent_note metadata
        const existingNote = lead.parent_note || '';
        const verificationNote = `[VERIFICATION_META]${JSON.stringify(verificationMeta)}[/VERIFICATION_META]`;
        const cleanedNote = existingNote.replace(/\[VERIFICATION_META\].*?\[\/VERIFICATION_META\]/g, '').trim();
        const updatedNote = cleanedNote ? `${cleanedNote}\n${verificationNote}` : verificationNote;
        
        // Update lead with enrollment status and verification metadata
        const { error } = await supabaseClient
            .from('leads')
            .update({ 
                status: 'Enrolled', 
                payment_status: 'Paid',
                parent_note: updatedNote
            })
            .eq('id', leadId);

        if (error) throw error;

        showSuccessModal("Student Enrolled!", `Payment verified by ${approvalData.collectedBy || currentAdminName}. Student is now enrolled.`);
        fetchPendingRegistrations(); 

    } catch (err) {
        showErrorModal("Approval Failed", err.message);
    }
}

export async function rejectPayment(leadId) {
    // Safety check: Don't allow payment rejection if finance features are disabled
    if (!ENABLE_FINANCE_FEATURES) {
        showErrorModal("Feature Disabled", "Finance features are currently disabled.");
        return;
    }
    
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

/**
 * Get the first attendance date for a student
 * @param {number} studentId - Student lead ID
 * @returns {Promise<string|null>} First attendance date in YYYY-MM-DD format, or null if no attendance
 */
async function getFirstAttendanceDate(studentId) {
    try {
        const attendanceHistory = await getAttendanceHistory(studentId);
        if (!attendanceHistory || attendanceHistory.length === 0) {
            return null;
        }
        
        // Get all attendance dates and sort them
        const dates = attendanceHistory
            .map(record => record.attendance_date || record.date)
            .filter(date => date)
            .sort();
        
        return dates.length > 0 ? dates[0] : null;
    } catch (error) {
        console.warn('Error getting first attendance date:', error);
        return null;
    }
}

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
        let selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
        const packagePrice = meta?.package_price || lead.package_price || 0;
        const finalPrice = getFinalPrice(lead);
        
        // Remove price from package name if finance features are disabled
        if (!ENABLE_FINANCE_FEATURES && selectedPkg !== 'Not Set') {
            // Remove price patterns: " - ₹1234", " @ ₹123/session", "@ ₹123/session"
            selectedPkg = selectedPkg.replace(/\s*-\s*₹\d+.*$/, '').replace(/\s*@\s*₹\d+\/session/gi, '').trim();
        }
        
        document.getElementById('admin-pkg-current-package').innerText = selectedPkg;
        if (ENABLE_FINANCE_FEATURES) {
            document.getElementById('admin-pkg-current-price').innerText = finalPrice || packagePrice || '₹0';
        } else {
            document.getElementById('admin-pkg-current-price').innerText = 'N/A';
        }
        const isLocked = meta?.package_locked || lead.package_locked || false;
        document.getElementById('admin-pkg-current-locked').innerText = isLocked ? 'Yes' : 'No';

        // Determine and default package type based on current selection
        let defaultPkgType = '';
        let defaultPkgValue = '';
        
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
            defaultPkgType = 'pt';
        } else {
            ptRequestInfo.classList.add('hidden');
            
            // Try to determine package type from current selection
            // First check if package_id is stored in metadata for accurate matching
            if (meta?.package_id) {
                // Check if it's a standard package ID
                const standardPkg = STANDARD_PACKAGES.find(p => p.id === meta.package_id);
                if (standardPkg) {
                    defaultPkgType = 'standard';
                    defaultPkgValue = `${standardPkg.id}|${standardPkg.price}|${standardPkg.classes}|${standardPkg.months}`;
                } else if (meta.package_id.startsWith('morn_')) {
                    defaultPkgType = 'morning';
                    defaultPkgValue = 'morn_child|5500|999|1';
                } else if (meta.package_id.startsWith('pt_') || meta.package_id.includes('pt')) {
                    defaultPkgType = 'pt';
                }
            } else if (selectedPkg && selectedPkg !== 'Not Set') {
                // Fallback: Try to match by label text
                const pkgLower = selectedPkg.toLowerCase();
                // Remove amount part if present (e.g., "1 Month - 8 Classes - ₹3500" -> "1 Month - 8 Classes")
                const pkgLabelOnly = selectedPkg.split(' - ₹')[0].trim().toLowerCase();
                
                if (pkgLower.includes('morning') || (pkgLower.includes('unlimited') && pkgLower.includes('morning'))) {
                    defaultPkgType = 'morning';
                    defaultPkgValue = 'morn_child|5500|999|1';
                } else if (pkgLower.includes('personal training') || pkgLower.includes('pt') || pkgLower.includes('personal')) {
                    defaultPkgType = 'pt';
                } else {
                    // Check if it matches any standard package by label
                    let foundStandard = false;
                    for (const pkg of STANDARD_PACKAGES) {
                        const pkgLabelLower = pkg.label.toLowerCase();
                        // Match by label (with or without amount)
                        if (pkgLabelOnly.includes(pkgLabelLower) || pkgLabelLower.includes(pkgLabelOnly) || 
                            selectedPkg.includes(pkg.label) || selectedPkg.includes(pkg.id)) {
                            defaultPkgType = 'standard';
                            defaultPkgValue = `${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}`;
                            foundStandard = true;
                            break;
                        }
                    }
                    if (!foundStandard && selectedPkg !== 'Not Set') {
                        defaultPkgType = 'custom';
                    }
                }
            }
        }
        
        // Set default package type and trigger update
        if (defaultPkgType) {
            document.getElementById('admin-pkg-type').value = defaultPkgType;
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                window.updateAdminPackageOptions();
                
                // Set default package value after options are populated
                setTimeout(() => {
                    if (defaultPkgType === 'standard' && defaultPkgValue) {
                        const standardSelect = document.getElementById('admin-pkg-standard-select');
                        if (standardSelect) standardSelect.value = defaultPkgValue;
                    } else if (defaultPkgType === 'morning') {
                        const morningSelect = document.getElementById('admin-pkg-morning-select');
                        if (morningSelect) morningSelect.value = 'morn_child|5500|999|1';
                    } else if (defaultPkgType === 'pt' && meta?.pt_request) {
                        // Pre-fill PT details from metadata if available
                        if (ENABLE_FINANCE_FEATURES && meta.pt_request.rate_per_session) {
                            const ptRate = document.getElementById('admin-pkg-pt-rate');
                            if (ptRate) ptRate.value = meta.pt_request.rate_per_session;
                        }
                        if (meta.pt_request.sessions) {
                            const ptSessions = document.getElementById('admin-pkg-pt-sessions');
                            if (ptSessions) ptSessions.value = meta.pt_request.sessions;
                        }
                    }
                    window.calculateAdminPackageTotal();
                }, 100);
            }, 50);
        } else {
            document.getElementById('admin-pkg-type').value = '';
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
        
        // Hide fee-related sections if finance features disabled
        if (!ENABLE_FINANCE_FEATURES) {
            const customFeeSection = document.getElementById('admin-custom-fee-section');
            const feeDisplaySection = document.getElementById('admin-pkg-fee-display-section');
            const priceRow = document.getElementById('admin-pkg-current-price-row');
            const customPriceContainer = document.getElementById('admin-pkg-custom-price-container');
            if (customFeeSection) customFeeSection.classList.add('hidden');
            if (feeDisplaySection) feeDisplaySection.classList.add('hidden');
            if (priceRow) priceRow.classList.add('hidden');
            if (customPriceContainer) customPriceContainer.classList.add('hidden');
        } else {
            const customFeeSection = document.getElementById('admin-custom-fee-section');
            const feeDisplaySection = document.getElementById('admin-pkg-fee-display-section');
            const priceRow = document.getElementById('admin-pkg-current-price-row');
            const customPriceContainer = document.getElementById('admin-pkg-custom-price-container');
            if (customFeeSection) customFeeSection.classList.remove('hidden');
            if (feeDisplaySection) feeDisplaySection.classList.remove('hidden');
            if (priceRow) priceRow.classList.remove('hidden');
            if (customPriceContainer) customPriceContainer.classList.remove('hidden');
        }
        
        // Update modal title based on finance features
        const modalTitle = document.getElementById('admin-package-modal-title');
        if (modalTitle) {
            if (ENABLE_FINANCE_FEATURES) {
                modalTitle.innerHTML = '<i class="fas fa-cog mr-2"></i> Modify Package & Pricing';
            } else {
                modalTitle.innerHTML = '<i class="fas fa-cog mr-2"></i> Modify Package';
            }
        }
        
        // Set minimum date for expected start date fields (today)
        const startDateFields = ['admin-pkg-standard-start-date', 'admin-pkg-morning-start-date', 'admin-pkg-custom-start-date', 'admin-pkg-pt-start-date'];
        startDateFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.min = new Date().toISOString().split('T')[0];
                // Pre-fill existing expected start date from metadata if available
                if (meta?.expected_start_date && fieldId !== 'admin-pkg-pt-start-date') {
                    field.value = meta.expected_start_date;
                }
            }
        });
        
        document.getElementById('admin-package-modal').classList.remove('hidden');
        window.calculateAdminPackageTotal();
        
        // Add event listeners for real-time calculation
        document.getElementById('admin-pkg-standard-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-morning-select')?.addEventListener('change', window.calculateAdminPackageTotal);
        document.getElementById('admin-pkg-pt-rate')?.addEventListener('input', window.calculateAdminPackageTotal);
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
            const priceText = ENABLE_FINANCE_FEATURES ? ` - ₹${pkg.price}` : '';
            select.innerHTML += `<option value="${pkg.id}|${pkg.price}|${pkg.classes}|${pkg.months}">${pkg.label}${priceText}</option>`;
        });
        document.getElementById('admin-pkg-standard-options').classList.remove('hidden');
    } else if (pkgType === 'morning') {
        document.getElementById('admin-pkg-morning-options').classList.remove('hidden');
        // Update morning dropdown option text based on finance flag
        const morningSelect = document.getElementById('admin-pkg-morning-select');
        if (morningSelect) {
            const priceText = ENABLE_FINANCE_FEATURES ? ' - ₹5500' : '';
            morningSelect.innerHTML = `<option value="morn_child|5500|999|1">Morning Unlimited${priceText}</option>`;
        }
    } else if (pkgType === 'pt') {
        document.getElementById('admin-pkg-pt-options').classList.remove('hidden');
        // Hide/show PT rate per session field based on finance flag
        const ptRateContainer = document.getElementById('admin-pkg-pt-rate-container');
        const ptRateSessionRow = document.getElementById('admin-pkg-pt-rate-session-row');
        if (ptRateContainer) {
            if (ENABLE_FINANCE_FEATURES) {
                ptRateContainer.classList.remove('hidden');
                // Ensure grid has 2 columns when rate is visible
                if (ptRateSessionRow) ptRateSessionRow.className = 'grid grid-cols-2 gap-4';
            } else {
                ptRateContainer.classList.add('hidden');
                // Change to single column when rate is hidden
                if (ptRateSessionRow) ptRateSessionRow.className = 'grid grid-cols-1 gap-4';
            }
        }
        // Set minimum date for start date (today)
        const startDateEl = document.getElementById('admin-pkg-pt-start-date');
        if (startDateEl) {
            startDateEl.min = new Date().toISOString().split('T')[0];
        }
    } else if (pkgType === 'custom') {
        document.getElementById('admin-pkg-custom-options').classList.remove('hidden');
        // Hide/show custom price field based on finance flag
        const customPriceContainer = document.getElementById('admin-pkg-custom-price-container');
        if (customPriceContainer) {
            if (ENABLE_FINANCE_FEATURES) {
                customPriceContainer.classList.remove('hidden');
                // Ensure grid has 2 columns when price is visible
                const customGrid = customPriceContainer.parentElement;
                if (customGrid && customGrid.classList.contains('grid')) {
                    customGrid.className = 'grid grid-cols-2 gap-4';
                }
            } else {
                customPriceContainer.classList.add('hidden');
                // Change to single column when price is hidden
                const customGrid = customPriceContainer.parentElement;
                if (customGrid && customGrid.classList.contains('grid')) {
                    customGrid.className = 'grid grid-cols-1 gap-4';
                }
            }
        }
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
    if (ENABLE_FINANCE_FEATURES) {
        document.getElementById('admin-pkg-reg-fee-display').innerText = regFee;
    }

    // Calculate base package fee
    if (pkgType === 'standard') {
        const val = document.getElementById('admin-pkg-standard-select').value;
        if (val) packageFee = parseInt(val.split('|')[1]);
    } else if (pkgType === 'morning') {
        const val = document.getElementById('admin-pkg-morning-select').value;
        if (val) packageFee = parseInt(val.split('|')[1]);
    } else if (pkgType === 'pt') {
        const rateEl = document.getElementById('admin-pkg-pt-rate');
        const rate = rateEl && !rateEl.closest('.hidden') ? (parseInt(rateEl.value) || 0) : 0;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        if (rate > 0) packageFee = rate * sessions;
    } else if (pkgType === 'custom') {
        packageFee = parseInt(document.getElementById('admin-pkg-custom-price').value) || 0;
    }

    // Check for package fee override
    const feeOverride = document.getElementById('admin-pkg-fee-override');
    const feeOverrideFlag = document.getElementById('admin-pkg-fee-override-flag');
    if (feeOverrideFlag && feeOverrideFlag.checked && feeOverride && feeOverride.value) {
        packageFee = parseInt(feeOverride.value) || packageFee;
    }
    
    if (ENABLE_FINANCE_FEATURES) {
        document.getElementById('admin-pkg-fee-display').innerText = packageFee;

        // Calculate total (add registration fee if not renewal)
        const status = document.getElementById('admin-pkg-status').innerText;
        let total = packageFee;
        if (status !== 'Enrolled' && packageFee > 0) {
            total += regFee;
        }

        document.getElementById('admin-pkg-total').innerText = total;
    } else {
        // Hide prices when finance features disabled
        document.getElementById('admin-pkg-fee-display').innerText = '-';
        document.getElementById('admin-pkg-total').innerText = '-';
        if (document.getElementById('admin-pkg-reg-fee-display')) {
            document.getElementById('admin-pkg-reg-fee-display').innerText = '-';
        }
    }
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
        
        // Get expected start date
        const expectedStartDate = document.getElementById('admin-pkg-standard-start-date').value;
        if (!expectedStartDate) {
            showErrorModal("Date Required", "Please select an expected start date.");
            return;
        }
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = pkg.label;
        packageMetadata.package_id = id; // Store package ID for future matching
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = parseInt(classes);
        packageMetadata.package_months = parseInt(months);
        packageMetadata.expected_start_date = expectedStartDate;
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
        
        // Get expected start date
        const expectedStartDate = document.getElementById('admin-pkg-morning-start-date').value;
        if (!expectedStartDate) {
            showErrorModal("Date Required", "Please select an expected start date.");
            return;
        }
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        packageMetadata.selected_package = pkg.label;
        packageMetadata.package_id = id; // Store package ID for future matching
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = parseInt(classes);
        packageMetadata.package_months = parseInt(months);
        packageMetadata.expected_start_date = expectedStartDate;
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
    } else if (pkgType === 'pt') {
        const rateEl = document.getElementById('admin-pkg-pt-rate');
        const rate = rateEl && !rateEl.closest('.hidden') ? (parseInt(rateEl.value) || 0) : 0;
        const sessions = parseInt(document.getElementById('admin-pkg-pt-sessions').value) || 0;
        const startDate = document.getElementById('admin-pkg-pt-start-date').value;
        const validityType = document.getElementById('admin-pkg-pt-validity-type').value;
        const validityDate = document.getElementById('admin-pkg-pt-validity-date').value;
        
        // Only validate rate if finance features are enabled (rate field is visible)
        if (ENABLE_FINANCE_FEATURES && (!rate || !sessions)) {
            showErrorModal("Input Required", "Please enter rate per session and number of sessions.");
            return;
        } else if (!ENABLE_FINANCE_FEATURES && !sessions) {
            showErrorModal("Input Required", "Please enter number of sessions.");
            return;
        }
        
        if (!startDate) {
            showErrorModal("Date Required", "Please select an expected start date for Personal Training.");
            return;
        }
        
        // For PT, expected start date is stored as start_date in pt_details
        // Note: Actual end date calculation will use first attendance date, not this expected start date
        
        const basePrice = rate * sessions;
        const finalPackagePrice = customFees.package_fee_override || basePrice;
        
        // Store ALL package data in metadata (columns may not exist)
        const calculatedFinalPrice = finalPackagePrice + (document.getElementById('admin-pkg-status').innerText !== 'Enrolled' ? regFee : 0);
        // Include rate in package name only if finance features are enabled
        if (ENABLE_FINANCE_FEATURES) {
            packageMetadata.selected_package = `PT - ${sessions} Classes @ ₹${rate}/session`;
        } else {
            packageMetadata.selected_package = `PT - ${sessions} Classes`;
        }
        packageMetadata.package_price = finalPackagePrice;
        packageMetadata.final_price = calculatedFinalPrice;
        packageMetadata.package_classes = sessions;
        packageMetadata.package_months = null; // PT uses specific dates
        packageMetadata.expected_start_date = startDate; // Store expected start date
        
        // Calculate validity end date for PT based on validity type
        let validityEndDate = null;
        if (validityType === 'specific') {
            if (validityDate) {
                validityEndDate = validityDate;
            }
        } else {
            const start = new Date(startDate);
            const months = validityType === 'month' ? 1 : validityType === 'quarter' ? 3 : validityType === 'halfyearly' ? 6 : 12;
            validityEndDate = new Date(start);
            validityEndDate.setMonth(validityEndDate.getMonth() + months);
            validityEndDate = validityEndDate.toISOString().split('T')[0];
        }
        
        packageMetadata.pt_details = {
            rate_per_session: rate,
            sessions: sessions,
            start_date: startDate, // This is expected start date
            validity_type: validityType,
            validity_end_date: validityEndDate // Store calculated validity end date
        };
        
        // For PT, if enrolling (finance disabled), set actual dates
        // Note: Actual end date will be recalculated based on first attendance date later
        if (!ENABLE_FINANCE_FEATURES) {
            packageMetadata.actual_start_date = startDate;
            packageMetadata.actual_end_date = validityEndDate; // Initial end date (may be updated based on first attendance)
            packageMetadata.remaining_classes = sessions; // Initialize remaining sessions
        }
        
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
        
        // Get expected start date
        const expectedStartDate = document.getElementById('admin-pkg-custom-start-date').value;
        if (!expectedStartDate) {
            showErrorModal("Date Required", "Please select an expected start date.");
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
        packageMetadata.expected_start_date = expectedStartDate;
        packageMetadata.package_locked = isLocked;
        packageMetadata.package_lock_type = isLocked ? lockType : null;
    }

    // Update status based on finance features flag and current status
    const currentStatus = document.getElementById('admin-pkg-status').innerText;
    
    // Handle status transitions for finance disabled scenarios
    if (!ENABLE_FINANCE_FEATURES) {
        // Scenario 1: Trial Completed → Admin sets package → Enrolled
        // Scenario 2: Registration Requested (parent submitted) → Admin verifies/sets package → Enrolled
        if (currentStatus === 'Trial Completed' || currentStatus === 'Registration Requested' || currentStatus === 'Enrollment Requested') {
            packageData.status = 'Enrolled';
            
            // When enrolling, set actual start date, end date, and classes
            // Start date is the expected_start_date entered by admin
            const startDate = packageMetadata.expected_start_date || packageMetadata.pt_details?.start_date;
            if (startDate) {
                packageMetadata.actual_start_date = startDate; // Store actual start date
                
                // Calculate end date for non-PT packages
                if (packageMetadata.package_months) {
                    const start = new Date(startDate);
                    const endDate = new Date(start);
                    endDate.setMonth(endDate.getMonth() + packageMetadata.package_months);
                    packageMetadata.actual_end_date = endDate.toISOString().split('T')[0]; // Store calculated end date
                } else if (packageMetadata.pt_details?.validity_end_date) {
                    // For PT packages, use validity end date
                    packageMetadata.actual_end_date = packageMetadata.pt_details.validity_end_date;
                }
            }
            
            // Ensure package classes/sessions are stored
            if (packageMetadata.package_classes) {
                packageMetadata.remaining_classes = packageMetadata.package_classes; // Initialize remaining classes
            } else if (packageMetadata.pt_details?.sessions) {
                packageMetadata.remaining_classes = packageMetadata.pt_details.sessions; // For PT, use sessions
            }
        }
    } else {
        // With finance features enabled
        if (currentStatus === 'Enrollment Requested' || currentStatus === 'Trial Completed') {
            packageData.status = 'Ready to Pay';
        }
        // Note: Registration Requested with finance enabled goes through payment verification flow
    }
    
    // Use recommended_batch instead of final_batch (which doesn't exist in DB)
    const currentBatch = document.getElementById('admin-pkg-current-batch').innerText;
    if (currentBatch && currentBatch !== 'Not Set') {
        packageData.recommended_batch = currentBatch;
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
        
        // Show appropriate success message and switch to appropriate tab
        const finalStatus = packageData.status || currentStatus;
        if (!ENABLE_FINANCE_FEATURES && finalStatus === 'Enrolled') {
            showSuccessModal("Enrollment Accepted!", "Student has been enrolled. Start date, end date, and classes have been set.");
            // Switch to registrations tab to show enrolled students
            window.switchTab('registrations');
            // Refresh registrations data
            setTimeout(() => {
                fetchPendingRegistrations();
                fetchAdminTrials(); // Also refresh trials in case student was moved from there
            }, 300);
        } else if (ENABLE_FINANCE_FEATURES && finalStatus === 'Ready to Pay') {
            showSuccessModal("Package Updated!", "Package details have been saved. Parent can now proceed with payment.");
            // Stay on registrations tab and refresh
            if (document.getElementById('view-registrations') && !document.getElementById('view-registrations').classList.contains('hidden')) {
                fetchPendingRegistrations();
            } else {
                fetchAdminTrials();
            }
        } else {
            showSuccessModal("Package Updated!", "Package details have been saved successfully.");
            // Refresh current tab
            if (document.getElementById('view-registrations') && !document.getElementById('view-registrations').classList.contains('hidden')) {
                fetchPendingRegistrations();
            } else if (document.getElementById('view-trials') && !document.getElementById('view-trials').classList.contains('hidden')) {
                fetchAdminTrials();
            }
        }

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
    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
    return `
    <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${isOverdue ? 'border-red-500' : 'border-orange-400'} mb-3">
        <div class="flex justify-between items-start mb-2">
            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                ${photoThumbnail}
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 hover:text-purple-600 transition">${lead.child_name} <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i></h4>
                    <p class="text-xs text-slate-500">${lead.parent_name} • ${lead.phone || 'N/A'}</p>
                </div>
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
    if (!container) {
        console.error('view-attendance container not found');
        return;
    }
    
    container.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse text-center p-8">Loading all students...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-sm text-center p-8">No students found.</p>';
            return;
        }
        
        // Group by status
        const grouped = {};
        data.forEach(lead => {
            const status = lead.status || 'Unknown';
            if (!grouped[status]) grouped[status] = [];
            grouped[status].push(lead);
        });
        
        let html = '<div class="p-4 md:p-6 space-y-6">';
        
        // Status summary cards
        html += `<div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold text-lg mb-4 text-slate-800">Total Students: ${data.length}</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">`;
        
        const statusOrder = ['Enrolled', 'Pending Trial', 'Trial Completed', 'Registration Requested', 'Enrollment Requested', 'Ready to Pay', 'Follow Up', 'Declined'];
        const statusColors = {
            'Enrolled': 'bg-green-50 text-green-700 border-green-200',
            'Pending Trial': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'Trial Completed': 'bg-blue-50 text-blue-700 border-blue-200',
            'Registration Requested': 'bg-purple-50 text-purple-700 border-purple-200',
            'Enrollment Requested': 'bg-orange-50 text-orange-700 border-orange-200',
            'Ready to Pay': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'Follow Up': 'bg-amber-50 text-amber-700 border-amber-200',
            'Declined': 'bg-red-50 text-red-700 border-red-200'
        };
        
        // Show statuses in order
        statusOrder.forEach(status => {
            if (grouped[status] && grouped[status].length > 0) {
                const colorClass = statusColors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
                html += `<div class="text-center p-3 ${colorClass} rounded-lg border-2">
                    <div class="text-2xl font-bold">${grouped[status].length}</div>
                    <div class="text-xs font-bold mt-1">${status}</div>
                </div>`;
            }
        });
        
        // Show other statuses not in the predefined order
        Object.keys(grouped).forEach(status => {
            if (!statusOrder.includes(status) && grouped[status].length > 0) {
                html += `<div class="text-center p-3 bg-slate-50 text-slate-700 rounded-lg border-2 border-slate-200">
                    <div class="text-2xl font-bold">${grouped[status].length}</div>
                    <div class="text-xs font-bold mt-1">${status}</div>
                </div>`;
            }
        });
        
        html += '</div></div>';
        
        // Show enrolled students with improved cards
        if (grouped['Enrolled'] && grouped['Enrolled'].length > 0) {
            html += '<div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">';
            html += '<h3 class="font-bold text-lg mb-4 text-slate-800 flex items-center">';
            html += `<i class="fas fa-check-circle text-green-600 mr-2"></i>Enrolled Students (${grouped['Enrolled'].length})`;
            html += '</h3><div class="space-y-3">';
            
            grouped['Enrolled'].forEach(lead => {
                html += createEnrolledCard(lead);
            });
            
            html += '</div></div>';
        }
        
        // Show other status groups (non-enrolled)
        statusOrder.forEach(status => {
            if (status !== 'Enrolled' && grouped[status] && grouped[status].length > 0) {
                const statusColor = statusColors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
                html += `<div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">`;
                html += `<h3 class="font-bold text-base md:text-lg mb-4 text-slate-800">${status} (${grouped[status].length})</h3>`;
                html += '<div class="space-y-3">';
                
                grouped[status].slice(0, 20).forEach(lead => {
                    const age = lead.dob ? calculateAge(lead.dob) : null;
                    const photoThumbnail = getChildPhotoThumbnail(lead, 'w-12 h-12');
                    html += `
                    <div class="bg-white p-3 md:p-4 rounded-lg border border-slate-200 hover:shadow-md transition">
                        <div class="flex justify-between items-start">
                            <div class="cursor-pointer flex-1 flex items-center gap-3" onclick="window.openStudentProfile('${lead.id}')">
                                ${photoThumbnail}
                                <div class="flex-1">
                                    <h4 class="font-bold text-sm md:text-base text-slate-800 hover:text-purple-600 transition mb-1">
                                        ${lead.child_name} <i class="fas fa-external-link-alt text-xs ml-1 text-purple-500"></i>
                                    </h4>
                                    <div class="text-xs text-slate-600 space-y-0.5">
                                        <div>${lead.parent_name} • ${lead.phone || 'N/A'}</div>
                                        ${age ? `<div>Age: ${age} years</div>` : ''}
                                        ${lead.recommended_batch ? `<div>Batch: ${lead.recommended_batch}</div>` : ''}
                                    </div>
                                </div>
                            </div>
                            <span class="${statusColor.split(' ')[0]} ${statusColor.split(' ')[1]} text-[10px] font-bold px-2 py-1 rounded">
                                ${status}
                            </span>
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button onclick="window.modifyAdminPackage('${lead.id}')" class="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 transition">
                                <i class="fas fa-cog mr-1"></i> ${status === 'Trial Completed' ? 'Set Package' : 'Modify'}
                            </button>
                            <button onclick="window.openChat('${encodeURIComponent(JSON.stringify(lead))}')" class="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded hover:bg-slate-700 transition">
                                <i class="fas fa-comment mr-1"></i> Message
                            </button>
                        </div>
                    </div>`;
                });
                
                if (grouped[status].length > 20) {
                    html += `<p class="text-xs text-slate-500 text-center pt-2">... and ${grouped[status].length - 20} more</p>`;
                }
                
                html += '</div></div>';
            }
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error("All Students Error:", err);
        container.innerHTML = `<p class="text-red-500 text-sm text-center p-8">Error: ${err.message}</p>`;
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

// --- STUDENT PROFILE VIEW ---
export async function openStudentProfile(leadId) {
    try {
        const container = document.getElementById('student-profile-content');
        container.innerHTML = '<p class="text-center text-slate-400">Loading student information...</p>';
        document.getElementById('student-profile-modal').classList.remove('hidden');
        
        // Fetch complete student data
        const { data: lead, error: leadError } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();
        
        if (leadError || !lead) {
            container.innerHTML = '<p class="text-red-500 text-center">Error loading student data.</p>';
            return;
        }
        
        // Fetch messages
        const { data: messages } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });
        
        // Parse metadata
        const meta = getPackageMetadata(lead);
        const verificationMeta = lead.parent_note?.match(/\[VERIFICATION_META\](.*?)\[\/VERIFICATION_META\]/);
        let verification = null;
        if (verificationMeta) {
            try {
                verification = JSON.parse(verificationMeta[1]);
            } catch (e) {
                console.warn('Could not parse verification metadata:', e);
            }
        }
        
        // Calculate age
        const age = calculateAge(lead.dob);
        const finalPrice = getFinalPrice(lead);
        const selectedPkg = meta?.selected_package || lead.selected_package || 'Not Set';
        const paymentMode = ENABLE_FINANCE_FEATURES ? (meta?.payment_mode || lead.payment_mode || null) : null;
        
        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A';
            try {
                return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            } catch (e) {
                return dateStr;
            }
        };
        
        // Build profile HTML
        let profileHTML = `
            <div class="space-y-6">
                <!-- Header Section -->
                <div class="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border-2 border-purple-200">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-2xl font-black text-purple-900 mb-1">${lead.child_name}</h2>
                            <p class="text-sm text-purple-700">${lead.parent_name} • ${lead.phone || 'N/A'}</p>
                        </div>
                        <span class="px-4 py-2 rounded-lg font-bold text-sm ${lead.status === 'Enrolled' ? 'bg-green-100 text-green-700' : lead.status === 'Trial Completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">${lead.status || 'Pending'}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><strong class="text-purple-900">Age:</strong> <span class="text-purple-700">${age} years</span></div>
                        <div><strong class="text-purple-900">DOB:</strong> <span class="text-purple-700">${formatDate(lead.dob)}</span></div>
                        <div><strong class="text-purple-900">Gender:</strong> <span class="text-purple-700">${lead.gender || 'N/A'}</span></div>
                        <div><strong class="text-purple-900">Email:</strong> <span class="text-purple-700">${lead.email || 'N/A'}</span></div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.modifyAdminPackage('${lead.id}')" class="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition">
                        <i class="fas fa-cog mr-1"></i> Modify Package
                    </button>
                    <button onclick="window.openChat('${encodeURIComponent(JSON.stringify(lead))}'); document.getElementById('student-profile-modal').classList.add('hidden');" class="px-4 py-2 bg-slate-600 text-white text-sm font-bold rounded-lg hover:bg-slate-700 transition">
                        <i class="fas fa-comment mr-1"></i> Messages
                    </button>
                    ${lead.status === 'Trial Completed' || lead.status === 'Enrolled' ? `
                    <button onclick="window.openAdminAssessment('${encodeURIComponent(JSON.stringify(lead))}'); document.getElementById('student-profile-modal').classList.add('hidden');" class="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition">
                        <i class="fas fa-clipboard-check mr-1"></i> View Assessment
                    </button>
                    ` : ''}
                    ${lead.status === 'Pending Trial' ? `
                    <button onclick="window.editAdminForm('${encodeURIComponent(JSON.stringify(lead))}'); document.getElementById('student-profile-modal').classList.add('hidden');" class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition">
                        <i class="fas fa-edit mr-1"></i> Edit Form
                    </button>
                    ` : ''}
                </div>
                
                <!-- Assessment Section -->
                ${lead.status === 'Trial Completed' || lead.status === 'Enrolled' ? `
                <div class="bg-blue-50 p-5 rounded-xl border-2 border-blue-200">
                    <h3 class="text-lg font-bold text-blue-900 mb-3 flex items-center">
                        <i class="fas fa-clipboard-check mr-2"></i> Trial Assessment
                    </h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong class="text-blue-900">Recommended Batch:</strong> <span class="text-blue-700">${lead.recommended_batch || 'Not Set'}</span></div>
                        <div><strong class="text-blue-900">Trial Date:</strong> <span class="text-blue-700">${formatDate(lead.trial_scheduled_slot?.split('|')[0])}</span></div>
                        ${lead.feedback ? `<div class="col-span-2"><strong class="text-blue-900">Feedback:</strong> <p class="text-blue-700 mt-1">${lead.feedback}</p></div>` : ''}
                        ${lead.skills_rating ? `
                        <div class="col-span-2">
                            <strong class="text-blue-900">Skills Observed:</strong>
                            <div class="flex flex-wrap gap-2 mt-2">
                                ${lead.skills_rating.listening ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">Listening</span>' : ''}
                                ${lead.skills_rating.flexibility ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">Flexibility</span>' : ''}
                                ${lead.skills_rating.strength ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">Strength</span>' : ''}
                                ${lead.skills_rating.balance ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">Balance</span>' : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <!-- Package & Payment Section -->
                ${selectedPkg !== 'Not Set' || finalPrice ? `
                <div class="bg-green-50 p-5 rounded-xl border-2 border-green-200">
                    <h3 class="text-lg font-bold text-green-900 mb-3 flex items-center">
                        <i class="fas fa-box mr-2"></i> Package & Payment
                    </h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong class="text-green-900">Package:</strong> <span class="text-green-700">${selectedPkg}</span></div>
                        ${ENABLE_FINANCE_FEATURES ? `<div><strong class="text-green-900">Total Amount:</strong> <span class="text-green-700">₹${finalPrice || '0'}</span></div>` : ''}
                        ${ENABLE_FINANCE_FEATURES ? `
                        <div><strong class="text-green-900">Payment Status:</strong> <span class="text-green-700">${lead.payment_status || 'Pending'}</span></div>
                        <div><strong class="text-green-900">Payment Mode:</strong> <span class="text-green-700">${paymentMode || 'N/A'}</span></div>
                        ` : ''}
                        ${meta?.start_date ? `<div><strong class="text-green-900">Start Date:</strong> <span class="text-green-700">${formatDate(meta.start_date)}</span></div>` : ''}
                        ${ENABLE_FINANCE_FEATURES && verification ? `
                        <div class="col-span-2 mt-3 p-3 bg-white rounded border border-green-300">
                            <strong class="text-green-900">Payment Verification:</strong>
                            <p class="text-xs text-green-700 mt-1"><strong>Verified by:</strong> ${verification.verified_by || 'N/A'}</p>
                            <p class="text-xs text-green-700"><strong>Verified on:</strong> ${formatDate(verification.verified_date)}</p>
                            ${verification.payment_collected_by ? `<p class="text-xs text-green-700"><strong>Collected by:</strong> ${verification.payment_collected_by}</p>` : ''}
                            ${verification.verification_notes ? `<p class="text-xs text-green-700 mt-2"><strong>Notes:</strong> ${verification.verification_notes}</p>` : ''}
                        </div>
                        ` : ''}
                        ${ENABLE_FINANCE_FEATURES && lead.payment_proof_url ? `
                        <div class="col-span-2">
                            <a href="${lead.payment_proof_url}" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800">
                                <i class="fas fa-paperclip mr-1"></i> View Payment Proof
                            </a>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <!-- Contact Information -->
                <div class="bg-slate-50 p-5 rounded-xl border-2 border-slate-200">
                    <h3 class="text-lg font-bold text-slate-900 mb-3 flex items-center">
                        <i class="fas fa-address-card mr-2"></i> Contact Information
                    </h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong class="text-slate-900">Parent Name:</strong> <span class="text-slate-700">${lead.parent_name}</span></div>
                        <div><strong class="text-slate-900">Phone:</strong> <span class="text-slate-700">${lead.phone || 'N/A'}</span></div>
                        <div><strong class="text-slate-900">Alternate Phone:</strong> <span class="text-slate-700">${lead.alternate_phone || 'N/A'}</span></div>
                        <div><strong class="text-slate-900">Email:</strong> <span class="text-slate-700">${lead.email || 'N/A'}</span></div>
                        <div class="col-span-2"><strong class="text-slate-900">Address:</strong> <span class="text-slate-700">${lead.address || 'N/A'}</span></div>
                    </div>
                </div>
                
                <!-- Medical Information -->
                ${lead.medical_info ? `
                <div class="bg-red-50 p-5 rounded-xl border-2 border-red-200">
                    <h3 class="text-lg font-bold text-red-900 mb-3 flex items-center">
                        <i class="fas fa-heartbeat mr-2"></i> Medical Information
                    </h3>
                    <p class="text-sm text-red-800">${lead.medical_info}</p>
                </div>
                ` : ''}
                
                <!-- Messages Section -->
                <div class="bg-indigo-50 p-5 rounded-xl border-2 border-indigo-200">
                    <h3 class="text-lg font-bold text-indigo-900 mb-3 flex items-center">
                        <i class="fas fa-comments mr-2"></i> Messages (${messages?.length || 0})
                    </h3>
                    ${messages && messages.length > 0 ? `
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        ${messages.slice(0, 10).map(msg => `
                            <div class="bg-white p-3 rounded-lg border border-indigo-200">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="text-xs font-bold ${msg.sender_role === 'admin' ? 'text-purple-600' : msg.sender_role === 'trainer' ? 'text-blue-600' : 'text-green-600'}">
                                        ${msg.sender_role === 'admin' ? '👤 Admin' : msg.sender_role === 'trainer' ? '👨‍🏫 Trainer' : '👨‍👩‍👧 Parent'}: ${msg.sender_name || 'Unknown'}
                                    </span>
                                    <span class="text-xs text-slate-500">${formatDate(msg.created_at)}</span>
                                </div>
                                <p class="text-sm text-slate-700">${msg.message_text}</p>
                            </div>
                        `).join('')}
                        ${messages.length > 10 ? `<p class="text-xs text-indigo-700 text-center mt-2">... and ${messages.length - 10} more messages</p>` : ''}
                    </div>
                    ` : '<p class="text-sm text-indigo-700">No messages yet.</p>'}
                </div>
                
                <!-- Additional Notes -->
                ${lead.parent_note && !lead.parent_note.includes('[PACKAGE_META]') && !lead.parent_note.includes('[VERIFICATION_META]') ? `
                <div class="bg-yellow-50 p-5 rounded-xl border-2 border-yellow-200">
                    <h3 class="text-lg font-bold text-yellow-900 mb-3 flex items-center">
                        <i class="fas fa-sticky-note mr-2"></i> Additional Notes
                    </h3>
                    <p class="text-sm text-yellow-800 whitespace-pre-wrap">${lead.parent_note}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = profileHTML;
    } catch (err) {
        console.error('Error loading student profile:', err);
        document.getElementById('student-profile-content').innerHTML = '<p class="text-red-500 text-center">Error loading student profile.</p>';
    }
}

// --- 10. ADMIN ATTENDANCE MANAGEMENT ---

// Store current admin name for attendance recording
let currentAdminName = '';
let currentAdminId = '';

// Initialize admin name when dashboard loads
export async function loadAdminAttendanceView() {
    // Get current admin user info
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        currentAdminName = user.email?.split('@')[0] || 'Admin';
        currentAdminId = user.id;
    }
    
    // Populate batch dropdown
    await populateAttendanceBatches();
    
    // Set default date to today
    const dateInput = document.getElementById('attendance-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

// Populate batch dropdown
async function populateAttendanceBatches() {
    const batchSelect = document.getElementById('attendance-batch');
    if (!batchSelect) return;
    
    try {
        const batches = await getAllBatches();
        batchSelect.innerHTML = '<option value="">Select Batch...</option>';
        
        batches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading batches:', error);
    }
}

// Load students for selected batch and date
window.loadAttendanceStudents = async function() {
    const dateInput = document.getElementById('attendance-date');
    const batchSelect = document.getElementById('attendance-batch');
    const studentsList = document.getElementById('attendance-students-list');
    const summaryDiv = document.getElementById('attendance-summary');
    
    if (!dateInput || !batchSelect || !studentsList) return;
    
    const date = dateInput.value;
    const batch = batchSelect.value;
    
    if (!date || !batch) {
        showErrorModal("Selection Required", "Please select both date and batch.");
        return;
    }
    
    studentsList.innerHTML = '<p class="text-sm text-blue-500 italic animate-pulse text-center p-4">Loading students...</p>';
    
    try {
        // Get enrolled students for this batch
        const students = await getEligibleStudents(batch);
        
        if (students.length === 0) {
            studentsList.innerHTML = '<p class="text-slate-400 text-sm text-center p-8">No enrolled students found for this batch.</p>';
            summaryDiv.classList.add('hidden');
            return;
        }
        
        // Get existing attendance for this date
        const { data: existingAttendance } = await supabaseClient
            .from('attendance')
            .select('*')
            .eq('attendance_date', date)
            .eq('batch', batch);
        
        const attendanceMap = {};
        if (existingAttendance) {
            existingAttendance.forEach(record => {
                attendanceMap[record.lead_id] = {
                    isPresent: record.is_present,
                    isMissed: record.is_missed
                };
            });
        }
        
        // Build student list HTML
        let html = '';
        students.forEach(student => {
            const existing = attendanceMap[student.id];
            const isPresent = existing ? existing.isPresent : null;
            const isMissed = existing ? existing.isMissed : false;
            
            const age = student.dob ? calculateAge(student.dob) : null;
            const meta = getPackageMetadata(student);
            const remainingClasses = meta?.remaining_classes !== undefined ? meta.remaining_classes : null;
            const totalClasses = meta?.package_classes || null;
            
            const photoThumbnail = getChildPhotoThumbnail(student, 'w-12 h-12');
            html += `
            <div class="bg-white p-4 rounded-lg border-2 ${existing ? (isPresent ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50') : 'border-slate-200'} transition-all" data-student-id="${student.id}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex-1 flex items-center gap-3">
                        ${photoThumbnail}
                        <div class="flex-1">
                            <h4 class="font-bold text-slate-800 text-sm mb-1">${student.child_name}</h4>
                            <div class="text-xs text-slate-600 space-y-0.5">
                                <div>${student.parent_name} • ${student.phone || 'N/A'}</div>
                                ${age ? `<div>Age: ${age} years</div>` : ''}
                                ${remainingClasses !== null && totalClasses !== null ? `<div>Classes: <span class="font-bold ${remainingClasses < 5 ? 'text-red-600' : 'text-green-600'}">${remainingClasses}/${totalClasses}</span></div>` : ''}
                            </div>
                        </div>
                    </div>
                    <span class="attendance-status-badge px-3 py-1 rounded-lg text-xs font-bold ${existing ? (isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'hidden'}">
                        ${existing ? (isPresent ? '✓ Present' : '✗ Absent') : ''}
                    </span>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.toggleAttendance('${student.id}', true)" 
                        class="attendance-btn-present flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${isPresent === true ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}">
                        <i class="fas fa-check mr-1"></i> Present
                    </button>
                    <button onclick="window.toggleAttendance('${student.id}', false)" 
                        class="attendance-btn-absent flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${isPresent === false ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}">
                        <i class="fas fa-times mr-1"></i> Absent
                    </button>
                </div>
            </div>`;
        });
        
        studentsList.innerHTML = html;
        summaryDiv.classList.remove('hidden');
        updateAttendanceSummary();
        
    } catch (error) {
        console.error('Error loading students:', error);
        studentsList.innerHTML = `<p class="text-red-500 text-sm text-center p-4">Error: ${error.message}</p>`;
    }
};

// Toggle attendance for a student
window.toggleAttendance = function(studentId, isPresent) {
    const dateInput = document.getElementById('attendance-date');
    const batchSelect = document.getElementById('attendance-batch');
    
    if (!dateInput || !batchSelect) return;
    
    const date = dateInput.value;
    const batch = batchSelect.value;
    
    if (!date || !batch) return;
    
    // Find student card by data attribute
    const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
    if (!studentCard) return;
    
    // Update card border and background
    studentCard.classList.remove('border-green-300', 'bg-green-50', 'border-red-300', 'bg-red-50', 'border-slate-200');
    
    if (isPresent) {
        studentCard.classList.add('border-green-300', 'bg-green-50');
    } else {
        studentCard.classList.add('border-red-300', 'bg-red-50');
    }
    
    // Update buttons
    const presentBtn = studentCard.querySelector('.attendance-btn-present');
    const absentBtn = studentCard.querySelector('.attendance-btn-absent');
    
    if (presentBtn && absentBtn) {
        if (isPresent) {
            presentBtn.className = 'attendance-btn-present flex-1 py-2 px-3 rounded-lg text-sm font-bold transition bg-green-600 text-white';
            absentBtn.className = 'attendance-btn-absent flex-1 py-2 px-3 rounded-lg text-sm font-bold transition bg-red-100 text-red-700 hover:bg-red-200';
        } else {
            presentBtn.className = 'attendance-btn-present flex-1 py-2 px-3 rounded-lg text-sm font-bold transition bg-green-100 text-green-700 hover:bg-green-200';
            absentBtn.className = 'attendance-btn-absent flex-1 py-2 px-3 rounded-lg text-sm font-bold transition bg-red-600 text-white';
        }
    }
    
    // Update status badge
    const statusBadge = studentCard.querySelector('.attendance-status-badge');
    if (statusBadge) {
        statusBadge.classList.remove('hidden');
        if (isPresent) {
            statusBadge.className = 'attendance-status-badge px-3 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700';
            statusBadge.textContent = '✓ Present';
        } else {
            statusBadge.className = 'attendance-status-badge px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700';
            statusBadge.textContent = '✗ Absent';
        }
    }
    
    updateAttendanceSummary();
};

// Update attendance summary
function updateAttendanceSummary() {
    const studentsList = document.getElementById('attendance-students-list');
    if (!studentsList) return;
    
    const cards = studentsList.querySelectorAll('[data-student-id]');
    let present = 0;
    let absent = 0;
    const total = cards.length;
    
    cards.forEach(card => {
        const presentBtn = card.querySelector('.attendance-btn-present');
        const absentBtn = card.querySelector('.attendance-btn-absent');
        
        if (presentBtn && presentBtn.classList.contains('bg-green-600')) {
            present++;
        } else if (absentBtn && absentBtn.classList.contains('bg-red-600')) {
            absent++;
        }
    });
    
    const presentEl = document.getElementById('summary-present');
    const absentEl = document.getElementById('summary-absent');
    const totalEl = document.getElementById('summary-total');
    
    if (presentEl) presentEl.textContent = present;
    if (absentEl) absentEl.textContent = absent;
    if (totalEl) totalEl.textContent = total;
}

// Set attendance date helper
window.setAttendanceDate = function(option) {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput) return;
    
    const today = new Date();
    let date;
    
    if (option === 'today') {
        date = today;
    } else if (option === 'yesterday') {
        date = new Date(today);
        date.setDate(date.getDate() - 1);
    } else {
        return;
    }
    
    dateInput.value = date.toISOString().split('T')[0];
    
    // Auto-load if batch is selected
    const batchSelect = document.getElementById('attendance-batch');
    if (batchSelect && batchSelect.value) {
        window.loadAttendanceStudents();
    }
};

// Save attendance
window.saveAttendance = async function() {
    const dateInput = document.getElementById('attendance-date');
    const batchSelect = document.getElementById('attendance-batch');
    const studentsList = document.getElementById('attendance-students-list');
    const saveBtn = document.getElementById('btn-save-attendance');
    
    if (!dateInput || !batchSelect || !studentsList) return;
    
    const date = dateInput.value;
    const batch = batchSelect.value;
    
    if (!date || !batch) {
        showErrorModal("Selection Required", "Please select both date and batch.");
        return;
    }
    
    // Get all student cards
    const cards = studentsList.querySelectorAll('.bg-white');
    if (cards.length === 0) {
        showErrorModal("No Students", "No students loaded. Please load students first.");
        return;
    }
    
    // Collect attendance data
    const attendanceRecords = [];
    let hasChanges = false;
    
    cards.forEach(card => {
        const studentId = card.getAttribute('data-student-id');
        if (!studentId) return;
        
        const presentBtn = card.querySelector('.attendance-btn-present');
        const absentBtn = card.querySelector('.attendance-btn-absent');
        
        let isPresent = null;
        if (presentBtn && presentBtn.classList.contains('bg-green-600')) {
            isPresent = true;
            hasChanges = true;
        } else if (absentBtn && absentBtn.classList.contains('bg-red-600')) {
            isPresent = false;
            hasChanges = true;
        }
        
        if (isPresent !== null) {
            attendanceRecords.push({
                studentId: studentId,
                isPresent: isPresent,
                isMissed: !isPresent
            });
        }
    });
    
    if (!hasChanges) {
        showErrorModal("No Changes", "Please mark attendance for at least one student.");
        return;
    }
    
    // Disable save button
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
    }
    
    try {
        // Record attendance for each student
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const record of attendanceRecords) {
            try {
                await recordAttendance({
                    studentId: record.studentId,
                    date: date,
                    batch: batch,
                    isMissed: record.isMissed,
                    recordedBy: 'admin',
                    recordedById: currentAdminId || 'admin'
                });
                successCount++;
            } catch (error) {
                errorCount++;
                if (error.message !== 'Attendance already recorded for this date') {
                    errors.push(error.message);
                } else {
                    // If already recorded, try to update
                    try {
                        const { error: updateError } = await supabaseClient
                            .from('attendance')
                            .update({
                                is_present: record.isPresent,
                                is_missed: record.isMissed,
                                recorded_by: 'admin',
                                recorded_by_id: currentAdminId || 'admin'
                            })
                            .eq('lead_id', record.studentId)
                            .eq('attendance_date', date);
                        
                        if (!updateError) {
                            successCount++;
                            errorCount--;
                        } else {
                            errors.push(updateError.message);
                        }
                    } catch (updateErr) {
                        errors.push(updateErr.message);
                    }
                }
            }
        }
        
        if (successCount > 0) {
            showSuccessModal(
                "Attendance Saved!", 
                `Successfully recorded attendance for ${successCount} student(s)${errorCount > 0 ? `. ${errorCount} error(s) occurred.` : '.'}`
            );
            
            // Reload students to show updated status
            setTimeout(() => {
                window.loadAttendanceStudents();
            }, 500);
        } else {
            showErrorModal("Save Failed", errors.length > 0 ? errors[0] : "Failed to save attendance.");
        }
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        showErrorModal("Save Failed", error.message || "An error occurred while saving attendance.");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Attendance';
        }
    }
};

// Expose to window
window.openStudentProfile = openStudentProfile;

