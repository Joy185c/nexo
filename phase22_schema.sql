-- phase22_schema.sql

-- Add is_archived column to chat_members to support archiving chats
ALTER TABLE public.chat_members
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
