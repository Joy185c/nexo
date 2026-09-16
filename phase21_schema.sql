-- Phase 21: Admin Panel and User Management

-- 1. Add roles and status to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'user' CHECK (system_role IN ('user', 'admin'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned', 'paused'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_time_spent INT DEFAULT 0;

-- 2. Add an activity logs table for charts
CREATE TABLE IF NOT EXISTS public.activity_logs (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    active_users_count INT DEFAULT 0,
    new_users_count INT DEFAULT 0
);

-- Enable RLS for activity logs (only admins should really query this, but we'll allow select)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view activity logs" ON public.activity_logs FOR SELECT USING (true);

-- 3. Pre-create the admin user if they don't exist in our public.users table? 
-- Actually, the easiest way is to just let the user sign up via the app using that email, 
-- and then we promote them. Or we can create an RPC to promote an admin.
-- For now, the backend will auto-promote 'admin209688@gmail.com'.

-- 4. Notify Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
