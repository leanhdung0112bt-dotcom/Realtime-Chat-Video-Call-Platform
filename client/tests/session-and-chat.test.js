import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
globalThis.window = new EventTarget();
window.location = { origin: 'http://localhost:3000' };
globalThis.document = { visibilityState: 'hidden', hasFocus: () => false };
const { default: api } = await import('../src/services/api.js');
const { rotateSession } = await import('../src/services/session.js');
const { useChatStore: chat } = await import('../src/store/useChatStore.js');
const { useAuthStore: auth } = await import('../src/store/useAuthStore.js');
const { useFriendStore: friends } = await import('../src/store/useFriendStore.js');
const originals = { get: api.get, post: api.post, adapter: api.defaults.adapter, globalAdapter: axios.defaults.adapter };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (config, data) => ({ data, config, status: 200, statusText: 'OK', headers: {} });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 1000 && !predicate(); attempt++) await tick();
  assert.ok(predicate(), 'Expected asynchronous operation to start');
}
beforeEach(() => {
  rotateSession(); storage.clear(); chat.getState().reset();
  friends.setState({ friends: [], searchResults: [], isSearching: false });
  auth.setState({ user: { _id: 'me' }, isAuthenticated: true, isLoading: false });
});
afterEach(() => {
  api.get = originals.get; api.post = originals.post;
  api.defaults.adapter = originals.adapter; axios.defaults.adapter = originals.globalAdapter;
  chat.getState().reset();
});
const message = n => ({ _id: String(n).padStart(24, '0'), conversationId: 'c', sender: 'peer', recipient: 'me', text: 'message ' + n, status: 'sent', createdAt: new Date(1700000000000 + n).toISOString() });
function historySource(initial) {
  const source = { rows: initial, calls: 0 };
  api.get = async (_url, { params }) => {
    source.calls++;
    const end = params.before ? Number(params.before) : source.rows.length;
    const start = Math.max(0, end - params.limit);
    return { data: { data: source.rows.slice(start, end), pagination: { nextCursor: start ? String(start) : null } } };
  };
  chat.setState({ activeConversationId: 'c' });
  return source;
}

test('old friend response cannot replace the next account contacts', async () => {
  const old = deferred(); api.get = () => old.promise;
  const pending = friends.getState().fetchFriends();
  rotateSession(); friends.setState({ friends: [{ user: { _id: 'new-account-friend' } }] });
  old.resolve({ data: { data: [{ user: { _id: 'old-account-friend' } }] } });
  await pending;
  assert.equal(friends.getState().friends[0].user._id, 'new-account-friend');
});
test('out-of-order search results keep the most recent query', async () => {
  const a = deferred(), b = deferred(); let calls = 0;
  api.get = () => (++calls === 1 ? a.promise : b.promise);
  const first = friends.getState().searchUsers('alice'), second = friends.getState().searchUsers('bob');
  b.resolve({ data: { data: [{ username: 'bob' }] } }); await second;
  a.resolve({ data: { data: [{ username: 'alice' }] } }); await first;
  assert.equal(friends.getState().searchResults[0].username, 'bob');
});
test('failed old profile request does not log out the next account', async () => {
  localStorage.setItem('accessToken', 'old-token');
  const old = deferred(); api.get = () => old.promise;
  const pending = auth.getState().fetchMe();
  rotateSession(); auth.setState({ user: { _id: 'new-user' }, isAuthenticated: true });
  old.reject({ response: { status: 401 } }); await pending;
  assert.equal(auth.getState().user._id, 'new-user');
});
test('old logout completion does not clear a new login', async () => {
  const old = deferred(); api.post = () => old.promise;
  const pending = auth.getState().logout();
  rotateSession(); auth.setState({ user: { _id: 'new-user' }, isAuthenticated: true });
  localStorage.setItem('accessToken', 'new-token');
  old.resolve({}); await pending;
  assert.equal(auth.getState().user._id, 'new-user');
  assert.equal(localStorage.getItem('accessToken'), 'new-token');
});
test('old history response cannot repopulate a cleared session', async () => {
  const old = deferred(); api.get = () => old.promise;
  const pending = chat.getState().fetchMessages('c'); await tick();
  rotateSession(); chat.getState().reset(); old.resolve({ data: { data: [message(1)], pagination: {} } });
  assert.equal(await pending, false);
  assert.deepEqual(chat.getState().messages, {});
});
test('reconnect catches up more than 100 messages without duplicates', async () => {
  const source = historySource(Array.from({ length: 20 }, (_, n) => message(n)));
  await chat.getState().fetchMessages('c');
  source.rows = Array.from({ length: 150 }, (_, n) => message(n));
  await chat.getState().fetchMessages('c');
  const rows = chat.getState().messages.c;
  assert.equal(rows.length, 150); assert.equal(new Set(rows.map(m => m._id)).size, 150);
  assert.equal(source.calls, 4); assert.equal(rows.at(-1).text, 'message 149');
});
test('a previously empty conversation catches up all messages after reconnect', async () => {
  const source = historySource([]); await chat.getState().fetchMessages('c');
  source.rows = Array.from({ length: 125 }, (_, n) => message(n));
  await chat.getState().fetchMessages('c');
  assert.equal(chat.getState().messages.c.length, 125);
});
test('reconnect preserves the older-history cursor already loaded by the user', async () => {
  const source = historySource(Array.from({ length: 200 }, (_, n) => message(n)));
  await chat.getState().fetchMessages('c'); await chat.getState().fetchMessages('c', true);
  assert.equal(chat.getState().cursors.c, '100');
  source.rows = Array.from({ length: 260 }, (_, n) => message(n));
  await chat.getState().fetchMessages('c');
  assert.equal(chat.getState().cursors.c, '100');
  await chat.getState().fetchMessages('c', true);
  assert.equal(chat.getState().messages.c[0].text, 'message 50');
});
test('concurrent history reads share one request', async () => {
  const source = historySource([message(1)]);
  await Promise.all([chat.getState().fetchMessages('c'), chat.getState().fetchMessages('c')]);
  assert.equal(source.calls, 1);
});
test('late seen events do not replace the latest conversation preview or add unread', () => {
  chat.setState({ conversations: [{ _id: 'c', lastMessage: { text: 'latest', createdAt: message(10).createdAt }, updatedAt: message(10).createdAt, unreadCount: 0 }] });
  chat.getState().handleIncomingMessage({ ...message(1), status: 'seen' });
  assert.equal(chat.getState().conversations[0].lastMessage.text, 'latest');
  assert.equal(chat.getState().conversations[0].unreadCount, 0);
});
test('refresh completion from an old session cannot overwrite new tokens', async () => {
  localStorage.setItem('accessToken', 'old-access'); localStorage.setItem('refreshToken', 'old-refresh');
  const refresh = deferred(); let started = false;
  api.defaults.adapter = async config => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  axios.defaults.adapter = config => { started = true; return refresh.promise.then(data => response(config, data)); };
  const pending = api.get('/protected'); const rejected = assert.rejects(pending, error => axios.isCancel(error));
  await waitFor(() => started);
  rotateSession(); localStorage.setItem('accessToken', 'new-access'); localStorage.setItem('refreshToken', 'new-refresh');
  refresh.resolve({ success: true, data: { accessToken: 'stale-access', refreshToken: 'stale-refresh' } });
  await rejected;
  assert.equal(localStorage.getItem('accessToken'), 'new-access');
  assert.equal(localStorage.getItem('refreshToken'), 'new-refresh');
});
test('concurrent 401 responses use a single refresh and retry with the new token', async () => {
  localStorage.setItem('accessToken', 'expired'); localStorage.setItem('refreshToken', 'refresh');
  const refresh = deferred(); let refreshCalls = 0; let requests = 0;
  api.defaults.adapter = async config => {
    requests++;
    if (!config._retry) throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config });
    assert.equal(config.headers.Authorization, 'Bearer renewed');
    return response(config, { success: true });
  };
  axios.defaults.adapter = config => { refreshCalls++; return refresh.promise.then(data => response(config, data)); };
  const both = Promise.all([api.get('/one'), api.get('/two')]);
  await waitFor(() => refreshCalls > 0 && requests >= 2);
  refresh.resolve({ success: true, data: { accessToken: 'renewed', refreshToken: 'new-refresh' } });
  await both;
  assert.equal(refreshCalls, 1); assert.equal(requests, 4);
});

