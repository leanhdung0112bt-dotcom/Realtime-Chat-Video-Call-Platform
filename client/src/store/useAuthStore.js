import { create } from 'zustand';
import api from '../services/api.js';
import { initSocket, disconnectSocket } from '../services/socket.js';
import { sessionVersion, isCurrentSession, rotateSession } from '../services/session.js';

export const useAuthStore = create((set, get) => {
  const applySession = data => {
    if (!data?.user?._id || !data.accessToken || !data.refreshToken) throw new Error('Phản hồi đăng nhập không hợp lệ.');
    rotateSession(); disconnectSocket();
    window.dispatchEvent(new Event('session:cleared'));
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    initSocket(data.accessToken);
    set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
  };
  const authenticate = async (path, payload) => {
    const version = sessionVersion();
    set({ isLoading: true });
    try {
      const response = await api.post(path, payload);
      if (!isCurrentSession(version)) return { success: false, message: 'Phiên đã thay đổi.' };
      applySession(response.data.data);
      return { success: true };
    } catch (error) {
      if (isCurrentSession(version)) set({ isLoading: false });
      return { success: false, message: error.response?.data?.message || error.message || 'Không thể đăng nhập.' };
    }
  };
  return {
    user: null, accessToken: null, isAuthenticated: false, isLoading: !!localStorage.getItem('accessToken'),
    login: (identifier, password) => authenticate('/auth/login', { identifier, password }),
    register: (username, email, password, avatar) => authenticate('/auth/register', { username, email, password, avatar }),
    clearSession: () => {
      rotateSession(); disconnectSocket();
      localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken');
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      window.dispatchEvent(new Event('session:cleared'));
    },
    logout: async () => {
      const version = sessionVersion();
      try { await api.post('/auth/logout'); }
      catch { /* Clear the current local session even when the network fails. */ }
      finally { if (isCurrentSession(version)) get().clearSession(); }
    },
    fetchMe: async () => {
      if (!localStorage.getItem('accessToken')) { set({ isLoading: false }); return; }
      const version = sessionVersion();
      set({ isLoading: true });
      try {
        const user = (await api.get('/auth/me')).data.data;
        if (!isCurrentSession(version)) return;
        const token = localStorage.getItem('accessToken');
        initSocket(token);
        set({ user, accessToken: token, isAuthenticated: true, isLoading: false });
      } catch (error) {
        if (!isCurrentSession(version)) return;
        if (error.response?.status === 401) get().clearSession();
        else set({ isLoading: false });
      }
    },
    updateUser: updated => { const user = get().user; if (user) set({ user: { ...user, ...updated } }); },
  };
});
