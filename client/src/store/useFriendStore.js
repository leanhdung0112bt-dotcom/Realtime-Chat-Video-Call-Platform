import { create } from 'zustand';
import api from '../services/api.js';
import { sessionVersion, isCurrentSession } from '../services/session.js';
let searchSequence = 0;

export const useFriendStore = create((set, get) => ({
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  searchResults: [],
  isSearching: false,
  isLoading: false,

  fetchFriends: async () => {
    const version = sessionVersion();
    try {
      const response = await api.get('/friends/all');
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      set({ friends: response.data.data });
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      console.error('fetchFriends error:', err);
    }
  },

  fetchRequests: async () => {
    const version = sessionVersion();
    try {
      const response = await api.get('/friends/requests');
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      set({
        receivedRequests: response.data.data.received || [],
        sentRequests: response.data.data.sent || [],
      });
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      console.error('fetchRequests error:', err);
    }
  },

  searchUsers: async (query) => {
    const version = sessionVersion();
    const sequence = ++searchSequence;
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const response = await api.get(`/friends/search?query=${encodeURIComponent(query)}`);
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      if (sequence !== searchSequence) return;
      set({ searchResults: response.data.data, isSearching: false });
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      if (sequence !== searchSequence) return;
      console.error('searchUsers error:', err);
      set({ isSearching: false });
    }
  },

  sendFriendRequest: async (recipientId) => {
    const version = sessionVersion();
    try {
      const response = await api.post('/friends/request', { recipientId });
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      // Update local search results relationship status
      const updatedSearch = get().searchResults.map((user) =>
        user._id === recipientId
          ? { ...user, relationship: response.data.data?.conversationId ? 'friends'  : 'pending_sent'  }
          : user
      );
      set({ searchResults: updatedSearch });
      await Promise.all([get().fetchRequests(), get().fetchFriends()]);
      if (!isCurrentSession(version)) return { success: false };
      return { success: true, message: response.data.message };
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to send friend request',
      };
    }
  },

  acceptFriendRequest: async (requestId) => {
    const version = sessionVersion();
    try {
      const response = await api.put(`/friends/request/${requestId}/accept`);
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      await Promise.all([get().fetchFriends(), get().fetchRequests()]);
      if (!isCurrentSession(version)) return { success: false };
      return {
        success: true,
        data: response.data.data,
        message: 'Accepted friend request',
      };
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to accept friend request',
      };
    }
  },

  declineFriendRequest: async (requestId) => {
    const version = sessionVersion();
    try {
      await api.delete(`/friends/request/${requestId}/decline`);
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      await get().fetchRequests();
      return { success: true };
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to decline friend request',
      };
    }
  },

  removeFriend: async (friendId) => {
    const version = sessionVersion();
    try {
      await api.delete(`/friends/${friendId}`);
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      set({
        friends: get().friends.filter((f) => f.user._id !== friendId),
      });
      return { success: true };
    } catch (err) {
      if (!isCurrentSession(version)) return { success: false };
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to remove friend',
      };
    }
  },

  updateUserPresence: (userId, isOnline, lastSeen) => {
    set({
      friends: get().friends.map((f) =>
        f.user._id === userId
          ? {
              ...f,
              user: {
                ...f.user,
                isOnline,
                lastSeen: lastSeen || f.user.lastSeen,
              },
            }
          : f
      ),
    });
  },

  addReceivedRequest: (request) => {
    set({
      receivedRequests: [request, ...get().receivedRequests],
    });
  },
}));
