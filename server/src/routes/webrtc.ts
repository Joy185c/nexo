import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import twilio from 'twilio';

const router = Router();

// Official public TURN servers from Metered.ca (Open Relay Project)
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:80?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

router.get('/turn', requireAuth, async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('[TURN] Twilio credentials missing, returning OpenRelay fallback');
      return res.json({ success: true, data: FALLBACK_ICE_SERVERS });
    }

    const client = twilio(accountSid, authToken);
    
    // Create a temporary token valid for 86400 seconds (24 hours)
    const token = await client.tokens.create({ ttl: 86400 });
    
    // Check if Twilio actually returned TURN servers (not just STUN)
    const turnServers = (token.iceServers || []).filter((s: any) => {
      const url = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return url && url.startsWith('turn:');
    });
    
    if (turnServers.length === 0) {
      console.warn('[TURN] Twilio returned NO TURN servers (NTS disabled?). Using OpenRelay fallback.');
      return res.json({ success: true, data: FALLBACK_ICE_SERVERS });
    }
    
    console.log('[TURN] Using Twilio TURN servers:', turnServers.length);
    res.json({ success: true, data: token.iceServers });
  } catch (error: any) {
    console.error('[TURN] Error generating Twilio TURN token:', error.message);
    // Return fallback instead of error so calls still work
    res.json({ success: true, data: FALLBACK_ICE_SERVERS });
  }
});

export default router;
