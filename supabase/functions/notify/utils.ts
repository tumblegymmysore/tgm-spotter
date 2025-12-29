// supabase/functions/notify/utils.ts

// 1. Centralized Messages
export const MESSAGES = {
  MOBILE_ERROR: "Invalid Mobile Number. Please enter exactly 10 digits (e.g., 9900000000).",
  ALTERNATE_ERROR: "Invalid Alternate Number. Must be 10 digits (Mobile) or 11 digits starting with 0 (Landline).",
  DUPLICATE_ERROR: "⚠️ Registration Exists!\n\nThis student is already registered with us. You cannot take an additional trial session.\n\nPlease check with Admin, or Login/Register if you have already completed the trial.",
  NOT_TRIAL: "Skipped: Not a trial request"
};

// 2. Validation Helpers

// Strict Validator for Primary Mobile (WhatsApp)
export const validateMobile = (phone: string): boolean => {
  if (!phone) return false;
  // Strip non-numbers
  const cleanPhone = phone.replace(/\D/g, ''); 
  // Rule: Must be exactly 10 digits
  return /^[0-9]{10}$/.test(cleanPhone);
};

// Flexible Validator for Alternate Number (Mobile OR Landline)
export const validateAnyPhone = (phone: string): boolean => {
  if (!phone) return true; // Empty is okay for alternate number
  
  // Strip non-numbers
  const cleanPhone = phone.replace(/\D/g, '');

  // Rule 1: If it starts with '0', it must be 11 digits (Landline)
  if (cleanPhone.startsWith('0')) {
    return /^[0-9]{11}$/.test(cleanPhone);
  }

  // Rule 2: Otherwise, it must be 10 digits (Mobile)
  return /^[0-9]{10}$/.test(cleanPhone);
};