test('failed catch-up keeps the previous history and can be retried', async () => {
  const source = historySource(Array.from({ length: 20 }, (_, n) => message(n)));
  await chat.getState().fetchMessages('c');
  source.rows = Array.from({ length: 150 }, (_, n) => message(n));
  const normalGet = api.get;
  api.get = (...args) => args[1].params.before ? Promise.reject(new Error('network offline')) : normalGet(...args);
  assert.equal(await chat.getState().fetchMessages('c'), false);
  assert.equal(chat.getState().messages.c.length, 20);
  api.get = normalGet;
  assert.equal(await chat.getState().fetchMessages('c'), true);
  assert.equal(chat.getState().messages.c.length, 150);
});
test('reconnect waits for an older-page request then synchronizes the newest messages', async () => {
  const source = historySource(Array.from({ length: 200 }, (_, n) => message(n)));
  await chat.getState().fetchMessages('c');
  const normalGet = api.get, oldPage = deferred(); let started = false;
  api.get = (...args) => {
    if (args[1].params.before === '150') { started = true; return oldPage.promise; }
    return normalGet(...args);
  };
  const older = chat.getState().fetchMessages('c', true); await waitFor(() => started);
  source.rows = Array.from({ length: 260 }, (_, n) => message(n));
  const reconnect = chat.getState().fetchMessages('c');
  oldPage.resolve({ data: { data: source.rows.slice(100, 150), pagination: { nextCursor: '100' } } });
  await Promise.all([older, reconnect]);
  assert.equal(chat.getState().messages.c.at(-1).text, 'message 259');
  assert.equal(chat.getState().cursors.c, '100');
});

test('temporary refresh network failure preserves the current session tokens', async () => {
  localStorage.setItem('accessToken', 'expired'); localStorage.setItem('refreshToken', 'still-valid-refresh');
  api.defaults.adapter = async config => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  axios.defaults.adapter = async config => { throw new axios.AxiosError('offline', 'ERR_NETWORK', config); };
  await assert.rejects(api.get('/protected'), error => error.code === 'ERR_NETWORK');
  assert.equal(localStorage.getItem('accessToken'), 'expired');
  assert.equal(localStorage.getItem('refreshToken'), 'still-valid-refresh');
});
