import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import twilio from 'twilio';

const router = Router();

// Reliable free TURN servers as fallback
// These are from Metered TURN service - reliable and free tier available
const FALLBACK_ICE_SERVERS = [
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "e8dd65f9a1d8b2c3a9d3f2e1",
    credential: "nexo-turn-2024"
  },
  {
    urls: "turn:a.relay.metered.ca:80?transport=tcp",
    username: "e8dd65f9a1d8b2c3a9d3f2e1",
    credential: "nexo-turn-2024"
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "e8dd65f9a1d8b2c3a9d3f2e1",
    credential: "nexo-turn-2024"
  },
  {
    urls: "turn:a.relay.metered.ca:443?transport=tcp",
    username: "e8dd65f9a1d8b2c3a9d3f2e1",
    credential: "nexo-turn-2024"
  }
];

router.get('/turn', requireAuth, async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('[TURN] Twilio credentials missing, returning fallback TURN servers');
      return res.json({ success: true, data: FALLBACK_ICE_SERVERS });
    }

    const client = twilio(accountSid, authToken);
    
    // Create a temporary token valid for 86400 seconds (24 hours)
    const token = await client.tokens.create({ ttl: 86400 });
    
    console.log('[TURN] Twilio token created. iceServers count:', token.iceServers?.length || 0);
    console.log('[TURN] iceServers:', JSON.stringify(token.iceServers));
    
    // If Twilio NTS is not enabled, it returns empty or only STUN servers
    const turnServers = (token.iceServers || []).filter((s: any) => {
      const url = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return url && url.startsWith('turn:');
    });
    
    if (turnServers.length === 0) {
      console.warn('[TURN] Twilio NTS returned no TURN servers (NTS may not be enabled). Using fallback.');
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
