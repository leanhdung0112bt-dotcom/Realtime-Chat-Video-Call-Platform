import jwt from 'jsonwebtoken';

function secret(kind) {
  const value = process.env[kind === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET'];
  if (!value || value.length < 32) throw new Error('JWT secrets must contain at least 32 characters.');
  return value;
}
export function validateTokenConfiguration() {
  if (secret('access') === secret('refresh')) throw new Error('Use different access and refresh secrets.');
}
export function generateTokens(payload) {
  const claims = { userId: payload.userId, username: payload.username, email: payload.email, tokenVersion: payload.tokenVersion };
  return {
    accessToken: jwt.sign({ ...claims, kind: 'access' }, secret('access'), { algorithm: 'HS256', expiresIn: '15m' }),
    refreshToken: jwt.sign({ ...claims, kind: 'refresh' }, secret('refresh'), { algorithm: 'HS256', expiresIn: '7d' }),
  };
}
function verify(token, kind) {
  const payload = jwt.verify(token, secret(kind), { algorithms: ['HS256'] });
  if (typeof payload === 'string' || payload.kind !== kind || typeof payload.userId !== 'string' || !Number.isInteger(payload.tokenVersion)) throw new Error('Invalid token claims');
  return payload  ;
}
export const verifyAccessToken = (token) => verify(token, 'access');
export const verifyRefreshToken = (token) => verify(token, 'refresh');
