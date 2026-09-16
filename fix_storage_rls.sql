-- Run this in the Supabase SQL Editor to allow authenticated users to upload to chat-media

-- Allow authenticated users to upload files to the chat-media bucket
CREATE POLICY "Authenticated users can upload to chat-media" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'chat-media');

-- Allow anyone to view files in chat-media (since it's a public bucket, this might be redundant but safe to add)
CREATE POLICY "Anyone can view chat-media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-media');
