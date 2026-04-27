import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getWsUrl(): string {
  if (typeof window !== 'undefined') {
    // In the browser, connect to the same host (works behind Docker/nginx)
    return `${window.location.protocol}//${window.location.hostname}:3001/ws`;
  }
  return 'http://localhost:3001/ws';
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getWsUrl(), {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}
