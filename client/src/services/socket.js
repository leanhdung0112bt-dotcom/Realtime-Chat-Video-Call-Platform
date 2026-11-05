import { io } from 'socket.io-client';

import { SERVER_URL } from "./api.js";
let socket = null;
export function initSocket(_token) {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      auth: callback => callback({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000,
    });
    socket.on('auth:expired', () => window.dispatchEvent(new Event('auth:expired')));
    socket.on('connect_error', error => {
      if (error.message.includes('Phiên đăng nhập')) window.dispatchEvent(new Event('auth:expired'));
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}
export const getSocket = () => socket;
export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
