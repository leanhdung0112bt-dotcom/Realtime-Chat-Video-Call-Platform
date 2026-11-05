import { create } from 'zustand';
import api from '../services/api.js';
import { sessionVersion, isCurrentSession } from '../services/session.js';

import { getSocket } from "../services/socket.js";
import { useAuthStore } from "./useAuthStore.js";
import { entityId, mergeMessages } from "../utils/messages.js";

const initial = { conversations: [] , activeConversationId: null, activeFriend: null, messages: {}, isTypingMap: {}, cursors: {}, isLoadingConversations: false, isLoadingMessages: false, isChatVisible: true, lastError: null };
const pendingIds = new Map();
const typingTimers = new Map();
const syncAnchors = new Map();
const historyJobs = new Map();
const isViewing = (state, id) => state.activeConversationId === id && state.isChatVisible && document.visibilityState === 'visible' && document.hasFocus();

export const useChatStore = create((set, get) => ({
  ...initial,
  reset: () => { pendingIds.clear(); syncAnchors.clear(); historyJobs.clear(); typingTimers.forEach(clearTimeout); typingTimers.clear(); set({ ...initial }); },
  fetchConversations: async () => {
    const version = sessionVersion();
    set({ isLoadingConversations: true });
    try {
      const response = await api.get('/messages/conversations');
      if (isCurrentSession(version)) set({ conversations: response.data.data });
    } catch { if (isCurrentSession(version)) set({ lastError: 'Không tải được danh sách hội thoại.' }); }
    finally { if (isCurrentSession(version)) set({ isLoadingConversations: false }); }
  },
  selectConversation: async (id, friend) => {
    const version = sessionVersion();
    const previous = get().activeConversationId;
    if (previous && previous !== id) getSocket()?.emit('conversation:leave', previous);
    set({ activeConversationId: id, activeFriend: friend, lastError: null, isLoadingMessages: historyJobs.has(id) });
    getSocket()?.emit('conversation:join', id);
    if (await get().fetchMessages(id) && isCurrentSession(version)) await get().markAsSeen(id);
  },
  startConversationWithFriend: async friend => {
    const version = sessionVersion();
    try {
      const conversation = (await api.get('/messages/conversation/' + friend._id)).data.data;
      if (!isCurrentSession(version)) return;
      if (!get().conversations.some(c => c._id === conversation._id)) set({ conversations: [conversation, ...get().conversations] });
      await get().selectConversation(conversation._id, friend);
    } catch (error) { if (isCurrentSession(version)) set({ lastError: error.response?.data?.message || 'Không mở được cuộc trò chuyện.' }); }
  },
  fetchMessages: (id, older = false) => {
    const version = sessionVersion();
    const existing = historyJobs.get(id);
    if (existing) {
      if (!older && existing.older) return existing.promise.then(() => isCurrentSession(version) ? get().fetchMessages(id) : false);
      return existing.promise;
    }
    const record = { older, promise: null };
    const hasAnchor = syncAnchors.has(id);
    const anchor = syncAnchors.get(id);
    const previousCursor = get().cursors[id];
    if (older && !previousCursor) return Promise.resolve(true);
    if (get().activeConversationId === id) set({ isLoadingMessages: true });
    // Defer execution until this job is registered, including synchronous failures.
    const job = Promise.resolve().then(async () => {
      let before = older ? previousCursor : undefined;
      let firstPage, nextCursor;
      const incoming = [];
      const visited = new Set();
      try {
        for (;;) {
          const { data } = await api.get('/messages/' + id, { params: { limit: 50, ...(before ? { before } : {}) } });
          if (!isCurrentSession(version)) return false;
          firstPage ??= data.data;
          incoming.push(...data.data);
          nextCursor = data.pagination?.nextCursor || null;
          if (older || !hasAnchor || data.data.some(message => message._id === anchor) || !nextCursor) break;
          if (visited.has(nextCursor)) throw new Error('Cursor lịch sử bị lặp.');
          visited.add(nextCursor);
          before = nextCursor;
        }
        set(state => ({
          messages: { ...state.messages, [id]: mergeMessages(state.messages[id] || [], incoming) },
          cursors: { ...state.cursors, [id]: older || !hasAnchor ? nextCursor : previousCursor ?? null },
        }));
        if (!older) syncAnchors.set(id, firstPage.at(-1)?._id || null);
        return true;
      } catch {
        if (isCurrentSession(version) && get().activeConversationId === id) set({ lastError: 'Không tải được lịch sử tin nhắn. Hãy thử lại.' });
        return false;
      } finally {
        if (historyJobs.get(id) === record) historyJobs.delete(id);
        if (isCurrentSession(version) && get().activeConversationId === id) set({ isLoadingMessages: false });
      }
    });
    record.promise = job;
    historyJobs.set(id, record);
    return job;
  },
  sendTextMessage: async (text, attachments = []) => {
    const version = sessionVersion();
    const { activeConversationId, activeFriend } = get();
    if (!activeConversationId || !activeFriend) throw new Error('Hãy chọn cuộc trò chuyện.');
    const key = JSON.stringify([activeConversationId, text, attachments]);
    let clientMessageId = pendingIds.get(key);
    if (!clientMessageId) {
      clientMessageId = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      pendingIds.set(key, clientMessageId);
    }
    const payload = { conversationId: activeConversationId, recipientId: activeFriend._id, text, attachments, clientMessageId };
    try {
      let message;
      const socket = getSocket();
      if (socket?.connected) {
        const result = await new Promise(resolve => socket.timeout(5000).emit('message:send', payload, (error, ack) => resolve({ error, ack })));
        if (!isCurrentSession(version)) throw new Error('Phiên đã thay đổi.');
        if (result.error) message = (await api.post('/messages/send', payload)).data.data;
        else {
          if (!result.ack?.success || !result.ack.message) throw new Error(result.ack?.error || 'Gửi tin nhắn thất bại.');
          message = result.ack.message;
        }
      } else message = (await api.post('/messages/send', payload)).data.data;
      if (!isCurrentSession(version)) throw new Error('Phiên đã thay đổi.');
      get().handleIncomingMessage(message);
      pendingIds.delete(key);
      if (get().activeConversationId === activeConversationId) set({ lastError: null });
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Chưa xác nhận được tin nhắn. Hãy thử gửi lại.';
      if (isCurrentSession(version) && get().activeConversationId === activeConversationId) set({ lastError: message });
      throw new Error(message);
    }
  },
  handleIncomingMessage: message => {
    if (!message?._id || !message.conversationId) return;
    const id = message.conversationId, state = get();
    const previous = state.messages[id] || [];
    const duplicate = previous.some(m => m._id === message._id);
    const mine = entityId(message.sender) === useAuthStore.getState().user?._id;
    const viewing = isViewing(state, id);
    set({ messages: { ...state.messages, [id]: mergeMessages(previous, [message]) } });
    if (!duplicate) {
      const conversations = state.conversations.map(c => c._id === id ? {
        ...c,
        ...(Date.parse(message.createdAt) >= (c.lastMessage?.createdAt ? Date.parse(c.lastMessage.createdAt) : 0) ? {
          lastMessage: { text: message.text || '[Tệp đính kèm]', sender: message.sender, createdAt: message.createdAt },
          updatedAt: message.createdAt,
        } : {}),
        unreadCount: viewing ? 0 : (c.unreadCount || 0) + (mine || message.status === 'seen' ? 0 : 1),
      } : c).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      set({ conversations });
      if (!conversations.some(c => c._id === id)) void get().fetchConversations();
    }
    if (!mine && viewing) void get().markAsSeen(id);
  },
  handleSeenAck: ({ conversationId, seenBy, seenAt, messageIds }) => {
    const ids = new Set(messageIds || []);
    set(state => ({ messages: { ...state.messages, [conversationId]: (state.messages[conversationId] || []).map(m => ids.has(m._id) && entityId(m.recipient) === seenBy ? { ...m, status: 'seen' , seenAt } : m) } }));
  },
  setTyping: (id, username, isTyping) => {
    clearTimeout(typingTimers.get(id));
    set(state => ({ isTypingMap: { ...state.isTypingMap, [id]: isTyping ? username : null } }));
    if (isTyping) typingTimers.set(id, setTimeout(() => get().setTyping(id, username, false), 3500));
    else typingTimers.delete(id);
  },
  markAsSeen: async id => {
    const version = sessionVersion();
    if (!isViewing(get(), id)) return;
    const list = get().messages[id] || [], last = list[list.length - 1];
    if (!last) return;
    try {
      await api.put('/messages/' + id + '/seen', { lastReadMessageId: last._id });
      if (!isCurrentSession(version)) return;
      set(state => ({ conversations: state.conversations.map(c => c._id === id ? { ...c, unreadCount: 0 } : c) }));
    } catch { /* Retry when the conversation is focused or reconnected. */ }
  },
  updatePresence: (id, isOnline, lastSeen) => set(state => ({
    activeFriend: state.activeFriend?._id === id ? { ...state.activeFriend, isOnline, lastSeen } : state.activeFriend,
    conversations: state.conversations.map(c => c.friend?._id === id ? { ...c, friend: { ...c.friend, isOnline, lastSeen } } : c),
  })),
}));
