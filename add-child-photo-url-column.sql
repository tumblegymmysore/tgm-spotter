-- Migration: Add child_photo_url column to leads table
-- Run this SQL in the Supabase SQL Editor to add the missing column

-- Check if column already exists, if not, add it
DO $$ 
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leads' 
        AND column_name = 'child_photo_url'
    ) THEN
        -- Add the column
        ALTER TABLE public.leads 
        ADD COLUMN child_photo_url TEXT;
        
        -- Add a comment to document the column
        COMMENT ON COLUMN public.leads.child_photo_url IS 'URL of the child photo stored in Supabase storage bucket';
        
        RAISE NOTICE 'Column child_photo_url added successfully to leads table';
    ELSE
        RAISE NOTICE 'Column child_photo_url already exists in leads table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'child_photo_url';

