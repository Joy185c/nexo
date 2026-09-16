import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to enforce sorting of user IDs to prevent duplicates
const getOrderedIds = (id1: string, id2: string) => {
  return id1 < id2 ? [id1, id2] : [id2, id1];
};

// GET /api/friends - Get friends and pending requests
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('friendships')
      .select(`
        id, status, action_user_id, created_at,
        user1:users!user_id1(id, username, full_name, avatar_url),
        user2:users!user_id2(id, username, full_name, avatar_url)
      `)
      .or(`user_id1.eq.${req.user.id},user_id2.eq.${req.user.id}`);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

// POST /api/friends/request/:id - Send Friend Request
router.post('/request/:id', requireAuth, async (req: AuthRequest, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ success: false, error: { message: 'Cannot add yourself' } });

  const [u1, u2] = getOrderedIds(req.user.id, targetId);

  try {
    const { error } = await supabaseAdmin
      .from('friendships')
      .insert({
        user_id1: u1,
        user_id2: u2,
        action_user_id: req.user.id,
        status: 'pending'
      });

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    // If conflict (unique violation), it means request exists
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: { message: 'Request already exists' } });
    }
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PUT /api/friends/accept/:id - Accept Request
router.put('/accept/:id', requireAuth, async (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const [u1, u2] = getOrderedIds(req.user.id, targetId);

  try {
    const { error } = await supabaseAdmin
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .match({ user_id1: u1, user_id2: u2, status: 'pending' })
      .neq('action_user_id', req.user.id); // Must be accepted by the receiver

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/friends/remove/:id - Unfriend or Reject
router.delete('/remove/:id', requireAuth, async (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const [u1, u2] = getOrderedIds(req.user.id, targetId);

  try {
    const { error } = await supabaseAdmin
      .from('friendships')
      .delete()
      .match({ user_id1: u1, user_id2: u2 });

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
