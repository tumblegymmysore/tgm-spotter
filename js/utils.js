// js/utils.js (v50 - Fix Export Name)

// 1. Age Calculator (Renamed to match imports)
export function calculateAge(dob) {
    if(!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

// Keep 'getAge' as an alias just in case other files use it
export const getAge = calculateAge; 

// 2. UI Helper for Public Form
export function calculateAgeDisplay() {
    const dob = document.getElementById('dob').value;
    if(dob) {
        document.getElementById('age-value').innerText = calculateAge(dob);
        document.getElementById('age-display').classList.remove('hidden');
    }
}

// 3. Dropdown "Other" Toggle
export function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); 
    else target.classList.add('hidden');
}

// 4. Toast Notification
export function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${msg}`;
        t.className = "show"; 
        setTimeout(() => t.className = "", 3000);
    }
}

// 5. Success Modal
export function showSuccessModal(title, message) {
    const modal = document.getElementById('success-modal');
    if (modal) {
        const titleEl = modal.querySelector('h3');
        const msgEl = modal.querySelector('p');
        if (titleEl) titleEl.innerText = title;
        if (msgEl) msgEl.innerText = message;
        modal.classList.remove('hidden');
    } else {
        alert(`${title}\n${message}`);
    }
}

// 6. View Switcher
export function showView(viewId) {
    const views = ['landing', 'trainer', 'parent-portal', 'admin'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.add('hide'); }
    });
    const target = document.getElementById(viewId);
    if (target) { 
        target.classList.remove('hidden'); 
        target.classList.remove('hide'); 
        target.classList.add('fade-in'); 
    }
}

export function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({behavior:'smooth'});
}
