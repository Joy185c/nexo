-- Run this script in the Supabase SQL Editor to prepare the database for Phase 14 features

-- 1. Add new columns to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Update the realtime publication to include these new columns (automatically handled by Supabase for altered tables)
ALTER TABLE public.users REPLICA IDENTITY FULL;
