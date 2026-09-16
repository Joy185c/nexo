-- Run this script in the Supabase SQL Editor to prepare the database for Phase 12 features

-- 1. Add new columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_for UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- 2. Add deleted_at column to chat_members to support clearing/deleting conversations
ALTER TABLE public.chat_members
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Update the realtime publication to include these new columns (automatically handled by Supabase for altered tables, but we can ensure replication is full if needed)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
