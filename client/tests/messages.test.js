import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages } from '../src/utils/messages.js';
const message = (id, status = 'sent') => ({ _id: id, conversationId: 'conversation', sender: 'a', recipient: 'b', text: 'Hello', status, createdAt: '2026-10-13T00:00:00.000Z' });
test('duplicate events keep one displayed message', () => {
  const m = message('b'); assert.equal(mergeMessages([m], [m, m]).length, 1);
});
test('late sent event does not regress an already seen message', () => {
  assert.equal(mergeMessages([message('a', 'seen')], [message('a', 'sent')])[0].status, 'seen');
});
test('same-time messages use a stable ID tie break', () => {
  assert.deepEqual(mergeMessages([message('c')], [message('b'), message('a')]).map(m => m._id), ['a', 'b', 'c']);
});
