import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { createMessage, ensureDirectConversation, requireConversation, markConversationSeen } from "../services/message.service.js";
import { decodeCursor, encodeCursor } from "../utils/access.js";
import { AppError } from "../utils/errors.js";

const view = (conv, userId, unreadCount = 0) => ({
  _id: conv._id, type: conv.type, friend: conv.participants.find((p) => p && String(p._id) !== userId) || null,
  lastMessage: conv.lastMessage, unreadCount, updatedAt: conv.updatedAt,
});
export async function getConversations(req, res) {
  const userId = String(req.user._id);
  const conversations = await Conversation.find({ participants: userId, type: 'direct' }).populate('participants', 'username email avatar isOnline lastSeen').sort({ updatedAt: -1 });
  const counts = await Message.aggregate([{ $match: { recipient: req.user._id, status: { $ne: 'seen' } } }, { $group: { _id: '$conversationId', count: { $sum: 1 } } }]);
  const unread = new Map(counts.map(c => [String(c._id), c.count]));
  res.json({ success: true, data: conversations.map(c => view(c, userId, unread.get(String(c._id)) || 0)) });
}
export async function getOrCreateConversation(req, res) {
  const userId = String(req.user._id);
  const conversation = await ensureDirectConversation(userId, req.params.friendId);
  await conversation.populate('participants', 'username email avatar isOnline lastSeen');
  res.json({ success: true, data: view(conversation, userId) });
}
export async function getMessages(req, res) {
  const conversation = await requireConversation(String(req.user._id), req.params.conversationId);
  const limit = Number(req.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(400, 'limit phải nằm trong khoảng 1 đến 100.');
  const filter = { conversationId: conversation._id };
  if (req.query.before) {
    const cursor = decodeCursor(req.query.before);
    filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }];
  }
  const rows = await Message.find(filter).populate('sender', 'username avatar').populate('recipient', 'username avatar').sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;
  res.json({ success: true, data: page.reverse(), pagination: { nextCursor, hasMore } });
}
export async function sendMessage(req, res) {
  res.status(201).json({ success: true, data: await createMessage(String(req.user._id), req.body) });
}
export async function markAsSeen(req, res) {
  res.json({ success: true, data: await markConversationSeen(String(req.user._id), req.params.conversationId, req.body?.lastReadMessageId) });
}
