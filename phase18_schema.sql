-- Phase 18: Friend Requests & Moods (Stories)

-- 1. Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id1 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_id2 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id1, user_id2)
);

-- Ensure user_id1 < user_id2 for consistency if we wanted, but let's just use a trigger or unique constraint logic in API
-- Actually, the easiest way to prevent duplicate requests is to enforce user_id1 < user_id2 at the API level.

-- 2. Moods Table
CREATE TABLE IF NOT EXISTS public.moods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image')),
    content_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Storage Bucket for Moods
INSERT INTO storage.buckets (id, name, public) VALUES ('moods', 'moods', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS for Friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id1 OR auth.uid() = user_id2);

CREATE POLICY "Users can insert their own friendships"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id1 OR auth.uid() = user_id2);

CREATE POLICY "Users can update their own friendships"
ON public.friendships FOR UPDATE
USING (auth.uid() = user_id1 OR auth.uid() = user_id2);

CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id1 OR auth.uid() = user_id2);

-- 5. RLS for Moods
ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active moods of friends"
ON public.moods FOR SELECT
USING (
  expires_at > NOW() AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted' AND (
        (f.user_id1 = auth.uid() AND f.user_id2 = moods.user_id) OR
        (f.user_id2 = auth.uid() AND f.user_id1 = moods.user_id)
      )
    )
  )
);

CREATE POLICY "Users can insert their own moods"
ON public.moods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own moods"
ON public.moods FOR DELETE
USING (auth.uid() = user_id);

-- 6. Storage Policies for Moods
CREATE POLICY "Public read access to moods"
ON storage.objects FOR SELECT
USING (bucket_id = 'moods');

CREATE POLICY "Users can insert into moods bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'moods' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete from moods bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'moods' AND auth.uid()::text = (storage.foldername(name))[1]);
