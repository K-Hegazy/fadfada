import { getToken } from './api';

type MessageHandler = (data: any) => void;

class SocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private pingInterval: any = null;
  private isExplicitlyClosed = false;

  constructor() {
    // Reconnect automatically when browser window regains focus or network reconnects
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.isConnected()) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected()) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
    }
  }

  isConnected(): boolean {
    return !!(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  connect() {
    const token = getToken();
    if (!token) return;

    this.isExplicitlyClosed = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${token}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setupHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          // Handle server-side ping/pong heartbeat
          if (payload.type === 'ping') {
            this.send({ type: 'pong' });
            return;
          }

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
        this.clearHeartbeat();
        if (this.isExplicitlyClosed) return;

        // Custom closure codes for auth failure
        if (event.code === 4001 || event.code === 4002) {
          return;
        }

        // Exponential backoff reconnect: 1s, 2s, 4s, capped at 10s with jitter
        this.reconnectAttempts++;
        const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (!this.isConnected() && !this.isExplicitlyClosed) {
            this.connect();
          }
        }, delay);
      };

      this.socket.onerror = (error) => {
        console.warn('WebSocket connection warning:', error);
      };
    } catch (e) {
      console.error('Socket connection error:', e);
    }
  }

  private setupHeartbeat() {
    this.clearHeartbeat();
    // Send a client ping every 25 seconds to keep connection alive through Cloud Run load balancers
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private clearHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.clearHeartbeat();
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
