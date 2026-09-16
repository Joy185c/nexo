"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { data: memberships, error: memErr } = await supabase_1.supabaseAdmin
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', req.user.id);
        if (memErr)
            throw memErr;
        if (!memberships || memberships.length === 0)
            return res.json({ success: true, data: [] });
        const chatIds = memberships.map(m => m.chat_id);
        const { data: chats, error: chatErr } = await supabase_1.supabaseAdmin
            .from('chats')
            .select(`
        id, is_group, name, updated_at,
        members:chat_members(user_id, role, user:users(id, username, avatar_url, last_seen)),
        messages(id, content, media_url, media_type, created_at, sender_id)
      `)
            .in('id', chatIds);
        if (chatErr)
            throw chatErr;
        const formattedChats = await Promise.all(chats.map(async (chat) => {
            chat.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const lastMessage = chat.messages.length > 0 ? chat.messages[0] : null;
            let unreadCount = 0;
            // Get all message IDs for this chat sent by others
            const otherMessages = chat.messages.filter((m) => m.sender_id !== req.user.id);
            if (otherMessages.length > 0) {
                // Fetch reads for these messages by current user
                const { data: reads } = await supabase_1.supabaseAdmin
                    .from('message_reads')
                    .select('message_id')
                    .eq('user_id', req.user.id)
                    .eq('chat_id', chat.id);
                const readIds = new Set((reads || []).map(r => r.message_id));
                unreadCount = otherMessages.filter((m) => !readIds.has(m.id)).length;
            }
            let title = chat.name;
            let avatar = null;
            if (!chat.is_group) {
                const otherMember = chat.members.find((m) => m.user_id !== req.user.id);
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
                members: chat.members
            };
        }));
        formattedChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        res.json({ success: true, data: formattedChats });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
    }
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id)
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'user_id is required' } });
    try {
        const { data: myChats } = await supabase_1.supabaseAdmin.from('chat_members')
            .select('chat_id, chats!inner(is_group)')
            .eq('user_id', req.user.id)
            .eq('chats.is_group', false);
        if (myChats && myChats.length > 0) {
            const myChatIds = myChats.map(c => c.chat_id);
            const { data: otherUserChats } = await supabase_1.supabaseAdmin.from('chat_members')
                .select('chat_id')
                .eq('user_id', user_id)
                .in('chat_id', myChatIds);
            if (otherUserChats && otherUserChats.length > 0) {
                return res.json({ success: true, data: { id: otherUserChats[0].chat_id } });
            }
        }
        const { data: chat, error: chatErr } = await supabase_1.supabaseAdmin.from('chats').insert({ is_group: false }).select().single();
        if (chatErr)
            throw chatErr;
        const { error: memErr } = await supabase_1.supabaseAdmin.from('chat_members').insert([
            { chat_id: chat.id, user_id: req.user.id },
            { chat_id: chat.id, user_id: user_id }
        ]);
        if (memErr)
            throw memErr;
        res.json({ success: true, data: { id: chat.id } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: err.message } });
    }
});
// Create Group Chat
router.post('/group', auth_1.requireAuth, async (req, res) => {
    const { name, members } = req.body; // members is array of user_ids
    if (!name)
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Group name is required' } });
    try {
        const { data: chat, error: chatErr } = await supabase_1.supabaseAdmin.from('chats').insert({ is_group: true, name }).select().single();
        if (chatErr)
            throw chatErr;
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
        const { error: memErr } = await supabase_1.supabaseAdmin.from('chat_members').insert(chatMembers);
        if (memErr)
            throw memErr;
        res.json({ success: true, data: { id: chat.id } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: err.message } });
    }
});
// Helper to check admin permission
const requireGroupAdmin = async (chat_id, user_id) => {
    const { data, error } = await supabase_1.supabaseAdmin.from('chat_members').select('role').eq('chat_id', chat_id).eq('user_id', user_id).single();
    if (error || !data || data.role !== 'admin') {
        throw new Error('FORBIDDEN');
    }
};
// Add Member
router.post('/:id/members', auth_1.requireAuth, async (req, res) => {
    const chat_id = req.params.id;
    const { user_id } = req.body;
    try {
        await requireGroupAdmin(chat_id, req.user.id);
        const { error } = await supabase_1.supabaseAdmin.from('chat_members').insert({ chat_id, user_id, role: 'member' });
        if (error)
            throw error;
        res.json({ success: true, data: { added: user_id } });
    }
    catch (err) {
        if (err.message === 'FORBIDDEN')
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can add members' } });
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// Remove Member / Leave
router.delete('/:id/members/:userId', auth_1.requireAuth, async (req, res) => {
    const chat_id = req.params.id;
    const targetUserId = req.params.userId;
    try {
        if (req.user.id !== targetUserId) {
            await requireGroupAdmin(chat_id, req.user.id);
        }
        const { error } = await supabase_1.supabaseAdmin.from('chat_members').delete().eq('chat_id', chat_id).eq('user_id', targetUserId);
        if (error)
            throw error;
        res.json({ success: true, data: { removed: targetUserId } });
    }
    catch (err) {
        if (err.message === 'FORBIDDEN')
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can remove members' } });
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// Update Member Role
router.patch('/:id/members/:userId/role', auth_1.requireAuth, async (req, res) => {
    const chat_id = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;
    if (role !== 'admin' && role !== 'member')
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid role' } });
    try {
        await requireGroupAdmin(chat_id, req.user.id);
        const { error } = await supabase_1.supabaseAdmin.from('chat_members').update({ role }).eq('chat_id', chat_id).eq('user_id', targetUserId);
        if (error)
            throw error;
        res.json({ success: true, data: { updated: targetUserId, role } });
    }
    catch (err) {
        if (err.message === 'FORBIDDEN')
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can update roles' } });
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
exports.default = router;
//# sourceMappingURL=chats.js.map