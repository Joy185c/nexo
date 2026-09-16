import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/calls - Fetch call history
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .select(`
        id, call_type, status, duration, created_at,
        caller:users!caller_id(id, username, full_name, avatar_url),
        receiver:users!receiver_id(id, username, full_name, avatar_url)
      `)
      .or(`caller_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// POST /api/calls - Log a call
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { receiver_id, chat_id, call_type, status, duration } = req.body;
  if (!receiver_id || !call_type || !status) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Missing required fields' } });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .insert({
        caller_id: req.user.id,
        receiver_id,
        chat_id: chat_id || null,
        call_type,
        status,
        duration: duration || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INSERT_ERROR', message: err.message } });
  }
});

export default router;
