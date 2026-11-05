import { randomUUID } from 'node:crypto';
import { Conversation } from "../models/Conversation.js";
import { Friendship } from "../models/Friendship.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { objectId, directRecipient, pairKey } from "../utils/access.js";
import { AppError } from "../utils/errors.js";
import { emitToUsers } from "../sockets/events.js";

export async function requireConversation(userId, conversationId) {
  const conversation = await Conversation.findById(objectId(conversationId));
  if (!conversation) throw new AppError(404, 'Không tìm thấy cuộc trò chuyện.');
  directRecipient(conversation, userId);
  return conversation;
}

export async function ensureDirectConversation(userId, recipientId) {
  const friendId = objectId(recipientId);
  if (userId === friendId) throw new AppError(400, 'Không thể tạo hội thoại với chính mình.');
  const accepted = await Friendship.exists({ status: 'accepted', $or: [
    { requester: userId, recipient: friendId }, { requester: friendId, recipient: userId },
  ] });
  if (!accepted || !(await User.exists({ _id: friendId }))) throw new AppError(403, 'Hãy kết bạn trước khi tạo hội thoại.');
  const key = pairKey(userId, friendId);
  const existing = await Conversation.findOne({ type: 'direct', participants: { $all: [userId, friendId], $size: 2 } });
  if (existing) return existing;
  return (await Conversation.findOneAndUpdate({ directKey: key }, { $setOnInsert: {
    type: 'direct', participants: [userId, friendId],
  } }, { upsert: true, new: true, runValidators: true }));
}

export function normalizeMessage(input) {
  if (!input || typeof input !== 'object') throw new AppError(400, 'Tin nhắn không hợp lệ.');
  if (input.text !== undefined && typeof input.text !== 'string') throw new AppError(400, 'Nội dung phải là văn bản.');
  const text = (input.text || '').trim();
  const rawAttachments = input.attachments ?? [];
  if (text.length > 4000 || !Array.isArray(rawAttachments) || rawAttachments.length > 5) throw new AppError(400, 'Tối đa 4000 ký tự và 5 file mỗi tin.');
  const attachments = rawAttachments.map((a) => {
    if (!a || typeof a.url !== 'string' || !/^\/uploads\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(a.url) || typeof a.fileName !== 'string' || a.fileName.length > 255 || typeof a.fileType !== 'string' || a.fileType.length > 100 || (a.fileSize !== undefined && (!Number.isFinite(a.fileSize) || a.fileSize < 0 || a.fileSize > 20 * 1024 * 1024))) throw new AppError(400, 'File đính kèm không hợp lệ.');
    return { url: a.url, fileType: a.fileType, fileName: a.fileName, ...(a.fileSize === undefined ? {} : { fileSize: a.fileSize }) };
  });
  if (!text && attachments.length === 0) throw new AppError(400, 'Tin nhắn không được rỗng.');
  const clientMessageId = input.clientMessageId ?? randomUUID();
  if (typeof clientMessageId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(clientMessageId)) throw new AppError(400, 'Mã tin nhắn không hợp lệ.');
  return { text, attachments, clientMessageId };
}

export async function createMessage(userId, input) {
  const normalized = normalizeMessage(input);
  const conversation = input.conversationId
    ? await requireConversation(userId, input.conversationId)
    : await ensureDirectConversation(userId, input.recipientId);
  const recipient = directRecipient(conversation, userId);
  if (input.recipientId && objectId(input.recipientId) !== recipient) throw new AppError(400, 'Người nhận không thuộc hội thoại.');
  const key = { conversationId: conversation._id, sender: userId, clientMessageId: normalized.clientMessageId };
  let message;
  try {
    message = await Message.findOneAndUpdate(key, { $setOnInsert: { ...normalized, recipient, status: 'sent' } }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    message = await Message.findOne(key);
  }
  if (!message) throw new AppError(500, 'Không thể lưu tin nhắn.');
  const storedAttachments = message.attachments.map(a => ({ url: a.url, fileType: a.fileType, fileName: a.fileName, ...(a.fileSize === undefined ? {} : { fileSize: a.fileSize }) }));
  if (message.text !== normalized.text || JSON.stringify(storedAttachments) !== JSON.stringify(normalized.attachments)) throw new AppError(409, 'Mã tin nhắn đã được dùng cho nội dung khác.');
  await Conversation.updateOne({ _id: conversation._id, $or: [
    { 'lastMessage.createdAt': { $lte: message.createdAt } }, { 'lastMessage.createdAt': { $exists: false } },
  ] }, { $set: { lastMessage: { text: message.text || '[Tệp đính kèm]', sender: userId, createdAt: message.createdAt } } });
  const populated = await Message.findById(message._id).populate('sender', 'username avatar').populate('recipient', 'username avatar');
  emitToUsers([userId, recipient], 'message:received', populated);
  return populated;
}

export async function markConversationSeen(userId, conversationId, lastReadMessageId) {
  const conversation = await requireConversation(userId, conversationId);
  if (!lastReadMessageId) throw new AppError(400, 'Cần ID tin nhắn cuối cùng đã hiển thị.');
  const last = await Message.findOne({ _id: objectId(lastReadMessageId), conversationId: conversation._id });
  if (!last) throw new AppError(400, 'Tin nhắn không thuộc hội thoại.');
  const candidates = await Message.find({ conversationId: conversation._id, recipient: userId, status: { $ne: 'seen' }, $or: [
    { createdAt: { $lt: last.createdAt } }, { createdAt: last.createdAt, _id: { $lte: last._id } },
  ] }).select('_id');
  const messageIds = candidates.map(m => String(m._id));
  const seenAt = new Date();
  if (messageIds.length) {
    await Message.updateMany({ _id: { $in: messageIds }, recipient: userId }, { $set: { status: 'seen', seenAt } });
    emitToUsers(conversation.participants.map(String), 'message:seen_ack', { conversationId: String(conversation._id), seenBy: userId, seenAt, messageIds });
  }
  return { messageIds, seenAt };
}
