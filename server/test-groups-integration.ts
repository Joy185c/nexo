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

async function apiFetchRaw(endpoint: string, token: string, options: RequestInit = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers };
  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
}

async function runTests() {
  console.log('Starting Group Integration Tests...');
  const aEmail = `test_grp_a_${Date.now()}@example.com`;
  const bEmail = `test_grp_b_${Date.now()}@example.com`;
  const cEmail = `test_grp_c_${Date.now()}@example.com`;
  const pass = 'securepassword123';

  try {
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: aEmail, username: `usera_${Date.now()}`, password: pass }) });
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: bEmail, username: `userb_${Date.now()}`, password: pass }) });
    await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cEmail, username: `userc_${Date.now()}`, password: pass }) });

    const { data: aLogin } = await supabase.auth.signInWithPassword({ email: aEmail, password: pass });
    const { data: bLogin } = await supabase.auth.signInWithPassword({ email: bEmail, password: pass });
    const { data: cLogin } = await supabase.auth.signInWithPassword({ email: cEmail, password: pass });
    
    const tokenA = aLogin.session!.access_token;
    const tokenB = bLogin.session!.access_token;
    const tokenC = cLogin.session!.access_token;
    
    const { data: userBData } = await supabase.auth.getUser(tokenB);
    const userBId = userBData.user!.id;

    const { data: userCData } = await supabase.auth.getUser(tokenC);
    const userCId = userCData.user!.id;

    console.log('Testing Group Creation...');
    const groupRes = await apiFetch(`/chats/group`, tokenA, { method: 'POST', body: JSON.stringify({ name: 'Test Group', members: [userBId] }) });
    const groupId = groupRes.id;
    console.log('✅ Group creation passed.');

    console.log('Testing Add Member (Admin)...');
    await apiFetch(`/chats/${groupId}/members`, tokenA, { method: 'POST', body: JSON.stringify({ user_id: userCId }) });
    console.log('✅ Add member passed.');

    console.log('Testing Add Member (Non-Admin)...');
    const resBAdd = await apiFetchRaw(`/chats/${groupId}/members`, tokenB, { method: 'POST', body: JSON.stringify({ user_id: userCId }) });
    if (resBAdd.status !== 403) throw new Error('Non-admin was able to add a member!');
    console.log('✅ Non-admin restriction passed.');

    console.log('Testing Promote Member...');
    await apiFetch(`/chats/${groupId}/members/${userBId}/role`, tokenA, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
    console.log('✅ Promote member passed.');

    console.log('Testing Remove Member...');
    await apiFetch(`/chats/${groupId}/members/${userCId}`, tokenA, { method: 'DELETE' });
    console.log('✅ Remove member passed.');

    console.log('🎉 ALL GROUP TESTS PASSED!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
