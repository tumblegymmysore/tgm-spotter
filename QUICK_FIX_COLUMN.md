# Quick Fix: "Could not find the 'child_photo_url' column" Error

## Problem
You're getting the error: **"Could not find the 'child_photo_url' column of 'leads' in the schema cache"**

This means the `child_photo_url` column doesn't exist in your `leads` table.

## Solution

### Step 1: Add the Missing Column

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL:

```sql
-- Add child_photo_url column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS child_photo_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.leads.child_photo_url IS 'URL of the child photo stored in Supabase storage bucket';
```

3. Click **"Run"** to execute the SQL
4. You should see: "Success. No rows returned"

### Step 2: Verify the Column Was Added

Run this query to verify:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'child_photo_url';
```

You should see one row with:
- `column_name`: `child_photo_url`
- `data_type`: `text`
- `is_nullable`: `YES`

### Step 3: Test

Try uploading a child photo again from the application. It should work now!

## Alternative: Use the SQL File

Instead of copying the SQL above, you can:
1. Open the file `add-child-photo-url-column.sql` in this project
2. Copy its contents
3. Paste into Supabase SQL Editor
4. Run it

The SQL file includes safety checks to avoid errors if the column already exists.

## What This Column Does

The `child_photo_url` column stores the URL of the child's photo that is uploaded to the Supabase storage bucket. This allows:
- Parents to upload a one-time photo of their child
- The photo to be displayed in student cards
- The photo to be shown in admin and trainer views

## Column Details

- **Column Name**: `child_photo_url`
- **Data Type**: `TEXT` (can store URLs up to 1GB)
- **Nullable**: `YES` (optional field)
- **Default**: `NULL` (no default value)

## Troubleshooting

### Still getting the error?

1. **Verify the column exists**: Run the verification query above
2. **Check table name**: Make sure you're using the correct table name `leads` (not `lead` or `leads_table`)
3. **Refresh schema cache**: Sometimes Supabase needs a moment to update the schema cache. Wait a few seconds and try again.
4. **Check permissions**: Make sure you have ALTER TABLE permissions on the `leads` table

### If you see "column already exists" error:

The column might already exist but the schema cache is stale. Try:
1. Wait 10-15 seconds
2. Refresh your browser
3. Try the operation again

The SQL file uses `IF NOT EXISTS` to safely handle this case.

