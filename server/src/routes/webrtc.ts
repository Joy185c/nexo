import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import twilio from 'twilio';

const router = Router();

router.get('/turn', requireAuth, async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('Twilio credentials missing, returning empty TURN servers');
      return res.json({ success: true, data: [] });
    }

    const client = twilio(accountSid, authToken);
    
    // Create a temporary token valid for 86400 seconds (24 hours)
    const token = await client.tokens.create({ ttl: 86400 });
    
    res.json({ success: true, data: token.iceServers });
  } catch (error: any) {
    console.error('Error generating Twilio TURN token:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to generate ICE servers' } });
  }
});

export default router;
