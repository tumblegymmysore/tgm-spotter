// supabase/functions/notify/utils.ts

// 1. Centralized Error Messages (Edit text here easily)
export const MESSAGES = {
  PHONE_ERROR: "Invalid Phone Number. Please enter exactly 10 digits without spaces or code.",
  
  DUPLICATE_ERROR: "⚠️ Registration Exists!\n\nThis student is already registered with us. You cannot take an additional trial session.\n\nPlease check with Admin, or Login/Register if you have already completed the trial.",
  
  NOT_TRIAL: "Skipped: Not a trial request"
};

// 2. Validation Helper Functions
export const validatePhone = (phone: string): boolean => {
  // Strip all non-numbers
  const cleanPhone = phone.replace(/\D/g, ''); 
  // Check if exactly 10 digits
  return /^[0-9]{10}$/.test(cleanPhone);
};
