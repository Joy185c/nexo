-- Phase 20: Device Sessions for Concurrent Login Limit

-- Create device_sessions table
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, device_id)
);

-- Enable RLS
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for device_sessions
CREATE POLICY "Users can view their own device sessions"
    ON public.device_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device sessions"
    ON public.device_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device sessions"
    ON public.device_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device sessions"
    ON public.device_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Enable Realtime for device_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
