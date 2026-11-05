import { User } from "../models/User.js";
import { Friendship } from "../models/Friendship.js";
import { ensureDirectConversation } from "../services/message.service.js";
import { objectId, pairKey } from "../utils/access.js";
import { AppError } from "../utils/errors.js";
import { emitToUsers } from "../sockets/events.js";

const between = (a, b) => ({ $or: [{ requester: a, recipient: b }, { requester: b, recipient: a }] });
const fields = 'username email avatar isOnline lastSeen';
const getId = (req) => String(req.user._id);
const announceAccepted = (ids, conversationId) => emitToUsers(ids, 'friend:request_accepted', { conversationId });

export async function searchUsers(req, res) {
  const q = typeof req.query.query === 'string' ? req.query.query.trim().slice(0, 80) : '';
  if (!q) { res.json({ success: true, data: [] }); return; }
  const userId = getId(req);
  const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ _id: { $ne: userId }, $or: [{ username: { $regex: literal, $options: 'i' } }, { email: { $regex: literal, $options: 'i' } }] }).select(fields).limit(20);
  const ids = users.map(u => u._id);
  const relations = await Friendship.find({ $or: [{ requester: userId, recipient: { $in: ids } }, { requester: { $in: ids }, recipient: userId }] });
  const data = users.map(user => {
    const relation = relations.find(f => String(f.requester) === String(user._id) || String(f.recipient) === String(user._id));
    const relationship = relation?.status === 'accepted' ? 'friends' : relation?.status === 'pending' ? (String(relation.requester) === userId ? 'pending_sent' : 'pending_received') : 'none';
    return { ...user.toJSON(), relationship, friendshipId: relation?._id || null };
  });
  res.json({ success: true, data });
}

export async function sendFriendRequest(req, res) {
  const requester = getId(req);
  const recipient = objectId(req.body?.recipientId);
  if (requester === recipient) throw new AppError(400, 'Không thể kết bạn với chính mình.');
  if (!(await User.exists({ _id: recipient }))) throw new AppError(404, 'Không tìm thấy người dùng.');
  let friendship = await Friendship.findOne(between(requester, recipient));
  if (friendship?.status === 'accepted') throw new AppError(409, 'Hai người đã là bạn bè.');
  if (friendship?.status === 'blocked') throw new AppError(403, 'Không thể gửi lời mời.');
  if (friendship?.status === 'pending') {
    if (String(friendship.requester) === requester) throw new AppError(409, 'Lời mời đang chờ phản hồi.');
    friendship.status = 'accepted'; await friendship.save();
    const conversation = await ensureDirectConversation(requester, recipient);
    announceAccepted([requester, recipient], String(conversation._id));
    res.json({ success: true, message: 'Đã trở thành bạn bè.', data: { conversationId: conversation._id } }); return;
  }
  if (friendship) {
    friendship.set({ requester, recipient, status: 'pending', pairKey: pairKey(requester, recipient) });
    await friendship.save();
  } else {
    friendship = await Friendship.create({ requester, recipient, status: 'pending', pairKey: pairKey(requester, recipient) });
  }
  await friendship.populate('requester recipient', fields);
  emitToUsers([recipient], 'friend:request_received', friendship);
  res.status(201).json({ success: true, message: 'Đã gửi lời mời kết bạn.', data: friendship });
}

export async function acceptFriendRequest(req, res) {
  const userId = getId(req);
  const friendship = await Friendship.findOneAndUpdate({ _id: objectId(req.params.requestId), recipient: userId, status: 'pending' }, { $set: { status: 'accepted' } }, { new: true });
  if (!friendship) throw new AppError(404, 'Không tìm thấy lời mời đang chờ dành cho bạn.');
  const ids = [String(friendship.requester), String(friendship.recipient)];
  const conversation = await ensureDirectConversation(ids[0], ids[1]);
  announceAccepted(ids, String(conversation._id));
  res.json({ success: true, data: { conversationId: conversation._id }, message: 'Đã chấp nhận kết bạn.' });
}

export async function declineFriendRequest(req, res) {
  const userId = getId(req);
  const friendship = await Friendship.findOneAndDelete({ _id: objectId(req.params.requestId), status: 'pending', $or: [{ requester: userId }, { recipient: userId }] });
  if (!friendship) throw new AppError(404, 'Không tìm thấy lời mời hợp lệ.');
  emitToUsers([String(friendship.requester), String(friendship.recipient)], 'friend:changed', {});
  res.json({ success: true });
}

export async function getFriends(req, res) {
  const userId = getId(req);
  const friendships = await Friendship.find({ $or: [{ requester: userId }, { recipient: userId }], status: 'accepted' }).populate('requester recipient', fields);
  const data = friendships.filter(f => f.requester && f.recipient).map(f => ({ friendshipId: f._id, user: String((f.requester )._id) === userId ? f.recipient : f.requester, since: f.updatedAt }));
  res.json({ success: true, data });
}

export async function getFriendRequests(req, res) {
  const userId = getId(req);
  const requests = await Friendship.find({ status: 'pending', $or: [{ requester: userId }, { recipient: userId }] }).populate('requester recipient', fields).sort({ createdAt: -1 });
  const valid = requests.filter(f => f.requester && f.recipient);
  res.json({ success: true, data: {
    received: valid.filter(f => String((f.recipient )._id) === userId),
    sent: valid.filter(f => String((f.requester )._id) === userId),
  } });
}

export async function removeFriend(req, res) {
  const userId = getId(req), friendId = objectId(req.params.friendId);
  const deleted = await Friendship.findOneAndDelete({ ...between(userId, friendId), status: 'accepted' });
  if (!deleted) throw new AppError(404, 'Không tìm thấy quan hệ bạn bè.');
  emitToUsers([userId, friendId], 'friend:changed', {});
  res.json({ success: true });
}
