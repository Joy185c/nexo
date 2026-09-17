import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';

const router = Router();

const tokenSchema = z.object({
  roomName: z.string().min(1),
  participantName: z.string().min(1),
});

router.post('/token', requireAuth, async (req: any, res: any) => {
  try {
    const { roomName, participantName } = tokenSchema.parse(req.body);
    const userId = req.user.id;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[LiveKit] API Key or Secret is missing in environment variables');
      return res.status(500).json({ success: false, error: { message: 'LiveKit credentials missing on server' } });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    console.log(`[LiveKit] Generated token for user ${userId} in room ${roomName}`);
    
    res.json({ success: true, token });
  } catch (error: any) {
    console.error('[LiveKit] Error generating token:', error);
    res.status(400).json({ success: false, error: { message: error.message || 'Invalid request' } });
  }
});

export default router;
