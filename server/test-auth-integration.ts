import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log('Starting Auth Integration Tests...');
  const testEmail = `test_auth_${Date.now()}@example.com`;
  const testPassword = 'securepassword123';
  const testUsername = `user_${Date.now()}`;

  try {
    console.log(`1. Testing Registration for ${testEmail}...`);
    const regRes = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, username: testUsername, password: testPassword })
    });
    
    const regData = await regRes.json();
    if (regRes.ok && regData.success) {
      console.log('✅ Registration successful.');
    } else {
      throw new Error('Registration failed: ' + JSON.stringify(regData));
    }

    console.log('2. Testing Login...');
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr || !loginData.session) throw new Error('Login failed: ' + loginErr?.message);
    console.log('✅ Login successful. Token retrieved.');

    const token = loginData.session.access_token;

    console.log('3. Testing Protected Route...');
    const profileRes = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profileData = await profileRes.json();

    if (profileRes.ok && profileData.success && profileData.data.username === testUsername) {
      console.log('✅ Protected route working and profile matches.');
    } else {
      throw new Error('Protected route returned invalid data: ' + JSON.stringify(profileData));
    }

    console.log('4. Testing Invalid Token...');
    const invalidRes = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer invalid_token` }
    });
    
    if (invalidRes.status === 401) {
      console.log('✅ Invalid token rejected properly (401).');
    } else {
      throw new Error('Invalid token was accepted!');
    }

    console.log('5. Testing Logout...');
    const { error: logoutErr } = await supabase.auth.signOut();
    if (logoutErr) throw new Error('Logout failed: ' + logoutErr.message);
    console.log('✅ Logout successful.');

    console.log('🎉 ALL AUTH TESTS PASSED!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
