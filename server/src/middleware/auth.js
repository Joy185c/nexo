"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
        }
        const { data: profile } = await supabase_1.supabaseAdmin.from('users').select('*').eq('id', user.id).single();
        req.user = { ...user, profile };
        next();
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Auth verification failed' } });
    }
};
exports.requireAuth = requireAuth;
//# sourceMappingURL=auth.js.map