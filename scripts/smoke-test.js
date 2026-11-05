// Run against a disposable demo environment. Creates three smoke_* accounts and test messages.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const requireClient = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = requireClient('socket.io-client');
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const sockets = [];
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks++; console.log('PASS ' + label); }
async function request(path, { method = 'GET', token, body, status = 200 } = {}) {
  const form = body instanceof FormData;
  const response = await fetch(base + '/api' + path, {
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? form ? body : JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.equal(response.status, status, method + ' ' + path + ': ' + (result.message || 'unexpected status'));
  return result;
}
async function connect(token) {
  const socket = io(base, { autoConnect: false, transports: ['websocket'], auth: { token }, reconnection: false, timeout: 8000 });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
  return socket;
}
const emit = (socket, event, data) => new Promise((resolve, reject) => socket.timeout(8000).emit(event, data, (error, ack) => error ? reject(error) : resolve(ack)));
try {
  check((await fetch(base + '/ready')).ok, 'MongoDB readiness');
  const suffix = Date.now().toString(36), password = randomBytes(18).toString('hex');
  const accounts = [];
  for (const role of ['a', 'b', 'c']) {
    const username = 'smoke_' + role + '_' + suffix;
    const { data } = await request('/auth/register', { method: 'POST', status: 201, body: { username, email: username + '@example.test', password } });
    check(data.user?._id && data.accessToken && data.refreshToken && !data.user.password, 'register contract ' + role);
    accounts.push(data);
  }
  const [a, b, c] = accounts;
  const login = await request('/auth/login', { method: 'POST', body: { identifier: a.user.email, password } });
  check(login.data.user._id === a.user._id, 'login');
  await request('/friends/request', { method: 'POST', token: a.accessToken, status: 201, body: { recipientId: b.user._id } });
  const invites = await request('/friends/requests', { token: b.accessToken });
  const invite = invites.data.received.find(item => item.requester._id === a.user._id);
  check(invite, 'friend request visible to recipient');
  await request('/friends/request/' + invite._id + '/accept', { method: 'PUT', token: c.accessToken, status: 404 });
  const accepted = await request('/friends/request/' + invite._id + '/accept', { method: 'PUT', token: b.accessToken });
  const conversationId = accepted.data.conversationId;
  const friends = await request('/friends/all', { token: b.accessToken });
  check(friends.data.some(f => f.user._id === a.user._id && f.friendshipId), 'friend DTO matches frontend');
  const [sa, sb, sc] = await Promise.all(accounts.map(account => connect(account.accessToken)));
  check(!(await emit(sc, 'conversation:join', conversationId)).success, 'nonmember socket join rejected');
  await request('/messages/' + conversationId, { token: c.accessToken, status: 403 });
  const id = 'smoke-message-' + suffix;
  const payload = { conversationId, recipientId: b.user._id, clientMessageId: id, text: 'Hello from integration test' };
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Recipient did not receive the message')), 8000);
    sb.on('message:received', function listener(message) {
      if (message.clientMessageId === id) { clearTimeout(timer); sb.off('message:received', listener); resolve(message); }
    });
  });
  const ack = await emit(sa, 'message:send', payload);
  check(ack.success && ack.message?._id, 'socket persisted-message acknowledgement');
  check((await received)._id === ack.message._id, 'recipient receives matching message');
  const retry = await request('/messages/send', { method: 'POST', token: a.accessToken, status: 201, body: payload });
  check(retry.data._id === ack.message._id, 'REST retry reuses socket message ID');
  await request('/messages/send', { method: 'POST', token: c.accessToken, status: 403, body: { ...payload, clientMessageId: id + '-forbidden' } });
  await request('/messages/send', { method: 'POST', token: a.accessToken, status: 400, body: { ...payload, recipientId: c.user._id } });
  let history = (await request('/messages/' + conversationId, { token: b.accessToken })).data;
  check(history.filter(m => m.clientMessageId === id).length === 1, 'one stored message after retry');
  check(history.find(m => m._id === ack.message._id).status === 'sent', 'history fetch does not mark messages seen');
  await request('/messages/' + conversationId + '/seen', { method: 'PUT', token: b.accessToken, body: { lastReadMessageId: ack.message._id } });
  history = (await request('/messages/' + conversationId, { token: a.accessToken })).data;
  check(history.find(m => m._id === ack.message._id).status === 'seen', 'explicit read receipt persists');
  for (const n of [1, 2]) await request('/messages/send', { method: 'POST', token: a.accessToken, status: 201, body: { ...payload, clientMessageId: id + '-' + n, text: 'page ' + n } });
  const page = await request('/messages/' + conversationId + '?limit=2', { token: b.accessToken });
  check(page.data.length === 2 && page.pagination.hasMore && page.data[1].text === 'page 2', 'latest page and cursor');
  const older = await request('/messages/' + conversationId + '?limit=2&before=' + encodeURIComponent(page.pagination.nextCursor), { token: b.accessToken });
  check(older.data.some(m => m._id === ack.message._id), 'older page retains history');
  const refreshed = await request('/auth/refresh-token', { method: 'POST', body: { refreshToken: a.refreshToken } });
  check(refreshed.data.accessToken && refreshed.data.refreshToken, 'refresh contract');
  await request('/auth/refresh-token', { method: 'POST', status: 401, body: { refreshToken: a.accessToken } });
  await request('/auth/logout', { method: 'POST', token: b.accessToken });
  await request('/auth/me', { token: b.accessToken, status: 401 });
  await request('/auth/refresh-token', { method: 'POST', status: 401, body: { refreshToken: b.refreshToken } });
  check(true, 'logout revokes access and refresh sessions');
  console.log('Completed ' + checks + ' integration assertions plus HTTP status checks. Test accounts remain under smoke_* for inspection.');
} catch (error) { console.error('FAIL ' + error.message); process.exitCode = 1; }
finally { for (const socket of sockets) socket.disconnect(); }
