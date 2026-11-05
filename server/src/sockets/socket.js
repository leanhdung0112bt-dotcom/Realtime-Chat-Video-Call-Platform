import { Server } from 'socket.io';
import { verifyAccessToken } from "../utils/token.utils.js";
import { User } from "../models/User.js";
import { Friendship } from "../models/Friendship.js";
import { createMessage, markConversationSeen, requireConversation } from "../services/message.service.js";
import { directRecipient, objectId } from "../utils/access.js";
import { AppError } from "../utils/errors.js";
import { setIO, emitToUsers, getIO } from "./events.js";

const onlineUsers = new Map();
const presenceJobs = new Map();
function syncPresence(userId) {
  const previous = presenceJobs.get(userId) || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    const isOnline = !!onlineUsers.get(userId)?.size;
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, { isOnline, lastSeen });
    const friends = await Friendship.find({ status: 'accepted', $or: [{ requester: userId }, { recipient: userId }] });
    const ids = friends.map(f => String(f.requester) === userId ? String(f.recipient) : String(f.requester));
    emitToUsers(ids, 'user:presence', { userId, isOnline, lastSeen });
  }).catch(() => { console.error('[presence:error] Unable to update presence'); });
  presenceJobs.set(userId, job);
  void job.finally(() => { if (presenceJobs.get(userId) === job) presenceJobs.delete(userId); });
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','), methods: ['GET', 'POST'] },
    pingTimeout: 20000, pingInterval: 25000, maxHttpBufferSize: 100000,
  });
  setIO(io);
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error();
      const claims = verifyAccessToken(token);
      const user = await User.findById(claims.userId);
      if (!user || (user.tokenVersion || 0) !== claims.tokenVersion) throw new Error();
      socket.data = { userId: String(user._id), username: user.username, expiresAt: claims.exp * 1000 };
      next();
    } catch { next(new Error('Phiên đăng nhập hết hạn hoặc không hợp lệ.')); }
  });
  io.on('connection', socket => {
    const { userId, username, expiresAt } = socket.data;
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.join('user:' + userId);
    console.log(JSON.stringify({ event: 'socket.connected', instance: process.env.HOSTNAME || 'local', userId, socketId: socket.id }));
    const expiryTimer = setTimeout(() => {
      socket.emit('auth:expired');
      socket.disconnect(true);
    }, Math.max(1, expiresAt - Date.now()));

    const safe = (handler) => async (data, callback) => {
      try {
        const result = await handler(data);
        if (typeof callback === 'function') callback({ success: true, ...(result  || {}) });
      } catch (error) {
        const message = error instanceof AppError ? error.message : 'Không thể xử lý yêu cầu.';
        if (typeof callback === 'function') callback({ success: false, error: message });
        else socket.emit('operation:error', { message });
      }
    };
    socket.on('conversation:join', safe(async id => {
      const conv = await requireConversation(userId, id);
      await socket.join('conversation:' + conv._id);
      return {};
    }));
    socket.on('conversation:leave', safe(async id => { await socket.leave('conversation:' + objectId(id)); return {}; }));
    socket.on('message:send', safe(async data => {
      const message = await createMessage(userId, data);
      console.log(JSON.stringify({ event: 'message.saved', instance: process.env.HOSTNAME || 'local', messageId: message?._id, conversationId: message?.conversationId }));
      return { message };
    }));
    socket.on('message:seen', safe(async data => markConversationSeen(userId, data?.conversationId, data?.lastReadMessageId)));
    for (const [event, isTyping] of [['typing:start', true], ['typing:stop', false]] ) {
      socket.on(event, safe(async data => {
        const conv = await requireConversation(userId, data?.conversationId);
        emitToUsers([directRecipient(conv, userId)], 'typing:status', { conversationId: String(conv._id), userId, username, isTyping });
        return {};
      }));
    }
    // Signaling scaffolding only. The browser media/call lifecycle is still a team task.
    const signalEvents = [
      ['call:initiate', 'call:incoming'], ['call:answer', 'call:answered'],
      ['call:ice-candidate', 'call:ice-candidate'], ['call:reject', 'call:rejected'], ['call:end', 'call:ended'],
    ];
    for (const [incoming, outgoing] of signalEvents) {
      socket.on(incoming, safe(async data => {
        const recipientId = objectId(data?.recipientId);
        const allowed = await Friendship.exists({ status: 'accepted', $or: [{ requester: userId, recipient: recipientId }, { requester: recipientId, recipient: userId }] });
        if (!allowed) throw new AppError(403, 'Chỉ có thể gọi cho bạn bè.');
        emitToUsers([recipientId], outgoing, { userId, callerId: userId, callerUsername: username, offer: data.offer, answer: data.answer, candidate: data.candidate, callType: data.callType === 'audio' ? 'audio' : 'video' });
        return {};
      }));
    }
    socket.on('disconnect', () => {
      clearTimeout(expiryTimer);
      const sessions = onlineUsers.get(userId);
      sessions?.delete(socket.id);
      if (!sessions?.size) onlineUsers.delete(userId);
      syncPresence(userId);
    });
    syncPresence(userId);
  });
  return io;
}
export { getIO };
export const getOnlineUsers = () => new Set(onlineUsers.keys());
