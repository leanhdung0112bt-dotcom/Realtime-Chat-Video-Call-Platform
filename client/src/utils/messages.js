const rank = { sent: 0, delivered: 1, seen: 2 };
export const entityId = (value) => typeof value === 'string' ? value : value._id;
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map(message => [message._id, message]));
  for (const message of incoming) {
    const previous = byId.get(message._id);
    byId.set(message._id, previous && rank[previous.status] > rank[message.status] ? { ...message, status: previous.status, seenAt: previous.seenAt } : message);
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id));
}
