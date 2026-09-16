-- Schema for Real-Time Messaging App
-- Please execute this script in the Supabase SQL Editor.

-- 1. Tables

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT, -- only applicable if is_group = true
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(chat_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT content_or_media CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(message_id, user_id)
);

-- 2. Indexes
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_chat_members_chat_id ON public.chat_members(chat_id);
CREATE INDEX idx_chat_members_user_id ON public.chat_members(user_id);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_message_reads_chat_id ON public.message_reads(chat_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Users Policies (Clients can read, but mutations are done via Express backend using Service Role)
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);

-- Chats Policies (Clients can read if they are members)
CREATE POLICY "Users can view their chats" ON public.chats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- Chat Members Policies (Clients can read if they are members)
CREATE POLICY "Users can view chat members" ON public.chat_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members AS my_membership
    WHERE my_membership.chat_id = chat_members.chat_id
    AND my_membership.user_id = auth.uid()
  )
);

-- Messages Policies (Clients can read if they are members)
CREATE POLICY "Users can view chat messages" ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

-- Message Reads Policies (Clients can read if they are members)
CREATE POLICY "Users can view message reads" ON public.message_reads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = message_reads.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

-- 4. Realtime Publication
-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- 5. Storage (Buckets)
-- Create bucket for media and avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Storage RLS
-- Avatars are public
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- Users can upload avatars via Express, so no direct client INSERT policy needed for now.
