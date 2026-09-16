-- Run this in the Supabase SQL Editor to allow users to upload avatar images

-- 1. Ensure the 'avatars' bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- 2. Allow authenticated users to upload files to the avatars bucket
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- 3. Allow users to update their own avatars
CREATE POLICY "Users can update their avatars" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars');

-- 4. Ensure anyone can view avatars
CREATE POLICY "Anyone can view avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');
