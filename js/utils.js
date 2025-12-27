export function getAge(dob) {
    if(!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

export function calculateAgeDisplay() {
    const dob = document.getElementById('dob').value;
    if(dob) {
        document.getElementById('age-value').innerText = getAge(dob);
        document.getElementById('age-display').classList.remove('hidden');
    }
}

export function checkOther(el, targetId) {
    const target = document.getElementById(targetId);
    if(el.value.includes('Other')) target.classList.remove('hidden'); else target.classList.add('hidden');
}

export function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${msg}`;
    t.className = "show"; setTimeout(() => t.className = "", 3000);
}

export function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({behavior:'smooth'});
}

export function showPage(id) {
    document.querySelectorAll('#landing, #parent-portal, #trainer, #admin').forEach(el => el.classList.add('hide'));
    document.getElementById(id).classList.remove('hide');
    document.getElementById(id).classList.add('fade-in');
}
