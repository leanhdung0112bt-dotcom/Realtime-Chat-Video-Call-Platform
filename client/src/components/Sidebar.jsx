import React, { useState } from 'react';
import { useAuthStore } from "../store/useAuthStore.js";
import { useChatStore } from "../store/useChatStore.js";
import { useFriendStore } from "../store/useFriendStore.js";
import { MessageSquare, Users, LogOut, Search, Circle } from 'lucide-react';

export const Sidebar = ({ currentTab, setCurrentTab }) => {
  const { user, logout } = useAuthStore();
  const { conversations, activeConversationId, selectConversation } = useChatStore();
  const { receivedRequests } = useFriendStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter((c) => {
    if (!c.friend) return false;
    return c.friend.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-80 h-full flex flex-col bg-slate-900 border-r border-slate-800 shrink-0">
      {/* App Branding & Navigation Switch */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">V-Chat</h2>
              <span className="text-xs text-indigo-400 font-medium">Realtime Hub</span>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-2 gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/40">
          <button
            onClick={() => setCurrentTab('chat')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Đoạn chat
          </button>
          <button
            onClick={() => setCurrentTab('friends')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
              currentTab === 'friends'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Danh bạ
            {receivedRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                {receivedRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conversations / Search */}
      {currentTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search box */}
          <div className="p-3 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-slate-500">Chưa có cuộc trò chuyện nào.</p>
                <button
                  onClick={() => setCurrentTab('friends')}
                  className="mt-3 text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  Mở Danh bạ để tìm bạn
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = activeConversationId === conv._id;
                const friend = conv.friend;
                if (!friend) return null;

                return (
                  <button
                    key={conv._id}
                    onClick={() => selectConversation(conv._id, friend)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/20 border border-indigo-500/30'
                        : 'hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    {/* Avatar with online dot */}
                    <div className="relative shrink-0">
                      <img
                        src={
                          friend.avatar ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`
                        }
                        alt={friend.username}
                        className="w-11 h-11 rounded-full object-cover bg-slate-800 border border-slate-700"
                      />
                      {friend.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                      )}
                    </div>

                    {/* Text info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white truncate">
                          {friend.username}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {conv.lastMessage?.text || 'Bắt đầu cuộc trò chuyện'}
                      </p>
                    </div>

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Friends list shortcut in sidebar if tab is friends */}
      {currentTab === 'friends' && (
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center text-slate-500">
          <Users className="w-10 h-10 mb-2 text-slate-600" />
          <p className="text-xs">Đang mở trình quản lý Danh bạ ở khung chính.</p>
        </div>
      )}

      {/* User Footer Profile */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={
                user?.avatar ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}`
              }
              alt={user?.username}
              className="w-9 h-9 rounded-full bg-slate-800 object-cover border border-slate-700"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user?.username}</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Circle className="w-1.5 h-1.5 fill-current" />
              Đang hoạt động
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Đăng xuất"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
