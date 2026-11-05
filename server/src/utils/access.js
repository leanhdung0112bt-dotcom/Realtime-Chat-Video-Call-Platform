import { AppError } from "./errors.js";

export function objectId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AppError(400, 'ID không hợp lệ.');
  return value.toLowerCase();
}

export function directRecipient(conversation, userId) {
  const ids = conversation.participants.map(String);
  if (!ids.includes(userId)) throw new AppError(403, 'Bạn không thuộc cuộc trò chuyện này.');
  if (conversation.type !== 'direct' || ids.length !== 2 || ids[0] === ids[1]) throw new AppError(400, 'Luồng này chỉ hỗ trợ cuộc trò chuyện cá nhân.');
  return ids.find(id => id !== userId);
}

export const pairKey = (a, b) => [objectId(a), objectId(b)].sort().join(':');

export function encodeCursor(message) {
  return Buffer.from(JSON.stringify([message.createdAt.toISOString(), String(message._id)])).toString('base64url');
}

export function decodeCursor(cursor) {
  try {
    if (typeof cursor !== 'string' || cursor.length > 256) throw new Error();
    const [date, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(date);
    if (typeof date !== 'string' || Number.isNaN(createdAt.getTime())) throw new Error();
    return { createdAt, id: objectId(id) };
  } catch { throw new AppError(400, 'Cursor không hợp lệ.'); }
}
