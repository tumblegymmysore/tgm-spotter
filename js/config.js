// js/config.js (v47 - Crash Proof)

// 1. Credentials
export const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// 2. Constants
export const REGISTRATION_FEE = 2000;
export const SPECIAL_RATES = { "Beginner": 700, "Intermediate": 850, "Advanced": 1000 };

// 3. Initialization with Safety Check
if (typeof supabase === 'undefined') {
    console.error("Supabase Library Missing! Check index.html");
    alert("CRITICAL ERROR: Supabase not loaded.");
}

const client = supabase.createClient(supabaseUrl, supabaseKey);

// 4. DUAL EXPORT (The Fix)
// We export as BOTH names so old and new code works perfectly.
export const supabaseClient = client;
export const db = client;
