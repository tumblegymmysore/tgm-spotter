// Script to create storage bucket for child photos
// Run this in the browser console on the Supabase dashboard or use Supabase CLI
// Or run this in Node.js with @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znfsbuconoezbjqksxnu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZnNidWNvbm9lemJqcWtzeG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDc1MjMsImV4cCI6MjA4MjM4MzUyM30.yAEuur8T0XUeVy_qa3bu3E90q5ovyKOMZfL9ofy23Uc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStorageBucket() {
    try {
        // Try to create the bucket
        const { data, error } = await supabase.storage.createBucket('child-photos', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            fileSizeLimit: 1048576 // 1 MB
        });

        if (error) {
            if (error.message.includes('already exists')) {
                console.log('Bucket "child-photos" already exists');
            } else {
                console.error('Error creating bucket:', error);
            }
        } else {
            console.log('Bucket "child-photos" created successfully');
        }
    } catch (e) {
        console.error('Failed to create bucket:', e);
    }
}

// Note: This requires service role key or admin access
// For manual creation:
// 1. Go to Supabase Dashboard > Storage
// 2. Click "New bucket"
// 3. Name: "child-photos"
// 4. Public: Yes
// 5. Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp
// 6. File size limit: 1048576 (1 MB)

createStorageBucket();

