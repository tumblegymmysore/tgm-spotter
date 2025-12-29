// js/config.js (v63 - 2026 Holiday Master)

// 1. Credentials
export const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// 2. Constants
export const REGISTRATION_FEE = 2000;
export const ADULT_AGE_THRESHOLD = 15; // Universal Rule: 15+ is Adult
export const WHATSAPP_LINK = "https://wa.me/918618684685";

// 3. Trial Rules
export const TRIAL_EXCLUDED_DAYS = [1, 2]; // 1=Monday (Closed), 2=Tuesday (Busy) - No Trials

// 4. Holiday Master 2026 (Karnataka / Mysore)
// Format: YYYY-MM-DD
export const HOLIDAYS_MYSORE = [
    "2026-01-15", // Makara Sankranti (Thursday)
    "2026-01-26", // Republic Day (Monday)
    "2026-02-15", // Maha Shivaratri (Sunday)
    "2026-03-19", // Ugadi (Thursday)
    "2026-04-03", // Good Friday (Friday)
    "2026-04-14", // Ambedkar Jayanti (Tuesday)
    "2026-05-01", // Labour Day (Friday)
    "2026-08-15", // Independence Day (Saturday)
    "2026-09-14", // Ganesha Chaturthi (Monday)
    "2026-10-02", // Gandhi Jayanti (Friday)
    "2026-10-20", // Ayudha Puja (Tuesday)
    "2026-10-21", // Vijayadashami (Wednesday)
    "2026-11-01", // Kannada Rajyotsava (Sunday)
    "2026-11-10", // Deepavali / Balipadyami (Tuesday)
    "2026-12-25"  // Christmas (Friday)
];

// 5. Batch Definitions & Schedule
export const CLASS_SCHEDULE = {
    MORNING: {
        // Tue-Fri (But Trials only Wed-Fri due to exclusion)
        days: [2, 3, 4, 5], 
        time: "6:15 AM - 7:15 AM",
        minAge: 5,
        maxAge: 99
    },
    EVENING: {
        // Wed-Fri (Excluding Mon/Tue)
        days: [3, 4, 5],
        slots: [
            { min: 3, max: 5, time: "4:00 PM - 5:00 PM" },
            { min: 5, max: 8, time: "5:00 PM - 6:00 PM" },
            { min: 8, max: 15, time: "6:00 PM - 7:00 PM" } // Cap at 15
        ]
    },
    SATURDAY: {
        days: [6],
        slots: [
            { min: 3, max: 5, time: "11:00 AM - 12:00 PM" },
            { min: 6, max: 8, time: "3:00 PM - 4:00 PM" },
            { min: 8, max: 15, time: "4:00 PM - 5:00 PM" }
        ]
    },
    SUNDAY: {
        days: [0],
        slots: [
            { min: 6, max: 8, time: "10:00 AM - 11:00 AM" },
            { min: 3, max: 5, time: "11:00 AM - 12:00 PM" },
            { min: 8, max: 15, time: "12:00 PM - 1:00 PM" }
        ]
    }
};

export const BATCH_TYPES = {
    MORNING: "Morning (Mixed 5-Adult)",
    EVENING: "Evening / Weekend"
};

// 6. Standard Packages (Evening/Weekend)
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

// 7. Morning Packages
export const MORNING_PACKAGES = {
    CHILD: { id: "morn_child", label: "Morning Unlimited (Child)", price: 5500, classes: 999, months: 1 },
    ADULT: { id: "morn_adult", label: "Morning Unlimited (Adult)", price: 6000, classes: 999, months: 1 }
};

// 8. PT Rates
export const PT_RATES = { 
    "Beginner": 700, 
    "Intermediate": 850, 
    "Advanced": 1000 
};

// 9. Initialization
if (typeof supabase === 'undefined') {
    console.error("Supabase Library Missing!");
    alert("CRITICAL ERROR: Supabase not loaded.");
}
const client = supabase.createClient(supabaseUrl, supabaseKey);
export const supabaseClient = client;
export const db = client;
// Note: supabaseKey is already exported on line 5, no need to re-export
