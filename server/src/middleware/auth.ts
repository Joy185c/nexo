import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
    
    const { data: profile } = await supabaseAdmin.from('users').select('*').eq('id', user.id).single();
    
    if (profile && (profile.account_status === 'suspended' || profile.account_status === 'banned')) {
      return res.status(403).json({ success: false, error: { code: 'ACCOUNT_BLOCKED', message: `Your account is ${profile.account_status}` } });
    }

    req.user = { ...user, profile };
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Auth verification failed' } });
  }
};
