import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

import userRoutes from './routes/users';
import chatsRouter from './routes/chats';
import messagesRouter from './routes/messages';
import callsRouter from './routes/calls';
import friendsRouter from './routes/friends';
import moodsRouter from './routes/moods';
import adminRouter from './routes/admin';
import webrtcRouter from './routes/webrtc';
import livekitRouter from './routes/livekit';
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, // Increased for development/testing
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later.'
      }
    });
  }
});

app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/users', userRoutes);
app.use('/api/chats', chatsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/calls', callsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/moods', moodsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/webrtc', webrtcRouter);
app.use('/api/livekit', livekitRouter);
// Centralized error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  });
});

export default app;
