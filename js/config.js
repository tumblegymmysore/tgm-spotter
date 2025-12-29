// js/config.js (v56 - Advanced Pricing Rules)

// 1. Credentials
export const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// 2. Constants
export const REGISTRATION_FEE = 2000;
export const ADULT_AGE_THRESHOLD = 15; // 15+ is Adult

// 3. Batch Definitions
export const BATCH_TYPES = {
    MORNING: "Morning (Mixed 5-Adult)",
    EVENING: "Evening / Weekend"
};

// 4. Standard Packages (Evening/Weekend)
// Format: "Label": { price, classes, months }
export const STANDARD_PACKAGES = [
    { id: "1m_8c", label: "1 Month - 8 Classes", price: 3500, classes: 8, months: 1 },
    { id: "1m_unl", label: "1 Month - Unlimited", price: 5500, classes: 999, months: 1 },
    
    { id: "3m_12c", label: "3 Months - 12 Classes", price: 5500, classes: 12, months: 3 },
    { id: "3m_24c", label: "3 Months - 24 Classes", price: 9000, classes: 24, months: 3 },
    { id: "3m_unl", label: "3 Months - Unlimited", price: 15000, classes: 999, months: 3 },

    { id: "6m_24c", label: "6 Months - 24 Classes", price: 9000, classes: 24, months: 6 },
    { id: "6m_48c", label: "6 Months - 48 Classes", price: 16000, classes: 48, months: 6 },
    { id: "6m_unl", label: "6 Months - Unlimited", price: 25000, classes: 999, months: 6 },

    { id: "12m_48c", label: "12 Months - 48 Classes", price: 16000, classes: 48, months: 12 },
    { id: "12m_96c", label: "12 Months - 96 Classes", price: 25000, classes: 96, months: 12 },
    { id: "12m_unl", label: "12 Months - Unlimited", price: 35000, classes: 999, months: 12 },
];

// 5. Morning Packages (Mixed Batch)
export const MORNING_PACKAGES = {
    CHILD: { id: " morn_child", label: "Morning Unlimited (Child)", price: 5500, classes: 999, months: 1 },
    ADULT: { id: "morn_adult", label: "Morning Unlimited (Adult)", price: 6500, classes: 999, months: 1 }
};

// 6. Personal Training Rates (Per Class)
export const PT_RATES = { 
    "Beginner": 700, 
    "Intermediate": 850, 
    "Advanced": 1000 
};

// 7. Initialization
if (typeof supabase === 'undefined') {
    console.error("Supabase Library Missing! Check index.html");
    alert("CRITICAL ERROR: Supabase not loaded.");
}

const client = supabase.createClient(supabaseUrl, supabaseKey);
export const supabaseClient = client;
export const db = client;
