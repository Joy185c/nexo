"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const sendMessageSchema = zod_1.z.object({
    chat_id: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1).optional(),
    media_url: zod_1.z.string().url().optional(),
    media_type: zod_1.z.string().optional()
}).refine(data => data.content || data.media_url, { message: "Message must contain content or media" });
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { chat_id, content, media_url, media_type } = sendMessageSchema.parse(req.body);
        const { data: membership, error: memErr } = await supabase_1.supabaseAdmin
            .from('chat_members')
            .select('id')
            .eq('chat_id', chat_id)
            .eq('user_id', req.user.id)
            .single();
        if (memErr || !membership)
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
        const { data: message, error: msgErr } = await supabase_1.supabaseAdmin.from('messages').insert({
            chat_id,
            sender_id: req.user.id,
            content,
            media_url,
            media_type
        }).select().single();
        if (msgErr)
            throw msgErr;
        await supabase_1.supabaseAdmin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat_id);
        res.json({ success: true, data: message });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: err.errors[0].message } });
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
router.get('/search', auth_1.requireAuth, async (req, res) => {
    const query = req.query.q;
    if (!query)
        return res.json({ success: true, data: [] });
    try {
        const { data: memberships } = await supabase_1.supabaseAdmin.from('chat_members').select('chat_id').eq('user_id', req.user.id);
        if (!memberships || memberships.length === 0)
            return res.json({ success: true, data: [] });
        const chatIds = memberships.map(m => m.chat_id);
        const { data: messages, error } = await supabase_1.supabaseAdmin
            .from('messages')
            .select(`id, chat_id, content, created_at, chats(name, is_group)`)
            .in('chat_id', chatIds)
            .ilike('content', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error)
            throw error;
        res.json({ success: true, data: messages });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message } });
    }
});
router.get('/:chat_id', auth_1.requireAuth, async (req, res) => {
    const { chat_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    try {
        const { data: membership, error: memErr } = await supabase_1.supabaseAdmin
            .from('chat_members')
            .select('id')
            .eq('chat_id', chat_id)
            .eq('user_id', req.user.id)
            .single();
        if (memErr || !membership)
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
        const { data: messages, error: msgErr } = await supabase_1.supabaseAdmin
            .from('messages')
            .select(`
        id, chat_id, content, media_url, media_type, created_at, sender_id,
        sender:users!sender_id(id, username, avatar_url)
      `)
            .eq('chat_id', chat_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (msgErr)
            throw msgErr;
        res.json({ success: true, data: messages });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
router.post('/:chat_id/read', auth_1.requireAuth, async (req, res) => {
    const { chat_id } = req.params;
    try {
        const { data: messages, error: fetchErr } = await supabase_1.supabaseAdmin
            .from('messages')
            .select('id')
            .eq('chat_id', chat_id)
            .neq('sender_id', req.user.id);
        if (fetchErr)
            throw fetchErr;
        if (!messages || messages.length === 0)
            return res.json({ success: true, data: { read_count: 0 } });
        const readEntries = messages.map(m => ({ message_id: m.id, user_id: req.user.id, chat_id }));
        const { error: upsertErr } = await supabase_1.supabaseAdmin
            .from('message_reads')
            .upsert(readEntries, { onConflict: 'message_id,user_id' });
        if (upsertErr)
            throw upsertErr;
        res.json({ success: true, data: { read_count: messages.length } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map