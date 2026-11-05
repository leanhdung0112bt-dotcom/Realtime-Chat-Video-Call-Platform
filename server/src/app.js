import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import { errorHandler } from "./utils/errors.js";
import {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  logout,
} from "./controllers/auth.controller.js";
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getFriendRequests,
  removeFriend,
} from "./controllers/friend.controller.js";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsSeen,
} from "./controllers/message.controller.js";
import { uploadSingle } from "./controllers/upload.controller.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { validate } from "./middlewares/validate.middleware.js";
import { upload } from "./middlewares/upload.middleware.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "./validations/auth.validation.js";

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Global Middlewares
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  })
);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
const uploadDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res, file) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (!/\.(png|jpe?g|gif|webp)$/i.test(file)) res.setHeader('Content-Disposition', 'attachment');
  },
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
});

// --- Auth Routes ---
const authRouter = express.Router();
authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/login', validate(loginSchema), login);
authRouter.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/profile', authenticate, validate(updateProfileSchema), updateProfile);
authRouter.post('/logout', authenticate, logout);
app.use('/api/auth', authRouter);

// --- Friend & Contacts Routes ---
const friendRouter = express.Router();
friendRouter.get('/search', authenticate, searchUsers);
friendRouter.get('/all', authenticate, getFriends);
friendRouter.get('/requests', authenticate, getFriendRequests);
friendRouter.post('/request', authenticate, sendFriendRequest);
friendRouter.put('/request/:requestId/accept', authenticate, acceptFriendRequest);
friendRouter.delete('/request/:requestId/decline', authenticate, declineFriendRequest);
friendRouter.delete('/:friendId', authenticate, removeFriend);
app.use('/api/friends', friendRouter);

// --- Messages & Conversation Routes ---
const messageRouter = express.Router();
messageRouter.get('/conversations', authenticate, getConversations);
messageRouter.get('/conversation/:friendId', authenticate, getOrCreateConversation);
messageRouter.get('/:conversationId', authenticate, getMessages);
messageRouter.post('/send', authenticate, sendMessage);
messageRouter.put('/:conversationId/seen', authenticate, markAsSeen);
app.use('/api/messages', messageRouter);

// --- Upload Routes ---
const uploadRouter = express.Router();
uploadRouter.post('/', authenticate, upload.single('file'), uploadSingle);
app.use('/api/upload', uploadRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

app.use(errorHandler);

export default app;
