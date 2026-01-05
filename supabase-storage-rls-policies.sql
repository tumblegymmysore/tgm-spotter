-- Storage Bucket RLS Policies for child-photos
-- Run this SQL in the Supabase SQL Editor to fix "new row violates row-level security policy" error

-- First, ensure the bucket exists (if not already created)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'child-photos',
  'child-photos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete child-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload to child-photos" ON storage.objects;

-- Policy 1: Allow public read access (for displaying photos)
CREATE POLICY "Public read access for child-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'child-photos');

-- Policy 2: Allow authenticated users to upload files
-- This allows any authenticated user to upload to the bucket
CREATE POLICY "Authenticated users can upload to child-photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow authenticated users to update their own files
-- Users can only update files they uploaded (based on owner)
CREATE POLICY "Authenticated users can update child-photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = owner)
);

-- Policy 4: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete child-photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = owner)
);

-- Alternative: More permissive policy (if the above doesn't work)
-- This allows any authenticated user to upload/update/delete any file in the bucket
-- Uncomment if you need more permissive access:

/*
-- More permissive upload policy (all authenticated users can upload)
CREATE POLICY "All authenticated users can upload to child-photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);

-- More permissive update policy (all authenticated users can update)
CREATE POLICY "All authenticated users can update child-photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);

-- More permissive delete policy (all authenticated users can delete)
CREATE POLICY "All authenticated users can delete child-photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-photos' 
  AND auth.role() = 'authenticated'
);
*/

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND policyname LIKE '%child-photos%'
ORDER BY policyname;

