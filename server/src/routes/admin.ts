import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    const { data: user } = await supabaseAdmin.from('users').select('system_role').eq('id', req.user.id).single();
    if (!user || user.system_role !== 'admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } });
  }
};

// Secret code authentication endpoint
router.post('/verify-secret', requireAuth, async (req: AuthRequest, res) => {
  const { code } = req.body;
  
  if (code === '192848' && req.user.email?.toLowerCase() === 'admin209688@gmail.com') {
    const { error } = await supabaseAdmin.from('users').update({ system_role: 'admin' }).eq('id', req.user.id);
    if (error) {
      return res.status(500).json({ success: false, error: { message: 'Failed to promote user to admin. Did you run the SQL script?' } });
    }
    return res.json({ success: true, data: { is_admin: true } });
  }
  
  // Just check if they are already admin
  const { data: user, error: fetchError } = await supabaseAdmin.from('users').select('system_role').eq('id', req.user.id).single();
  if (fetchError) {
    return res.status(500).json({ success: false, error: { message: 'Database error. Did you run the SQL script?' } });
  }
  
  if (user && user.system_role === 'admin') {
    return res.json({ success: true, data: { is_admin: true } });
  }
  
  return res.status(403).json({ success: false, error: { message: 'Invalid secret code or incorrect admin email.' } });
});

// Dashboard stats
router.get('/dashboard', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [{ count: totalUsers }, { count: totalGroups }, { count: totalMessages }] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('chats').select('*', { count: 'exact', head: true }).eq('is_group', true),
      supabaseAdmin.from('messages').select('*', { count: 'exact', head: true })
    ]);

    // Active today (users who were last_seen in the last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeToday } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', yesterday);

    // Fetch real chart data from activity_logs (last 7 days)
    const { data: logs } = await supabaseAdmin
      .from('activity_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);

    const chartData = (logs || []).reverse().map(log => {
      const d = new Date(log.date);
      return {
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        users: log.active_users_count || 0,
        messages: log.new_users_count || 0 // using new users as the second metric
      };
    });

    // If no data exists yet, return empty placeholder
    if (chartData.length === 0) {
      chartData.push({ name: 'Today', users: 0, messages: 0 });
    }

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        activeToday: activeToday || 0,
        totalGroups: totalGroups || 0,
        totalMessages: totalMessages || 0,
        chartData
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Get all users
router.get('/users', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, email, full_name, avatar_url, system_role, account_status, total_time_spent, created_at, last_seen')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// User Actions (ban, suspend, pause, active)
router.post('/users/:id/action', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { action } = req.body; // 'active', 'suspended', 'banned', 'paused'
  const targetUserId = req.params.id as string;

  if (!['active', 'suspended', 'banned', 'paused'].includes(action)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid action' } });
  }

  try {
    const { error } = await supabaseAdmin.from('users').update({ account_status: action }).eq('id', targetUserId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Reset Password
router.post('/users/:id/reset-password', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const targetUserId = req.params.id as string;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: { message: 'Password must be at least 6 characters' } });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPassword });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
