import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Read anon key from client's .env file, or just parse it. We'll pass it in.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runTest() {
  console.log('Starting DB RLS verification...');
  
  const testA = `test_a_${Date.now()}@example.com`;
  const testB = `test_b_${Date.now()}@example.com`;
  const testC = `test_c_${Date.now()}@example.com`;
  const password = 'securepassword123';

  // 1. Create users via Admin (auto confirmed)
  const { data: userA, error: errA } = await supabaseAdmin.auth.admin.createUser({ email: testA, password, email_confirm: true });
  const { data: userB, error: errB } = await supabaseAdmin.auth.admin.createUser({ email: testB, password, email_confirm: true });
  const { data: userC, error: errC } = await supabaseAdmin.auth.admin.createUser({ email: testC, password, email_confirm: true });

  if (errA || errB || errC) throw new Error('Failed to create admin users: ' + (errA?.message || errB?.message || errC?.message));

  console.log('Created auth users');

  // 2. Insert into public.users
  const { error: profileErr } = await supabaseAdmin.from('users').insert([
    { id: userA.user.id, username: `userA_${Date.now()}`, email: testA },
    { id: userB.user.id, username: `userB_${Date.now()}`, email: testB },
    { id: userC.user.id, username: `userC_${Date.now()}`, email: testC },
  ]);

  if (profileErr) throw new Error('Failed to insert public users: ' + profileErr.message);

  console.log('Inserted public profiles');

  // 3. Create a private chat and add User A and B
  const { data: chat, error: chatErr } = await supabaseAdmin.from('chats').insert({ is_group: false }).select().single();
  if (chatErr) throw new Error('Failed to create chat: ' + chatErr.message);

  const { error: membersErr } = await supabaseAdmin.from('chat_members').insert([
    { chat_id: chat.id, user_id: userA.user.id, role: 'member' },
    { chat_id: chat.id, user_id: userB.user.id, role: 'member' }
  ]);
  if (membersErr) throw new Error('Failed to add members: ' + membersErr.message);

  console.log('Created private chat between A and B');

  // 4. Authenticate as A, B, and C
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  await clientA.auth.signInWithPassword({ email: testA, password });
  await clientB.auth.signInWithPassword({ email: testB, password });
  await clientC.auth.signInWithPassword({ email: testC, password });

  // 5. Test RLS
  // User A should see the chat
  const { data: chatsA, error: errChatsA } = await clientA.from('chats').select('*').eq('id', chat.id);
  if (errChatsA) console.error('errChatsA:', errChatsA);
  if (errChatsA || !chatsA || chatsA.length === 0) throw new Error('RLS Failure: User A cannot see their own chat.');

  // User C should NOT see the chat
  const { data: chatsC, error: errChatsC } = await clientC.from('chats').select('*').eq('id', chat.id);
  if (errChatsC) throw new Error(errChatsC.message);
  if (chatsC && chatsC.length > 0) throw new Error('RLS Failure: User C CAN see a private chat they are not in.');

  // User C should NOT be able to insert a message into the chat
  const { error: insertErrC } = await clientC.from('messages').insert({
    chat_id: chat.id,
    sender_id: userC.user.id,
    content: 'Hello from C'
  });
  
  if (!insertErrC) throw new Error('RLS Failure: User C was able to insert a message into a private chat they are not in.');

  // User A inserts a message (Wait, our RLS only allows SELECT for clients, all inserts go through Admin via Express API)
  // Let's verify that even User A cannot insert via client directly.
  const { error: insertErrA } = await clientA.from('messages').insert({
    chat_id: chat.id,
    sender_id: userA.user.id,
    content: 'Hello from A'
  });

  if (!insertErrA) throw new Error('RLS Failure: User A was able to insert directly. Client inserts should be blocked by default unless explicitly allowed.');

  console.log('✅ ALL RLS TESTS PASSED!');
  
  // Cleanup
  await supabaseAdmin.auth.admin.deleteUser(userA.user.id);
  await supabaseAdmin.auth.admin.deleteUser(userB.user.id);
  await supabaseAdmin.auth.admin.deleteUser(userC.user.id);
  console.log('Cleanup complete.');
}

runTest().catch(console.error);
