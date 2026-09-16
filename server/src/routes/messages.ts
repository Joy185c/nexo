import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const sendMessageSchema = z.object({
  chat_id: z.string().uuid(),
  content: z.string().min(1).optional(),
  media_url: z.string().url().optional(),
  media_type: z.string().optional(),
  reply_to_id: z.string().uuid().optional()
}).refine(data => data.content || data.media_url, { message: "Message must contain content or media" });

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { chat_id, content, media_url, media_type, reply_to_id } = sendMessageSchema.parse(req.body);

    const { data: membership, error: memErr } = await supabaseAdmin
      .from('chat_members')
      .select('id, chats(is_group)')
      .eq('chat_id', chat_id)
      .eq('user_id', req.user.id)
      .single();
      
    if (memErr || !membership) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });

    // Phase 15: Check if blocked in DM
    if (membership.chats && !(membership.chats as any).is_group) {
      const { data: members } = await supabaseAdmin.from('chat_members').select('user_id').eq('chat_id', chat_id).neq('user_id', req.user.id);
      if (members && members.length > 0) {
        const receiverId = members[0].user_id;
        const { data: blockData } = await supabaseAdmin.from('blocked_users').select('blocker_id').eq('blocker_id', receiverId).eq('blocked_id', req.user.id).single();
        if (blockData) {
          return res.status(403).json({ success: false, error: { code: 'BLOCKED', message: 'You have been blocked by this user.' } });
        }
      }
    }

    const { data: message, error: msgErr } = await supabaseAdmin.from('messages').insert({
      chat_id,
      sender_id: req.user.id,
      content,
      media_url,
      media_type,
      reply_to_id
    }).select().single();

    if (msgErr) throw msgErr;

    await supabaseAdmin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat_id);

    res.json({ success: true, data: message });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: err.errors[0].message } });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/search', requireAuth, async (req: AuthRequest, res) => {
  const query = req.query.q as string;
  if (!query) return res.json({ success: true, data: [] });

  try {
    const { data: memberships } = await supabaseAdmin.from('chat_members').select('chat_id').eq('user_id', req.user.id);
    if (!memberships || memberships.length === 0) return res.json({ success: true, data: [] });
    
    const chatIds = memberships.map(m => m.chat_id);

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select(`id, chat_id, content, created_at, chats(name, is_group)`)
      .in('chat_id', chatIds)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ success: true, data: messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message } });
  }
});

router.get('/:chat_id', requireAuth, async (req: AuthRequest, res) => {
  const { chat_id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  try {
    const { data: membership, error: memErr } = await supabaseAdmin
      .from('chat_members')
      .select('id')
      .eq('chat_id', chat_id)
      .eq('user_id', req.user.id)
      .single();
      
    if (memErr || !membership) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });

    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select(`
        id, chat_id, content, media_url, media_type, created_at, sender_id, is_deleted, is_pinned, reactions, deleted_for, reply_to_id,
        sender:users!sender_id(id, username, avatar_url),
        reply_to:messages!reply_to_id(id, content, is_deleted, sender:users!sender_id(username))
      `)
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (msgErr) throw msgErr;

    const filteredMessages = (messages || []).filter(m => !m.deleted_for?.includes(req.user.id));

    res.json({ success: true, data: filteredMessages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/:chat_id/read', requireAuth, async (req: AuthRequest, res) => {
  const { chat_id } = req.params;
  try {
    const { data: messages, error: fetchErr } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('chat_id', chat_id)
      .neq('sender_id', req.user.id);
      
    if (fetchErr) throw fetchErr;
    if (!messages || messages.length === 0) return res.json({ success: true, data: { read_count: 0 } });

    const readEntries = messages.map(m => ({ message_id: m.id, user_id: req.user.id, chat_id }));
    const { error: upsertErr } = await supabaseAdmin
      .from('message_reads')
      .upsert(readEntries, { onConflict: 'message_id,user_id' });
      
    if (upsertErr) throw upsertErr;

    res.json({ success: true, data: { read_count: messages.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/:chat_id/messages/:message_id/reaction', requireAuth, async (req: AuthRequest, res) => {
  const { chat_id, message_id } = req.params;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Emoji required' } });

  try {
    const { data: msg, error: fetchErr } = await supabaseAdmin.from('messages').select('reactions').eq('id', message_id).single();
    if (fetchErr || !msg) throw new Error('Message not found');

    let reactions: any = msg.reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    
    // Toggle logic: if user already reacted with this emoji, remove them; else add them
    if (reactions[emoji].includes(req.user.id)) {
      reactions[emoji] = reactions[emoji].filter((uid: string) => uid !== req.user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(req.user.id);
    }

    const { data: updated, error: upErr } = await supabaseAdmin.from('messages').update({ reactions }).eq('id', message_id).select().single();
    if (upErr) throw upErr;

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/:chat_id/messages/:message_id/pin', requireAuth, async (req: AuthRequest, res) => {
  const { message_id } = req.params;
  try {
    const { data: msg, error: fetchErr } = await supabaseAdmin.from('messages').select('is_pinned').eq('id', message_id).single();
    if (fetchErr || !msg) throw new Error('Message not found');

    const { data: updated, error: upErr } = await supabaseAdmin.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', message_id).select().single();
    if (upErr) throw upErr;

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/:chat_id/messages/:message_id', requireAuth, async (req: AuthRequest, res) => {
  const { message_id } = req.params;
  try {
    // Unsend: only sender can do this
    const { data: msg } = await supabaseAdmin.from('messages').select('sender_id').eq('id', message_id).single();
    if (!msg || msg.sender_id !== req.user.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } });

    const { data: updated, error: upErr } = await supabaseAdmin.from('messages').update({ 
      is_deleted: true, 
      content: null, 
      media_url: null 
    }).eq('id', message_id).select().single();
    
    if (upErr) throw upErr;
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/:chat_id/messages/:message_id/delete-for-me', requireAuth, async (req: AuthRequest, res) => {
  const { message_id } = req.params;
  try {
    const { data: msg, error: fetchErr } = await supabaseAdmin.from('messages').select('deleted_for').eq('id', message_id).single();
    if (fetchErr || !msg) throw new Error('Message not found');

    const deleted_for = msg.deleted_for || [];
    if (!deleted_for.includes(req.user.id)) {
      deleted_for.push(req.user.id);
    }

    const { data: updated, error: upErr } = await supabaseAdmin.from('messages').update({ deleted_for }).eq('id', message_id).select().single();
    if (upErr) throw upErr;

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
