-- Fix for Infinite Recursion in RLS Policies

-- Create a security definer function to get the current user's chats without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_chats()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT chat_id FROM chat_members WHERE user_id = auth.uid();
$$;

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can view chat messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;

-- Create new non-recursive policies
CREATE POLICY "Users can view their chats" ON public.chats FOR SELECT
USING (id IN (SELECT public.get_my_chats()));

CREATE POLICY "Users can view chat members" ON public.chat_members FOR SELECT
USING (chat_id IN (SELECT public.get_my_chats()));

CREATE POLICY "Users can view chat messages" ON public.messages FOR SELECT
USING (chat_id IN (SELECT public.get_my_chats()));

CREATE POLICY "Users can view message reads" ON public.message_reads FOR SELECT
USING (chat_id IN (SELECT public.get_my_chats()));
