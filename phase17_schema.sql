-- Phase 17: Call History & Privacy Features

-- 1. Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
    status TEXT NOT NULL CHECK (status IN ('missed', 'answered', 'declined')),
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Add Privacy Fields to Users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false NOT NULL;

-- 3. Enable RLS on call_logs
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for call_logs
CREATE POLICY "Users can insert their own call logs"
ON public.call_logs FOR INSERT
WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can view their own call logs"
ON public.call_logs FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
