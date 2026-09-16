import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function apiFetch(endpoint: string, token: string, options: RequestInit = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers };
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error?.message || 'API Error');
  return data.data;
}

async function runTests() {
  console.log('Starting Media Integration Tests...');
  const aEmail = `test_media_a_${Date.now()}@example.com`;
  const bEmail = `test_media_b_${Date.now()}@example.com`;
  const pass = 'securepassword123';

  try {
    // 1. Register users
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: aEmail, username: `usera_${Date.now()}`, password: pass }) });
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: bEmail, username: `userb_${Date.now()}`, password: pass }) });

    // 2. Login
    const { data: aLogin } = await supabase.auth.signInWithPassword({ email: aEmail, password: pass });
    const { data: bLogin } = await supabase.auth.signInWithPassword({ email: bEmail, password: pass });
    const tokenA = aLogin.session!.access_token;
    
    const { data: userBData } = await supabase.auth.getUser(bLogin.session!.access_token);
    const userBId = userBData.user!.id;

    // 3. Create Chat
    const chatRes = await apiFetch(`/chats`, tokenA, { method: 'POST', body: JSON.stringify({ user_id: userBId }) });
    const chatId = chatRes.id;

    // 4. Upload dummy file to Supabase Storage
    console.log('Testing File Upload to Supabase...');
    const dummyBlob = new Blob(['hello world'], { type: 'text/plain' });
    const fileName = `test_upload_${Date.now()}.txt`;
    const { error: uploadError } = await supabase.storage.from('chat-media').upload(`${chatId}/${fileName}`, dummyBlob);
    
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    
    const { data } = supabase.storage.from('chat-media').getPublicUrl(`${chatId}/${fileName}`);
    const mediaUrl = data.publicUrl;
    console.log('✅ File Upload passed, URL:', mediaUrl);

    // 5. Send message with media
    console.log('Testing Send Message with Media...');
    const msgRes = await apiFetch(`/messages`, tokenA, { 
      method: 'POST', 
      body: JSON.stringify({ chat_id: chatId, content: 'Check out this file', media_url: mediaUrl, media_type: 'text/plain' }) 
    });
    
    if (msgRes.media_url !== mediaUrl) throw new Error('Message media_url does not match');
    console.log('✅ Send Message with Media passed.');

    // 6. Fetch messages
    console.log('Testing Fetch Messages...');
    const fetchRes = await apiFetch(`/messages/${chatId}`, tokenA);
    const foundMsg = fetchRes.find((m: any) => m.id === msgRes.id);
    if (!foundMsg || foundMsg.media_url !== mediaUrl) throw new Error('Fetched message does not contain media_url');
    console.log('✅ Fetch Messages with Media passed.');

    console.log('🎉 ALL MEDIA TESTS PASSED!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
