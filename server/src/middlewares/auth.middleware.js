import { verifyAccessToken } from "../utils/token.utils.js";
import { User } from "../models/User.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    return;
  }
  let payload;
  try { payload = verifyAccessToken(header.slice(7)); }
  catch { res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ.' }); return; }
  try {
    const user = await User.findById(payload.userId);
    if (!user || (user.tokenVersion || 0) !== payload.tokenVersion) {
      res.status(401).json({ success: false, message: 'Phiên đăng nhập không còn hiệu lực.' }); return;
    }
    req.user = user;
    next();
  } catch (error) { next(error); }
}
