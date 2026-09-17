import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('chat_members')
      .select('chat_id, deleted_at, is_archived')
      .eq('user_id', req.user.id);
      
    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) return res.json({ success: true, data: [] });

    const chatIds = memberships.map(m => m.chat_id);
    const memberMap = new Map(memberships.map(m => [m.chat_id, m.deleted_at]));
    const archiveMap = new Map(memberships.map(m => [m.chat_id, m.is_archived]));

    const { data: chats, error: chatErr } = await supabaseAdmin
      .from('chats')
      .select(`
        id, is_group, name, avatar_url, updated_at,
        members:chat_members(user_id, role, user:users(id, username, avatar_url, last_seen, public_key)),
        messages(id, content, media_url, media_type, created_at, sender_id, is_deleted, deleted_for)
      `)
      .in('id', chatIds);
      
    if (chatErr) throw chatErr;

    const formattedChats = await Promise.all(chats.map(async (chat: any) => {
      let filteredMessages = chat.messages.filter((m: any) => {
        const deletedAt = memberMap.get(chat.id);
        if (deletedAt && new Date(m.created_at) < new Date(deletedAt)) return false;
        if (m.deleted_for?.includes(req.user.id)) return false;
        return true;
      });

      filteredMessages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastMessage = filteredMessages.length > 0 ? filteredMessages[0] : null;

      let unreadCount = 0;
      // Get all message IDs for this chat sent by others
      const otherMessages = filteredMessages.filter((m: any) => m.sender_id !== req.user.id);
      if (otherMessages.length > 0) {
        // Fetch reads for these messages by current user
        const { data: reads } = await supabaseAdmin
          .from('message_reads')
          .select('message_id')
          .eq('user_id', req.user.id)
          .eq('chat_id', chat.id);
        
        const readIds = new Set((reads || []).map(r => r.message_id));
        unreadCount = otherMessages.filter((m: any) => !readIds.has(m.id)).length;
      }

      let title = chat.name;
      let avatar = chat.avatar_url; // Use group avatar if it exists
      
      if (!chat.is_group) {
        const otherMember = chat.members.find((m: any) => m.user_id !== req.user.id);
        if (otherMember && otherMember.user) {
          title = otherMember.user.username;
          avatar = otherMember.user.avatar_url;
        }
      }

      return {
        id: chat.id,
        is_group: chat.is_group,
        name: title,
        avatar_url: avatar,
        updated_at: lastMessage ? lastMessage.created_at : chat.updated_at,
        last_message: lastMessage,
        unread_count: unreadCount,
        is_archived: archiveMap.get(chat.id) || false,
        members: chat.members
      };
    }));

    formattedChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    res.json({ success: true, data: formattedChats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'user_id is required' } });

  try {
    const { data: myChats } = await supabaseAdmin.from('chat_members')
      .select('chat_id, chats!inner(is_group)')
      .eq('user_id', req.user.id)
      .eq('chats.is_group', false);

    if (myChats && myChats.length > 0) {
      const myChatIds = myChats.map(c => c.chat_id);
      const { data: otherUserChats } = await supabaseAdmin.from('chat_members')
        .select('chat_id')
        .eq('user_id', user_id)
        .in('chat_id', myChatIds);
      
      if (otherUserChats && otherUserChats.length > 0) {
        return res.json({ success: true, data: { id: otherUserChats[0].chat_id } });
      }
    }

    const { data: chat, error: chatErr } = await supabaseAdmin.from('chats').insert({ is_group: false }).select().single();
    if (chatErr) throw chatErr;

    const { error: memErr } = await supabaseAdmin.from('chat_members').insert([
      { chat_id: chat.id, user_id: req.user.id },
      { chat_id: chat.id, user_id: user_id }
    ]);
    if (memErr) throw memErr;

    res.json({ success: true, data: { id: chat.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: err.message } });
  }
});

