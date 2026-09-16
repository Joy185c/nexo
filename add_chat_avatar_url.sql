-- Run this script in your Supabase SQL Editor to add the missing avatar_url column to the chats table

ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS avatar_url TEXT;
