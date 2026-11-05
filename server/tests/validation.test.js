import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../src/validations/auth.validation.js';

const account = password => ({ username: 'alice', email: 'alice@example.test', password });
test('registration accepts a password exactly 72 UTF-8 bytes', () => {
  assert.equal(registerSchema.safeParse(account('á'.repeat(36))).success, true);
});
test('registration rejects multibyte passwords that bcrypt would truncate', () => {
  assert.equal(registerSchema.safeParse(account('á'.repeat(37))).success, false);
});
test('registration preserves the 72 character ASCII boundary', () => {
  assert.equal(registerSchema.safeParse(account('a'.repeat(72))).success, true);
  assert.equal(registerSchema.safeParse(account('a'.repeat(73))).success, false);
});