// Create Group Chat
router.post('/group', requireAuth, async (req: AuthRequest, res) => {
  const { name, members } = req.body; // members is array of user_ids
  if (!name) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Group name is required' } });

  try {
    const { data: chat, error: chatErr } = await supabaseAdmin.from('chats').insert({ is_group: true, name }).select().single();
    if (chatErr) throw chatErr;

    // Add creator as admin
    const chatMembers = [
      { chat_id: chat.id, user_id: req.user.id, role: 'admin' }
    ];

    if (members && Array.isArray(members)) {
      for (const uid of members) {
        if (uid !== req.user.id) {
          chatMembers.push({ chat_id: chat.id, user_id: uid, role: 'member' });
        }
      }
    }

    const { error: memErr } = await supabaseAdmin.from('chat_members').insert(chatMembers);
    if (memErr) throw memErr;

    res.json({ success: true, data: { id: chat.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: err.message } });
  }
});

// Helper to check admin permission
const requireGroupAdmin = async (chat_id: string, user_id: string) => {
  const { data, error } = await supabaseAdmin.from('chat_members').select('role').eq('chat_id', chat_id).eq('user_id', user_id).single();
  if (error || !data || data.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
};

// Add Member
router.post('/:id/members', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  const { user_id } = req.body;

  try {
    await requireGroupAdmin(chat_id, req.user.id);
    const { error } = await supabaseAdmin.from('chat_members').insert({ chat_id, user_id, role: 'member' });
    if (error) throw error;

    const { data: adder } = await supabaseAdmin.from('users').select('username').eq('id', req.user.id).single();
    const { data: added } = await supabaseAdmin.from('users').select('username').eq('id', user_id).single();
    if (adder && added) {
      await supabaseAdmin.from('messages').insert({
        chat_id,
        sender_id: req.user.id, // Or could be null for system, but auth needs a valid UUID
        content: `System: ${adder.username} added ${added.username} to the group.`
      });
    }

    res.json({ success: true, data: { added: user_id } });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can add members' } });
    if (err.code === '23505') return res.json({ success: true, data: { added: user_id, already_member: true } });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Remove Member / Leave
router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  const targetUserId = req.params.userId as string;

  try {
    let action = 'removed';
    if (req.user.id !== targetUserId) {
      await requireGroupAdmin(chat_id, req.user.id);
    } else {
      action = 'left';
    }
    const { error } = await supabaseAdmin.from('chat_members').delete().eq('chat_id', chat_id).eq('user_id', targetUserId);
    if (error) throw error;

    const { data: actor } = await supabaseAdmin.from('users').select('username').eq('id', req.user.id).single();
    const { data: target } = await supabaseAdmin.from('users').select('username').eq('id', targetUserId).single();
    if (actor && target) {
      const msgContent = action === 'left' 
        ? `System: ${actor.username} left the group.`
        : `System: ${actor.username} removed ${target.username} from the group.`;
        
      await supabaseAdmin.from('messages').insert({
        chat_id,
        sender_id: req.user.id,
        content: msgContent
      });
    }

    res.json({ success: true, data: { removed: targetUserId } });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can remove members' } });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Update Member Role
router.patch('/:id/members/:userId/role', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const { role } = req.body;
  if (role !== 'admin' && role !== 'member') return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid role' } });

  try {
    await requireGroupAdmin(chat_id, req.user.id);
    const { error } = await supabaseAdmin.from('chat_members').update({ role }).eq('chat_id', chat_id).eq('user_id', targetUserId);
    if (error) throw error;
    res.json({ success: true, data: { updated: targetUserId, role } });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can update roles' } });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Delete (Hide) Conversation
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  try {
    const { error } = await supabaseAdmin.from('chat_members').update({ deleted_at: new Date().toISOString() }).eq('chat_id', chat_id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true, data: { deleted: chat_id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Toggle Archive
router.patch('/:id/archive', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  const { is_archived } = req.body;
  if (typeof is_archived !== 'boolean') return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'is_archived boolean is required' } });

  try {
    const { error } = await supabaseAdmin.from('chat_members').update({ is_archived }).eq('chat_id', chat_id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true, data: { archived: chat_id, is_archived } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Update Group Info (Name, Avatar)
router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  const chat_id = req.params.id as string;
  const { name, avatar_url } = req.body;

  try {
    await requireGroupAdmin(chat_id, req.user.id);
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) return res.json({ success: true, data: { id: chat_id } });

    const { data, error } = await supabaseAdmin.from('chats').update(updates).eq('id', chat_id).select().single();
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can update group info' } });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
