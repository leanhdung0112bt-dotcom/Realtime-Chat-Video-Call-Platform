import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from "../store/useAuthStore.js";
import { useChatStore } from "../store/useChatStore.js";
import { getSocket } from "../services/socket.js";
import api, { fileUrl } from "../services/api.js";
import { sessionVersion, isCurrentSession } from "../services/session.js";
import {
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Phone,
  Video,
  Info,
  Loader2,
  FileText,
} from 'lucide-react';

export const ChatArea = () => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    activeFriend,
    messages,
    isTypingMap,
    isLoadingMessages,
    sendTextMessage,
    fetchMessages,
    cursors,
    lastError,
  } = useChatStore();

  const [inputVal, setInputVal] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scrollRef = useRef(null);
  const followBottom = useRef(true);
  const lastTypingEmit = useRef(0);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mounted = useRef(false);

  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const lastMessageId = currentMessages[currentMessages.length - 1]?._id;
  const typingUser = activeConversationId ? isTypingMap[activeConversationId] : null;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (followBottom.current) scrollToBottom();
  }, [currentMessages.length, lastMessageId, typingUser]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (activeConversationId) getSocket()?.emit('typing:stop', { conversationId: activeConversationId });
    };
  }, [activeConversationId]);

  const loadOlder = async () => {
    if (!activeConversationId || !scrollRef.current) return;
    const element = scrollRef.current, height = element.scrollHeight, top = element.scrollTop;
    followBottom.current = false;
    await fetchMessages(activeConversationId, true);
    requestAnimationFrame(() => { element.scrollTop = top + element.scrollHeight - height; });
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputVal(e.target.value);

    const socket = getSocket();
    if (!socket || !activeConversationId || !activeFriend) return;

    // Emit typing start
    if (Date.now() - lastTypingEmit.current > 1000) {
      socket.emit('typing:start', { conversationId: activeConversationId });
      lastTypingEmit.current = Date.now();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: activeConversationId,
        recipientId: activeFriend._id,
      });
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSending || isUploading || (!inputVal.trim() && pendingAttachments.length === 0) || !activeConversationId) return;

    const version = sessionVersion();
    const textToSend = inputVal.trim();
    const attachmentsToSend = [...pendingAttachments];

    setIsSending(true);

    // Stop typing indicator immediately
    const socket = getSocket();
    if (socket && activeFriend) {
      socket.emit('typing:stop', {
        conversationId: activeConversationId,
        recipientId: activeFriend._id,
      });
    }

    try {
      await sendTextMessage(textToSend, attachmentsToSend);
      if (!mounted.current || !isCurrentSession(version)) return;
      setInputVal(''); setPendingAttachments([]); followBottom.current = true; scrollToBottom();
    } catch { /* Keep the draft and attachments for an explicit retry. */ }
    finally { if (mounted.current && isCurrentSession(version)) setIsSending(false); }
  };

  // Handle local file upload with Multer
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadConversationId = activeConversationId;
    const version = sessionVersion();
    setIsUploading(true); setUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) throw new Error('File vượt quá giới hạn 20 MB.');
        if (files.length + pendingAttachments.length > 5) throw new Error('Tối đa 5 file mỗi tin nhắn.');
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/upload', formData, {
          onUploadProgress: event => { if (mounted.current && isCurrentSession(version)) setUploadProgress(Math.round(100 * event.loaded / (event.total || file.size))); },
        });

        if (!mounted.current || !isCurrentSession(version) || useChatStore.getState().activeConversationId !== uploadConversationId) return;
        if (res.data.success) {
          const uploadData = res.data.data;
          setPendingAttachments((prev) => [
            ...prev,
            {
              url: uploadData.url,
              fileType: uploadData.mimetype,
              fileName: uploadData.originalName,
              fileSize: uploadData.size,
            },
          ]);
        }
      }
    } catch (err) {
      if (!mounted.current || !isCurrentSession(version)) return;
      useChatStore.setState({ lastError: err.response?.data?.message || err.message || 'Tải file thất bại.' });
    } finally {
      if (mounted.current && isCurrentSession(version)) setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatMessageTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!activeFriend || !activeConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/30 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
          <Info className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Chưa chọn cuộc trò chuyện</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Chọn một người bạn từ danh sách trò chuyện bên trái hoặc mở Danh bạ để bắt đầu nhắn tin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/40 relative">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={
                activeFriend.avatar ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${activeFriend.username}`
              }
              alt={activeFriend.username}
              className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700"
            />
            {activeFriend.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            )}
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">{activeFriend.username}</h2>
            <p className="text-[11px] text-slate-400">
              {activeFriend.isOnline ? (
                <span className="text-emerald-400 font-medium">Đang hoạt động</span>
              ) : activeFriend.lastSeen ? (
                `Hoạt động lúc ${formatMessageTime(activeFriend.lastSeen)}`
              ) : (
                'Ngoại tuyến'
              )}
            </p>
          </div>
        </div>

        {/* Video / Voice Call Actions (UI Prepared for Level 2 & 3) */}
        <div className="flex items-center gap-2">
          <button
            title="Gọi thoại chưa được triển khai"
            disabled
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            title="Gọi video chưa được triển khai"
            disabled
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {lastError && <div role="alert" className="px-4 py-2 text-sm text-rose-300 bg-rose-950/40">{lastError}</div>}
      {isUploading && <div role="status" className="px-4 py-1 text-xs text-indigo-300">Đang tải file {uploadProgress}%</div>}
      {/* Message List */}
      <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="flex-1 overflow-y-auto p-6 space-y-4">
        {cursors[activeConversationId] && <button type="button" disabled={isLoadingMessages} onClick={loadOlder} className="block mx-auto text-xs text-indigo-300 disabled:opacity-50">{isLoadingMessages ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}</button>}
        {isLoadingMessages && currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Đang tải lịch sử tin nhắn...</span>
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
            <p>Chưa có tin nhắn nào trong cuộc trò chuyện này.</p>
            <p className="text-slate-600 mt-1">Hãy gửi lời chào đầu tiên!</p>
          </div>
        ) : (
          currentMessages.map((msg) => {
            const senderId =
              typeof msg.sender === 'object' ? (msg.sender )._id : msg.sender;
            const isMe = senderId === user?._id;

            return (
              <div
                key={msg._id}
                className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <img
                    src={
                      activeFriend.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${activeFriend.username}`
                    }
                    alt={activeFriend.username}
                    className="w-7 h-7 rounded-full bg-slate-800 object-cover shrink-0 mb-1"
                  />
                )}

                <div
                  className={`max-w-[70%] sm:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-md shadow-indigo-600/10'
                      : 'bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/60'
                  }`}
                >
                  {/* Attachments rendering */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {msg.attachments.map((att, idx) => {
                        const isImg = att.fileType.startsWith('image/');
                        return isImg ? (
                          <a
                            key={idx}
                            href={fileUrl(att.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg overflow-hidden border border-white/10"
                          >
                            <img
                              src={fileUrl(att.url)}
                              alt={att.fileName}
                              className="max-h-60 rounded-lg object-cover w-full"
                            />
                          </a>
                        ) : (
                          <a
                            key={idx}
                            href={fileUrl(att.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2 bg-black/20 hover:bg-black/30 rounded-lg text-xs transition-colors"
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">{att.fileName}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Text content */}
                  {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}

                  {/* Metadata (Time + Status) */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                      isMe ? 'text-indigo-200/80' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>

                    {/* Delivery / Seen status icons for current user */}
                    {isMe && (
                      <span className="flex items-center">
                        {msg.status === 'sent' && (
                          <Check className="w-3.5 h-3.5 text-indigo-200" aria-label="Đã gửi" />
                        )}
                        {msg.status === 'delivered' && (
                          <CheckCheck
                            className="w-3.5 h-3.5 text-slate-300"
                            aria-label="Đã nhận"
                          />
                        )}
                        {msg.status === 'seen' && (
                          <CheckCheck
                            className="w-3.5 h-3.5 text-cyan-300 font-bold"
                            aria-label="Đã xem"
                          />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Realtime Typing Indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
            <span className="flex gap-1 items-center px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="ml-1.5 text-slate-300">{typingUser} đang soạn tin...</span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Attachments Bar */}
      {pendingAttachments.length > 0 && (
        <div className="px-6 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          {pendingAttachments.map((att, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg text-xs text-slate-300 border border-slate-700"
            >
              {att.fileType.startsWith('image/') ? (
                <img src={fileUrl(att.url)} alt={att.fileName} className="w-12 h-12 object-cover rounded" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span className="truncate max-w-[120px]">{att.fileName}</span>
              <button
                type="button"
                onClick={() =>
                  setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                }
                className="ml-1 text-slate-500 hover:text-rose-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Message Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* File Upload Hidden Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            multiple
          />

          <button
            type="button"
            disabled={isUploading || isSending}
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm file hoặc ảnh"
            className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          <input
            type="text"
            disabled={isSending}
            value={inputVal}
            onChange={handleInputChange}
            placeholder={`Nhắn tin cho @${activeFriend.username}...`}
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />

          <button
            type="submit"
            disabled={isSending || isUploading || (!inputVal.trim() && pendingAttachments.length === 0)}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
