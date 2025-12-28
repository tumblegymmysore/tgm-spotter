// js/config.js

// 1. Database Credentials
export const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

// 2. Business Logic Constants
export const REGISTRATION_FEE = 2000;
export const SPECIAL_RATES = { 
    "Beginner": 700, 
    "Intermediate": 850, 
    "Advanced": 1000 
};

// 3. Client Initialization (With Safety Check)
if (typeof supabase === 'undefined') {
    alert("CRITICAL: Supabase library not loaded. Please check your internet connection.");
    throw new Error("Supabase script missing from index.html");
}

// Export the client as 'supabaseClient' to match imports in other modules
export const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
