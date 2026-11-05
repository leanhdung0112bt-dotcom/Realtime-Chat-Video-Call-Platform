import bcrypt from 'bcryptjs';
import { User } from "../models/User.js";

import { generateTokens, verifyRefreshToken } from "../utils/token.utils.js";
import { AppError } from "../utils/errors.js";
import { getIO } from "../sockets/events.js";

const tokensFor = (user) => generateTokens({ userId: String(user._id), username: user.username, email: user.email, tokenVersion: user.tokenVersion || 0 });

export async function register(req, res) {
  const { username, email, password, avatar } = req.body;
  const normalizedName = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ $or: [{ username: normalizedName }, { email: normalizedEmail }] })) throw new AppError(409, 'Email hoặc tên người dùng đã tồn tại.');
  const user = await User.create({ username: normalizedName, email: normalizedEmail, password: await bcrypt.hash(password, 10), avatar: avatar || '', isOnline: false });
  res.status(201).json({ success: true, data: { user, ...tokensFor(user) } });
}

export async function login(req, res) {
  const identifier = req.body.identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) throw new AppError(401, 'Sai tài khoản hoặc mật khẩu.');
  res.json({ success: true, data: { user, ...tokensFor(user) } });
}

export async function refreshToken(req, res) {
  let payload;
  try { payload = verifyRefreshToken(req.body.refreshToken); }
  catch { throw new AppError(401, 'Phiên đăng nhập đã hết hạn.'); }
  const user = await User.findById(payload.userId);
  if (!user || (user.tokenVersion || 0) !== payload.tokenVersion) throw new AppError(401, 'Phiên đăng nhập không còn hiệu lực.');
  res.json({ success: true, data: tokensFor(user) });
}

export async function getMe(req, res) {
  res.json({ success: true, data: req.user });
}

export async function updateProfile(req, res) {
  const allowed = {};
  for (const key of ['username', 'bio', 'avatar']) if (req.body[key] !== undefined) allowed[key] = req.body[key];
  if (typeof allowed.username === 'string') allowed.username = allowed.username.trim().toLowerCase();
  const user = await User.findByIdAndUpdate(req.user._id, { $set: allowed }, { new: true, runValidators: true });
  res.json({ success: true, data: user });
}

export async function logout(req, res) {
  // Explicit policy: logout revokes this user's sessions on all devices.
  const id = String(req.user._id);
  await User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } });
  getIO()?.in('user:' + id).disconnectSockets(true);
  res.json({ success: true, message: 'Đã đăng xuất khỏi các thiết bị.' });
}
