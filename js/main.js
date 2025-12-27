import { checkSession, handleLogin, handleMagicLink, handleLogout, loadView } from './auth.js';
import { handleIntakeSubmit, openRegistrationModal, handlePackageChange, calculateTotal, toggleReview, submitRegistration } from './roles/parent.js';
import { loadTrainerDashboard, openTrialModal, enableTrialEdit, submitTrialResult } from './roles/trainer.js';
import { loadAdminDashboard, openAdminModal, adminApprove } from './roles/admin.js';
import { calculateAgeDisplay, checkOther, scrollToSection } from './utils.js';

// START APP
checkSession();

// EXPORT TO WINDOW (Make them clickable in HTML)
window.handleLogin = handleLogin;
window.handleMagicLink = handleMagicLink;
window.handleLogout = handleLogout;
window.loadView = loadView;

window.handleIntakeSubmit = handleIntakeSubmit;
window.openRegistrationModal = openRegistrationModal;
window.handlePackageChange = handlePackageChange;
window.calculateTotal = calculateTotal;
window.toggleReview = toggleReview;
window.submitRegistration = submitRegistration;

window.loadTrainerDashboard = loadTrainerDashboard;
window.openTrialModal = openTrialModal;
window.enableTrialEdit = enableTrialEdit;
window.submitTrialResult = submitTrialResult;

window.loadAdminDashboard = loadAdminDashboard;
window.openAdminModal = openAdminModal;
window.adminApprove = adminApprove;

window.calculateAgeDisplay = calculateAgeDisplay;
window.checkOther = checkOther;
window.scrollToSection = scrollToSection;
