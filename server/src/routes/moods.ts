import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/moods - Fetch active moods of accepted friends
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    // 1. Get list of friends (accepted)
    const { data: friendsData, error: friendsError } = await supabaseAdmin
      .from('friendships')
      .select('user_id1, user_id2')
      .eq('status', 'accepted')
      .or(`user_id1.eq.${req.user.id},user_id2.eq.${req.user.id}`);
      
    if (friendsError) throw friendsError;

    const friendIds = friendsData.map(f => f.user_id1 === req.user.id ? f.user_id2 : f.user_id1);
    
    // Include user's own moods
    friendIds.push(req.user.id);

    if (friendIds.length === 0) return res.json({ success: true, data: [] });

    // 2. Fetch active moods
    const { data, error } = await supabaseAdmin
      .from('moods')
      .select(`
        id, content_type, content_url, expires_at, created_at, user_id,
        user:users!user_id(id, username, full_name, avatar_url)
      `)
      .in('user_id', friendIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/moods - Create a new mood
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { content_type, content_url } = req.body;
  if (!content_type || !content_url) return res.status(400).json({ success: false, error: { message: 'Missing fields' } });

  // 24 hours from now
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('moods')
      .insert({
        user_id: req.user.id,
        content_type,
        content_url,
        expires_at
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/moods/:id - Delete a mood
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('moods')
      .delete()
      .match({ id: req.params.id as string, user_id: req.user.id });

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
