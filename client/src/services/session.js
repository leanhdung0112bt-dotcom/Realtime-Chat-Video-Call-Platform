// A version changes only when the account/session changes, not on token refresh.
let version = 0;
let controller = new AbortController();
export const sessionVersion = () => version;
export const isCurrentSession = expected => expected === version;
export const sessionSignal = () => controller.signal;
export function rotateSession() {
  version += 1;
  controller.abort();
  controller = new AbortController();
  return version;
}
