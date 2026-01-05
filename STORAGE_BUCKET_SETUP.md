# Storage Bucket Setup Guide

## Problem
The application requires:
1. A storage bucket named `child-photos` to upload child photos
2. A `child_photo_url` column in the `leads` table to store photo URLs

If you're seeing errors like:
- "Storage bucket not found" → Create the bucket
- "Could not find the 'child_photo_url' column" → Add the column (see below)

## Prerequisites

### Step 0: Add the Database Column (REQUIRED FIRST)

Before setting up the storage bucket, you must add the `child_photo_url` column to your `leads` table:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL:

```sql
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS child_photo_url TEXT;
```

**OR** use the migration file: `add-child-photo-url-column.sql`

See `QUICK_FIX_COLUMN.md` for detailed instructions.

## Solution: Create the Storage Bucket

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project: `znfsbuconoezbjqksxnu`

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar
   - Click "New bucket" button

3. **Configure the Bucket**
   - **Name**: `child-photos` (exactly as shown)
   - **Public bucket**: ✅ **Enable** (check this box - required for public access)
   - **File size limit**: `1048576` (1 MB in bytes)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/webp`

4. **Create the Bucket**
   - Click "Create bucket"
   - The bucket should now be available

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Create the bucket
supabase storage create child-photos --public

# Set file size limit (1 MB)
supabase storage update child-photos --file-size-limit 1048576

# Set allowed MIME types
supabase storage update child-photos --allowed-mime-types "image/jpeg,image/jpg,image/png,image/webp"
```

### Option 3: Using SQL (Advanced)

Run this SQL in the Supabase SQL Editor:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'child-photos',
  'child-photos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```

## Verify the Bucket

After creating the bucket:

1. Go to Storage > `child-photos` in the Supabase dashboard
2. You should see an empty bucket
3. Try uploading a photo from the application again

## Bucket Configuration Summary

- **Bucket Name**: `child-photos`
- **Public**: Yes (required)
- **File Size Limit**: 1 MB (1,048,576 bytes)
- **Allowed MIME Types**: 
  - `image/jpeg`
  - `image/jpg`
  - `image/png`
  - `image/webp`

## Troubleshooting

### If the bucket still doesn't work:

1. **Check bucket name**: Must be exactly `child-photos` (lowercase, with hyphen)
2. **Check public access**: The bucket must be public
3. **Check RLS policies**: Ensure there are no restrictive Row Level Security policies blocking access
4. **Check permissions**: Ensure the anon key has storage access

### Setting RLS Policies (REQUIRED - Fixes "new row violates row-level security policy")

**IMPORTANT**: After creating the bucket, you MUST set up RLS policies or you'll get a "new row violates row-level security policy" error.

**Quick Fix**: Run the SQL file `supabase-storage-rls-policies.sql` in the Supabase SQL Editor, or run this SQL:

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

**See `supabase-storage-rls-policies.sql` for the complete script with detailed comments.**

## Notes

- The application will automatically try alternative bucket names if `child-photos` is not found
- Alternative bucket names tried: `childphotos`, `photos`, `student-photos`
- However, it's recommended to use the standard `child-photos` bucket name

