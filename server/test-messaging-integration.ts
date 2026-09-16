import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function apiFetch(endpoint: string, token: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error?.message || 'API Error');
  return data.data;
}

async function runTests() {
  console.log('Starting Messaging Integration Tests...');
  const aEmail = `test_msg_a_${Date.now()}@example.com`;
  const bEmail = `test_msg_b_${Date.now()}@example.com`;
  const aUsername = `usera_${Date.now()}`;
  const bUsername = `userb_${Date.now()}`;
  const pass = 'securepassword123';

  try {
    // 1. Create users
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: aEmail, username: aUsername, password: pass }) });
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: bEmail, username: bUsername, password: pass }) });

    // 2. Login
    const { data: aLogin } = await supabase.auth.signInWithPassword({ email: aEmail, password: pass });
    const { data: bLogin } = await supabase.auth.signInWithPassword({ email: bEmail, password: pass });
    
    const tokenA = aLogin.session!.access_token;
    const tokenB = bLogin.session!.access_token;

    // 3. Search for B from A
    console.log('Testing User Search...');
    const searchRes = await apiFetch(`/users?q=${bUsername}`, tokenA);
    if (!searchRes || searchRes.length === 0 || searchRes[0].username !== bUsername) throw new Error('Search failed');
    const userBId = searchRes[0].id;
    console.log('✅ Search passed.');

    // 4. Create Chat
    console.log('Testing Chat Creation...');
    const chatRes = await apiFetch(`/chats`, tokenA, { method: 'POST', body: JSON.stringify({ user_id: userBId }) });
    const chatId = chatRes.id;
    console.log('✅ Chat creation passed.');

    // 5. Fetch Chat List for A
    console.log('Testing Chat List...');
    const chatListA = await apiFetch(`/chats`, tokenA);
    if (!chatListA.some((c: any) => c.id === chatId)) throw new Error('Chat not found in list');
    console.log('✅ Chat list passed.');

    // 6. Send Message
    console.log('Testing Message Sending...');
    const msgRes = await apiFetch(`/messages`, tokenA, { method: 'POST', body: JSON.stringify({ chat_id: chatId, content: 'Hello User B!' }) });
    if (msgRes.content !== 'Hello User B!') throw new Error('Message send failed');
    console.log('✅ Message send passed.');

    // 7. Fetch Chat List for B (should see chat and last message)
    console.log('Testing Chat List for recipient...');
    const chatListB = await apiFetch(`/chats`, tokenB);
    const bChat = chatListB.find((c: any) => c.id === chatId);
    if (!bChat || bChat.last_message.content !== 'Hello User B!') throw new Error('Recipient chat list failed');
    console.log('✅ Recipient chat list passed.');

    // 8. Fetch Messages for B
    console.log('Testing Message Fetching...');
    const msgsB = await apiFetch(`/messages/${chatId}`, tokenB);
    if (msgsB.length === 0 || msgsB[0].content !== 'Hello User B!') throw new Error('Message fetch failed');
    console.log('✅ Message fetch passed.');

    console.log('🎉 ALL MESSAGING TESTS PASSED!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
