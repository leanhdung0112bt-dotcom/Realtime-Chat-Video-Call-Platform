import { useState, useEffect } from 'react';
import { useAuthStore } from "./store/useAuthStore.js";
import { useChatStore } from "./store/useChatStore.js";
import { useFriendStore } from "./store/useFriendStore.js";
import { getSocket, initSocket } from "./services/socket.js";
import { Sidebar } from "./components/Sidebar.jsx";
import { ChatArea } from "./components/ChatArea.jsx";
import { FriendView } from "./components/FriendView.jsx";
import { AuthModal } from "./components/AuthModal.jsx";

export function App() {
  const { isAuthenticated, isLoading, user, fetchMe, clearSession } = useAuthStore();
  const activeConversationId = useChatStore(state => state.activeConversationId);
  const [currentTab, setCurrentTab] = useState('chat');
  const [connected, setConnected] = useState(false);
  useEffect(() => { void fetchMe(); }, [fetchMe]);
  useEffect(() => {
    const reset = () => {
      useChatStore.getState().reset();
      useFriendStore.setState({ friends: [], receivedRequests: [], sentRequests: [], searchResults: [], isSearching: false, isLoading: false });
      setConnected(false);
    };
    const refresh = () => { void fetchMe(); };
    const onRefreshed = () => {
      const token = localStorage.getItem('accessToken');
      if (token && useAuthStore.getState().isAuthenticated) {
        useAuthStore.setState({ accessToken: token });
        initSocket(token);
      }
    };
    window.addEventListener('auth:unauthorized', clearSession);
    window.addEventListener('auth:expired', refresh);
    window.addEventListener('auth:refreshed', onRefreshed);
    window.addEventListener('session:cleared', reset);
    return () => {
      window.removeEventListener('auth:unauthorized', clearSession);
      window.removeEventListener('auth:expired', refresh);
      window.removeEventListener('auth:refreshed', onRefreshed);
      window.removeEventListener('session:cleared', reset);
    };
  }, [clearSession, fetchMe]);
  useEffect(() => {
    useChatStore.setState({ isChatVisible: currentTab === 'chat' });
    const mark = () => {
      const chat = useChatStore.getState();
      if (chat.activeConversationId) void chat.markAsSeen(chat.activeConversationId);
    };
    mark();
    window.addEventListener('focus', mark);
    document.addEventListener('visibilitychange', mark);
    return () => { window.removeEventListener('focus', mark); document.removeEventListener('visibilitychange', mark); };
  }, [currentTab]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (!socket) return;
    const refreshContacts = () => {
      void useFriendStore.getState().fetchFriends();
      void useFriendStore.getState().fetchRequests();
      void useChatStore.getState().fetchConversations();
    };
    const onConnect = () => {
      setConnected(true); refreshContacts();
      const chat = useChatStore.getState();
      if (chat.activeConversationId) {
        const id = chat.activeConversationId;
        socket.emit('conversation:join', id);
        void chat.fetchMessages(id).then(success => { if (success) return chat.markAsSeen(id); });
      }
    };
    const handlers = {
      connect: onConnect,
      disconnect: () => setConnected(false),
      'message:received': message => useChatStore.getState().handleIncomingMessage(message),
      'message:seen_ack': data => useChatStore.getState().handleSeenAck(data),
      'typing:status': data => useChatStore.getState().setTyping(data.conversationId, data.username, data.isTyping),
      'user:presence': data => {
        useFriendStore.getState().updateUserPresence(data.userId, data.isOnline, data.lastSeen);
        useChatStore.getState().updatePresence(data.userId, data.isOnline, data.lastSeen);
      },
      'friend:request_received': () => { void useFriendStore.getState().fetchRequests(); },
      'friend:request_accepted': refreshContacts,
      'friend:changed': refreshContacts,
      'operation:error': data => useChatStore.setState({ lastError: data.message }),
    };
    for (const [name, handler] of Object.entries(handlers)) socket.on(name, handler);
    if (socket.connected) onConnect(); else refreshContacts();
    return () => { for (const [name, handler] of Object.entries(handlers)) socket.off(name, handler); };
  }, [isAuthenticated]);
  if (isLoading && !user) return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">Đang kiểm tra phiên đăng nhập...</div>;
  if (!isAuthenticated) return <AuthModal />;
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <main className="flex-1 flex flex-col h-full min-w-0">
        {!connected && <div role="status" className="bg-amber-950 px-4 py-2 text-xs text-amber-200">Đang kết nối lại. Tin nhắn được đồng bộ khi kết nối phục hồi.</div>}
        {currentTab === 'chat' ? <ChatArea key={activeConversationId || 'empty'} /> : <FriendView onOpenChat={() => setCurrentTab('chat')} />}
      </main>
    </div>
  );
}
export default App;
