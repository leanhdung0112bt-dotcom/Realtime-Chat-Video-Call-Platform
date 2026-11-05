import React, { useState } from 'react';
import { useFriendStore } from "../store/useFriendStore.js";
import { useChatStore } from "../store/useChatStore.js";
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  MessageCircle,
  UserX,
  Check,
  X,
  Loader2,
  Clock,
} from 'lucide-react';

export const FriendView = ({ onOpenChat }) => {
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    friends,
    receivedRequests,
    sentRequests,
    searchResults,
    isSearching,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useFriendStore();

  const { startConversationWithFriend } = useChatStore();

  const handleSearch = (e) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const handleStartChat = async (user) => {
    await startConversationWithFriend(user);
    onOpenChat();
  };

  const onlineFriends = friends.filter((f) => f.user.isOnline);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/50">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Danh bạ bạn bè</h1>
            <p className="text-xs text-slate-400">Quản lý các kết nối và kết bạn mới</p>
          </div>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 text-xs">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tất cả ({friends.length})
          </button>
          <button
            onClick={() => setActiveSubTab('online')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeSubTab === 'online'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Online ({onlineFriends.length})
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer relative ${
              activeSubTab === 'requests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lời mời ({receivedRequests.length})
            {receivedRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                {receivedRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('add')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'add'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Thêm bạn
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: ALL FRIENDS */}
        {activeSubTab === 'all' && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Danh sách bạn bè ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Bạn chưa có bạn bè nào.</p>
                <button
                  onClick={() => setActiveSubTab('add')}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Tìm và kết bạn ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {friends.map((item) => (
                  <div
                    key={item.friendshipId}
                    className="p-3.5 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={
                            item.user.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${item.user.username}`
                          }
                          alt={item.user.username}
                          className="w-12 h-12 rounded-full object-cover bg-slate-700 border border-slate-600"
                        />
                        {item.user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {item.user.username}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">{item.user.email}</p>
                        <span
                          className={`inline-block text-[11px] mt-0.5 ${
                            item.user.isOnline ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {item.user.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartChat(item.user)}
                        title="Nhắn tin"
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFriend(item.user._id)}
                        title="Hủy kết bạn"
                        className="p-2.5 bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ONLINE FRIENDS */}
        {activeSubTab === 'online' && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Bạn bè đang trực tuyến ({onlineFriends.length})
            </h2>
            {onlineFriends.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Hiện tại không có bạn bè nào đang online.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {onlineFriends.map((item) => (
                  <div
                    key={item.friendshipId}
                    className="p-3.5 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={
                            item.user.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${item.user.username}`
                          }
                          alt={item.user.username}
                          className="w-12 h-12 rounded-full object-cover bg-slate-700 border border-slate-600"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {item.user.username}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">{item.user.email}</p>
                        <span className="text-[11px] text-emerald-400">Đang hoạt động</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartChat(item.user)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Nhắn tin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FRIEND REQUESTS */}
        {activeSubTab === 'requests' && (
          <div className="space-y-8">
            {/* Received Requests */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Lời mời đã nhận ({receivedRequests.length})
              </h2>

              {receivedRequests.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-800/30 p-4 rounded-xl">
                  Không có lời mời kết bạn nào đang chờ.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {receivedRequests.map((req) => (
                    <div
                      key={req._id}
                      className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            req.requester.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${req.requester.username}`
                          }
                          alt={req.requester.username}
                          className="w-11 h-11 rounded-full object-cover bg-slate-700"
                        />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">
                            {req.requester.username}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">{req.requester.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => acceptFriendRequest(req._id)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                          title="Chấp nhận"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineFriendRequest(req._id)}
                          className="p-2 bg-slate-700 hover:bg-rose-500/30 text-slate-300 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                          title="Từ chối"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Requests */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Lời mời đã gửi ({sentRequests.length})
              </h2>

              {sentRequests.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-800/30 p-4 rounded-xl">
                  Bạn chưa gửi lời mời kết bạn nào.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sentRequests.map((req) => (
                    <div
                      key={req._id}
                      className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            req.recipient.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${req.recipient.username}`
                          }
                          alt={req.recipient.username}
                          className="w-11 h-11 rounded-full object-cover bg-slate-700"
                        />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">
                            {req.recipient.username}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">{req.recipient.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => declineFriendRequest(req._id)}
                        className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 cursor-pointer"
                      >
                        Huỷ lời mời
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ADD FRIEND (SEARCH) */}
        {activeSubTab === 'add' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-2">Tìm kiếm bạn bè mới</h2>
              <p className="text-xs text-slate-400 mb-4">
                Nhập email hoặc username chính xác để tìm và gửi lời mời kết bạn.
              </p>

              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập email hoặc username..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tìm kiếm'}
                </button>
              </form>
            </div>

            {/* Search results list */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                Kết quả tìm kiếm
              </h3>

              {searchResults.length === 0 ? (
                <div className="text-center py-10 bg-slate-800/20 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  {searchQuery ? 'Không tìm thấy người dùng nào phù hợp.' : 'Hãy nhập từ khóa để tìm bạn.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            user.avatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`
                          }
                          alt={user.username}
                          className="w-11 h-11 rounded-full object-cover bg-slate-700"
                        />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">
                            {user.username}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* Action buttons depending on relationship */}
                      <div>
                        {user.relationship === 'friends' && (
                          <button
                            onClick={() => handleStartChat(user)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Nhắn tin
                          </button>
                        )}
                        {user.relationship === 'pending_sent' && (
                          <span className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-lg border border-slate-700">
                            Đã gửi lời mời
                          </span>
                        )}
                        {user.relationship === 'pending_received' && user.friendshipId && (
                          <button
                            onClick={() => acceptFriendRequest(user.friendshipId)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Chấp nhận
                          </button>
                        )}
                        {user.relationship === 'none' && (
                          <button
                            onClick={() => sendFriendRequest(user._id)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Kết bạn
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
