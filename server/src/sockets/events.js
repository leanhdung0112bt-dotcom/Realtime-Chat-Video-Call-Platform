let server = null;
export function setIO(io) { server = io; }
export function getIO() { return server; }
export function emitToUsers(ids, event, payload) {
  // One union of user rooms avoids emitting twice to the same socket.
  server?.to([...new Set(ids)].map(id => 'user:' + id)).emit(event, payload);
}
