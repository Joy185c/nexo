-- Run this in the Supabase SQL Editor to prepare the database for Phase 15 features

-- 1. Create table for Blocked Users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- 2. Create table for User Contacts (Custom Nicknames)
CREATE TABLE IF NOT EXISTS public.user_contacts (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  custom_nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, contact_id)
);

-- 3. Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

-- 4. Add Policies (Users can read their own blocks and contacts)
CREATE POLICY "Users can view their own block list" 
ON public.blocked_users 
FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "Users can view their own contacts" 
ON public.user_contacts 
FOR SELECT USING (user_id = auth.uid());

-- Note: Mutations (INSERT/UPDATE/DELETE) will be handled by the Express backend via Service Role,
-- so we don't need client mutation policies.
