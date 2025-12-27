export const SUPABASE_URL = 'https://znfsbuconoezbjqksxnu.supabase.co'; 
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

export const REGISTRATION_FEE = 2000;
export const SPECIAL_RATES = { "Beginner": 700, "Intermediate": 850, "Advanced": 1000 };

export const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
