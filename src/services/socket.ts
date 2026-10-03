import { getToken } from './api';

type MessageHandler = (data: any) => void;

class SocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: any = null;

  connect() {
    const token = getToken();
    if (!token) return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${token}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Connected
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type) {
            const handlers = this.listeners.get(payload.type);
            if (handlers) {
              handlers.forEach(handler => handler(payload));
            }
          }
          // Also broadcast to generic message listener
          const allHandlers = this.listeners.get('*');
          if (allHandlers) {
            allHandlers.forEach(handler => handler(payload));
          }
        } catch (e) {
          console.error('Socket message parse error:', e);
        }
      };

      this.socket.onclose = (event) => {
        if (event.code !== 4001 && event.code !== 4002) {
          // Attempt reconnect after 3 seconds
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.socket.onerror = (error) => {
        console.warn('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Socket connection error:', e);
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  on(eventType: string, handler: MessageHandler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType: string, handler: MessageHandler) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}

export const socketService = new SocketService();
