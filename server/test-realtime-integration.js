"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_URL = 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
async function apiFetch(endpoint, token, options = {}) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers };
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok || !data.success)
        throw new Error(data.error?.message || 'API Error');
    return data.data;
}
async function runTests() {
    console.log('Starting Realtime/Receipts Integration Tests...');
    const aEmail = `test_realtime_a_${Date.now()}@example.com`;
    const bEmail = `test_realtime_b_${Date.now()}@example.com`;
    const pass = 'securepassword123';
    try {
        await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: aEmail, username: `usera_${Date.now()}`, password: pass }) });
        await fetch(`${API_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: bEmail, username: `userb_${Date.now()}`, password: pass }) });
        const { data: aLogin } = await supabase.auth.signInWithPassword({ email: aEmail, password: pass });
        const { data: bLogin } = await supabase.auth.signInWithPassword({ email: bEmail, password: pass });
        const tokenA = aLogin.session.access_token;
        const tokenB = bLogin.session.access_token;
        const { data: userBData } = await supabase.auth.getUser(tokenB);
        const userBId = userBData.user.id;
        const chatRes = await apiFetch(`/chats`, tokenA, { method: 'POST', body: JSON.stringify({ user_id: userBId }) });
        const chatId = chatRes.id;
        console.log('Testing Send Message...');
        await apiFetch(`/messages`, tokenA, { method: 'POST', body: JSON.stringify({ chat_id: chatId, content: 'Hey!' }) });
        console.log('Testing Mark as Read (Sender)...');
        const readA = await apiFetch(`/messages/${chatId}/read`, tokenA, { method: 'POST' });
        if (readA.read_count !== 0)
            throw new Error('Sender marked their own message as read');
        console.log('✅ Sender read count correct.');
        console.log('Testing Mark as Read (Recipient)...');
        const readB = await apiFetch(`/messages/${chatId}/read`, tokenB, { method: 'POST' });
        if (readB.read_count !== 1)
            throw new Error(`Recipient marked incorrect number of messages as read: ${readB.read_count}`);
        console.log('✅ Recipient read count correct.');
        console.log('🎉 ALL REALTIME/RECEIPT TESTS PASSED!');
        process.exit(0);
    }
    catch (err) {
        console.error('❌ TEST FAILED:', err.message);
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=test-realtime-integration.js.map