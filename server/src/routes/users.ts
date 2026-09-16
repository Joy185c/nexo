import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = registerSchema.parse(req.body);

    const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('username', username).single();
    if (existingUser) {
      return res.status(400).json({ success: false, error: { code: 'USERNAME_TAKEN', message: 'Username is already taken' } });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ success: false, error: { code: 'AUTH_ERROR', message: authError.message } });
    }

    const userId = authData.user.id;
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      username
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(400).json({ success: false, error: { code: 'PROFILE_ERROR', message: profileError.message } });
    }

    res.status(201).json({ success: true, data: { id: userId, email, username } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0].message } });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Registration failed' } });
  }
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ success: true, data: req.user.profile });
});

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  const { full_name, nickname, bio, avatar_url } = req.body;
  try {
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const query = req.query.q as string;
  if (!query) return res.json({ success: true, data: [] });

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url, last_seen, full_name, nickname, bio')
      .ilike('username', `%${query}%`)
      .neq('id', req.user.id)
      .limit(10);
      
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message } });
  }
});

// Phase 15: Blocks & Contacts

// Get user's block list and contacts
router.get('/me/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data: blockedData, error: blockError } = await supabaseAdmin
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', req.user.id);
    if (blockError) throw blockError;

    const { data: contactData, error: contactError } = await supabaseAdmin
      .from('user_contacts')
      .select('contact_id, custom_nickname')
      .eq('user_id', req.user.id);
    if (contactError) throw contactError;

    res.json({
      success: true,
      data: {
        blockedUsers: blockedData.map(b => b.blocked_id),
        contacts: contactData
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PREF_ERROR', message: err.message } });
  }
});

// Block a user
router.post('/:id/block', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('blocked_users')
      .insert({ blocker_id: req.user.id, blocked_id: req.params.id });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'BLOCK_ERROR', message: err.message } });
  }
});

// Unblock a user
router.delete('/:id/block', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('blocked_users')
      .delete()
      .match({ blocker_id: req.user.id, blocked_id: req.params.id });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UNBLOCK_ERROR', message: err.message } });
  }
});

// Set custom nickname
router.put('/contacts/:id', requireAuth, async (req: AuthRequest, res) => {
  const { custom_nickname } = req.body;
  try {
    const { error } = await supabaseAdmin
      .from('user_contacts')
      .upsert({ user_id: req.user.id, contact_id: req.params.id, custom_nickname, updated_at: new Date().toISOString() });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONTACT_ERROR', message: err.message } });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.params.id;
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url, last_seen, full_name, nickname, bio')
      .eq('id', userId)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// Phase 16: Shared Media
router.get('/:id/media', requireAuth, async (req: AuthRequest, res) => {
  const targetUserId = req.params.id;
  try {
    // 1. Get all chats the current user is part of
    const { data: myChats } = await supabaseAdmin.from('chat_members').select('chat_id').eq('user_id', req.user.id);
    if (!myChats || myChats.length === 0) return res.json({ success: true, data: [] });
    const myChatIds = myChats.map(c => c.chat_id);

    // 2. Get all chats the target user is part of, filtered by the common chats
    const { data: commonChats } = await supabaseAdmin.from('chat_members')
      .select('chat_id')
      .eq('user_id', targetUserId)
      .in('chat_id', myChatIds);
    
    if (!commonChats || commonChats.length === 0) return res.json({ success: true, data: [] });
    const commonChatIds = commonChats.map(c => c.chat_id);

    // 3. Fetch media messages from those common chats
    const { data: mediaMessages, error } = await supabaseAdmin
      .from('messages')
      .select('id, media_url, media_type, created_at, sender_id')
      .in('chat_id', commonChatIds)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    // Filter out deleted messages if needed (though typically media isn't shown if message is deleted for the user)
    // For simplicity, we just return all media_url present
    res.json({ success: true, data: mediaMessages || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'MEDIA_ERROR', message: err.message } });
  }
});

export default router;
