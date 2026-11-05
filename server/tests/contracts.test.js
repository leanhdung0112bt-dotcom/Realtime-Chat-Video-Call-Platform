import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('hex');
let access, tokens, service, User, Conversation, app;
before(async () => {
  const load = name => import('../src/' + name + '.js');
  access = await load('utils/access');
  tokens = await load('utils/token.utils');
  service = await load('services/message.service');
  User = (await load('models/User')).User;
  Conversation = (await load('models/Conversation')).Conversation;
  app = (await load('app')).default;
});
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbbbbbbbbbb', C = 'cccccccccccccccccccccccc';

test('member check rejects a third user before a conversation can be used', () => {
  assert.throws(() => access.directRecipient({ type: 'direct', participants: [A, B] }, C), error => error.status === 403);
});
test('recipient is derived from stored membership', () => {
  assert.equal(access.directRecipient({ type: 'direct', participants: [A, B] }, A), B);
});
test('unfinished group messaging cannot silently use the direct-chat handler', () => {
  assert.throws(() => access.directRecipient({ type: 'group', participants: [A, B] }, A), error => error.status === 400);
});
test('malformed IDs and query objects are rejected', () => {
  for (const value of ['', '123', { $ne: null }, null]) assert.throws(() => access.objectId(value));
});
test('direct conversation key is symmetric', () => {
  assert.equal(access.pairKey(A, B), access.pairKey(B, A));
});
test('cursor preserves timestamp and tie-breaking ID', () => {
  const date = new Date('2026-10-13T00:00:00.000Z');
  const decoded = access.decodeCursor(access.encodeCursor({ createdAt: date, _id: A }));
  assert.equal(decoded.id, A); assert.equal(decoded.createdAt.toISOString(), date.toISOString());
  assert.throws(() => access.decodeCursor('not-a-cursor'));
});
test('access and refresh tokens round-trip but cannot be swapped', () => {
  const pair = tokens.generateTokens({ userId: A, username: 'alice', email: 'alice@example.test', tokenVersion: 2 });
  assert.equal(tokens.verifyAccessToken(pair.accessToken).tokenVersion, 2);
  assert.equal(tokens.verifyRefreshToken(pair.refreshToken).userId, A);
  assert.throws(() => tokens.verifyAccessToken(pair.refreshToken));
  assert.throws(() => tokens.verifyRefreshToken(pair.accessToken));
});
test('missing signing secret does not silently fall back to a hardcoded value', () => {
  const saved = process.env.JWT_ACCESS_SECRET; delete process.env.JWT_ACCESS_SECRET;
  try { assert.throws(() => tokens.validateTokenConfiguration()); }
  finally { process.env.JWT_ACCESS_SECRET = saved; }
});
test('user JSON never includes password or session version', () => {
  const json = new User({ username: 'alice', email: 'alice@example.test', password: 'test-hash', tokenVersion: 4 }).toJSON();
  assert.equal(json.password, undefined); assert.equal(json.tokenVersion, undefined);
});
test('empty, oversized and malformed message payloads are rejected', () => {
  for (const payload of [null, {}, { text: '   ' }, { text: 'x'.repeat(4001) }, { text: { $gt: '' } }, { text: 'ok', attachments: {} }]) assert.throws(() => service.normalizeMessage(payload));
});
test('valid retry ID and attachment-only message are retained', () => {
  const result = service.normalizeMessage({ clientMessageId: 'retry-id-123', attachments: [{ url: '/uploads/sample-id.png', fileType: 'image/png', fileName: 'photo.png', fileSize: 100 }] });
  assert.equal(result.clientMessageId, 'retry-id-123'); assert.equal(result.attachments.length, 1);
});
test('external and script attachment URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'https://example.test/a.png', '/uploads/../secret.txt']) assert.throws(() => service.normalizeMessage({ attachments: [{ url, fileType: 'image/png', fileName: 'image.png' }] }));
});
test('shared message service rejects a nonmember', async () => {
  const original = Conversation.findById;
  Conversation.findById = async () => ({ _id: A, type: 'direct', participants: [A, B] });
  try { await assert.rejects(service.createMessage(C, { conversationId: A, text: 'unauthorized', clientMessageId: 'retry-id-456' }), error => error.status === 403); }
  finally { Conversation.findById = original; }
});
test('client cannot change the recipient of an existing conversation', async () => {
  const original = Conversation.findById;
  Conversation.findById = async () => ({ _id: A, type: 'direct', participants: [A, B] });
  try { await assert.rejects(service.createMessage(A, { conversationId: A, recipientId: C, text: 'wrong recipient', clientMessageId: 'retry-id-789' }), error => error.status === 400); }
  finally { Conversation.findById = original; }
});
test('HTTP app starts with all route exports and enforces validation/authentication', async () => {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/ready')).status, 503);
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(300000) }) })).status, 413);
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
    for (const [method, path] of [['GET', '/api/auth/me'], ['GET', '/api/friends/requests'], ['POST', '/api/messages/send'], ['PUT', '/api/messages/' + A + '/seen'], ['POST', '/api/upload']]) {
      assert.equal((await fetch(base + path, { method })).status, 401, method + ' ' + path);
    }
    assert.equal((await fetch(base + '/does-not-exist')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
