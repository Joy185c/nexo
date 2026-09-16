"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    username: zod_1.z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
});
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = registerSchema.parse(req.body);
        const { data: existingUser } = await supabase_1.supabaseAdmin.from('users').select('id').eq('username', username).single();
        if (existingUser) {
            return res.status(400).json({ success: false, error: { code: 'USERNAME_TAKEN', message: 'Username is already taken' } });
        }
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (authError) {
            return res.status(400).json({ success: false, error: { code: 'AUTH_ERROR', message: authError.message } });
        }
        const userId = authData.user.id;
        const { error: profileError } = await supabase_1.supabaseAdmin.from('users').insert({
            id: userId,
            email,
            username
        });
        if (profileError) {
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(400).json({ success: false, error: { code: 'PROFILE_ERROR', message: profileError.message } });
        }
        res.status(201).json({ success: true, data: { id: userId, email, username } });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0].message } });
        }
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Registration failed' } });
    }
});
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json({ success: true, data: req.user.profile });
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    const query = req.query.q;
    if (!query)
        return res.json({ success: true, data: [] });
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, username, avatar_url, last_seen')
            .ilike('username', `%${query}%`)
            .neq('id', req.user.id)
            .limit(10);
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message } });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map