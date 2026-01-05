# Quick Fix: "new row violates row-level security policy" Error

## Problem
You're getting the error: **"new row violates row-level security policy"** when trying to upload child photos.

## Solution (2 Steps)

### Step 1: Create the Storage Bucket (if not already created)

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure:
   - **Name**: `child-photos`
   - **Public**: ✅ Yes
   - **File size limit**: `1048576` (1 MB)
   - **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
4. Click **"Create bucket"**

### Step 2: Set Up RLS Policies (REQUIRED)

**This is the critical step that fixes the error!**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete child-photos" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public read access for child-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'child-photos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to child-photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update child-photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete child-photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);
```

3. Click **"Run"** to execute the SQL
4. You should see: "Success. No rows returned"

### Step 3: Test

Try uploading a photo again from the application. It should work now!

## Alternative: Use the SQL File

Instead of copying the SQL above, you can:
1. Open the file `supabase-storage-rls-policies.sql` in this project
2. Copy its contents
3. Paste into Supabase SQL Editor
4. Run it

## Why This Happens

Supabase uses Row Level Security (RLS) to control access to storage. By default, storage buckets have no policies, which means **all operations are blocked**. You need to explicitly create policies to allow:
- **SELECT** (read) - to view photos
- **INSERT** (upload) - to upload photos
- **UPDATE** (modify) - to update photos
- **DELETE** (remove) - to delete photos

## Troubleshooting

### Still getting the error?

1. **Verify the bucket exists**: Go to Storage → Check if `child-photos` bucket is listed
2. **Verify policies exist**: Run this SQL to check:
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'objects' AND policyname LIKE '%child-photos%';
   ```
   You should see 4 policies listed.

3. **Check if user is authenticated**: The policies require `auth.role() = 'authenticated'`. Make sure users are logged in.

4. **Try the more permissive policies**: If the above doesn't work, see the alternative policies in `supabase-storage-rls-policies.sql` (commented section).

## Need More Help?

See `STORAGE_BUCKET_SETUP.md` for detailed instructions and troubleshooting.

