import { socketService } from './socket';

export interface PresencePayload<T = any> {
  key: string;
  newPresences?: T[];
  leftPresences?: T[];
  currentPresences?: T[];
}

export type PresenceEvent = 'sync' | 'join' | 'leave';

export interface PresenceCallback<T = any> {
  event: PresenceEvent;
  callback: (payload: PresencePayload<T>) => void;
}

export interface BroadcastCallback<T = any> {
  event: string;
  callback: (payload: { event: string; payload: T }) => void;
}

export class RealtimeChannel {
  public name: string;
  private presenceKey: string;
  private state: Record<string, any[]> = {};
  private presenceCallbacks: PresenceCallback[] = [];
  private broadcastCallbacks: BroadcastCallback[] = [];
  private isSubscribed: boolean = false;
  private socketCleanups: (() => void)[] = [];
  private currentTrackState: any = null;

  constructor(name: string, config?: { config?: { presence?: { key?: string } } }) {
    this.name = name;
    this.presenceKey = config?.config?.presence?.key || '';
  }

  on(
    type: 'presence' | 'broadcast',
    filter: { event: string },
    callback: (payload: any) => void
  ): this {
    if (type === 'presence') {
      this.presenceCallbacks.push({
        event: filter.event as PresenceEvent,
        callback
      });
    } else if (type === 'broadcast') {
      this.broadcastCallbacks.push({
        event: filter.event,
        callback
      });
    }
    return this;
  }

  subscribe(statusCallback?: (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR') => void): this {
    if (this.isSubscribed) {
      if (statusCallback) statusCallback('SUBSCRIBED');
      return this;
    }

    this.isSubscribed = true;

    // 1. Presence updates from live real-time WebSocket
    const unsubPresence = socketService.on('presence:update', (data: any) => {
      if (!data || !data.userId) return;

      // If event has a target channel, only process if it matches this channel
      if (data.channel && data.channel !== this.name) return;
      // If this channel is a chat-presence channel, ignore global un-channeled presence updates
      if (!data.channel && this.name.startsWith('chat-presence-')) return;

      const userId = data.userId;
      const isOnline = !!data.isOnline;
      const userData = data.user || { id: userId, isOnline };

      if (isOnline) {
        const newPresences = [userData];
        this.state[userId] = newPresences;

        // Trigger 'join' event
        this.emitPresence('join', {
          key: userId,
          newPresences,
          currentPresences: this.state[userId]
        });

        // Trigger 'sync' event
        this.emitPresence('sync', {
          key: userId,
          currentPresences: Object.values(this.state).flat()
        });
      } else {
        const leftPresences = this.state[userId] || [{ id: userId, isOnline: false }];
        delete this.state[userId];

        // Trigger 'leave' event
        this.emitPresence('leave', {
          key: userId,
          leftPresences,
          currentPresences: Object.values(this.state).flat()
        });

        // Trigger 'sync' event
        this.emitPresence('sync', {
          key: userId,
          currentPresences: Object.values(this.state).flat()
        });
      }
    });
    this.socketCleanups.push(unsubPresence);

    // 2. Broadcast events from socket (e.g. message:new, typing, etc.)
    const unsubAll = socketService.on('*', (payload: any) => {
      if (!payload || !payload.type) return;
      this.emitBroadcast(payload.type, payload);
    });
    this.socketCleanups.push(unsubAll);

    if (statusCallback) {
      setTimeout(() => {
        if (this.isSubscribed) {
          statusCallback('SUBSCRIBED');
        }
      }, 5);
    }

    return this;
  }

  private emitPresence(event: PresenceEvent, payload: PresencePayload) {
    for (const item of this.presenceCallbacks) {
      if (item.event === event) {
        try {
          item.callback(payload);
        } catch (e) {
          console.error(`Error in Supabase Realtime presence [${event}] handler:`, e);
        }
      }
    }
  }

  private emitBroadcast(event: string, payload: any) {
    for (const item of this.broadcastCallbacks) {
      if (item.event === event || item.event === '*') {
        try {
          item.callback({ event, payload });
        } catch (e) {
          console.error(`Error in Supabase Realtime broadcast [${event}] handler:`, e);
        }
      }
    }
  }

  async send(params: { type: 'broadcast'; event: string; payload: any }): Promise<'ok' | 'error'> {
    socketService.send({
      type: params.event,
      channel: this.name,
      ...params.payload
    });
    return 'ok';
  }

  async track(state: any): Promise<'ok' | 'error'> {
    this.currentTrackState = state;
    const key = this.presenceKey || state?.id;
    if (key) {
      this.state[key] = [state];
      socketService.send({
        type: 'presence:track',
        channel: this.name,
        state
      });
      // Fire join and sync locally
      this.emitPresence('join', { key, newPresences: [state], currentPresences: [state] });
      this.emitPresence('sync', { key, currentPresences: Object.values(this.state).flat() });
    }
    return 'ok';
  }

  async untrack(): Promise<'ok' | 'error'> {
    const key = this.presenceKey || this.currentTrackState?.id;
    if (key && this.state[key]) {
      const leftPresences = this.state[key];
      delete this.state[key];
      socketService.send({
        type: 'presence:untrack',
        channel: this.name,
        key
      });
      this.emitPresence('leave', { key, leftPresences, currentPresences: Object.values(this.state).flat() });
      this.emitPresence('sync', { key, currentPresences: Object.values(this.state).flat() });
    }
    this.currentTrackState = null;
    return 'ok';
  }

  presenceState<T = any>(): Record<string, T[]> {
    return { ...this.state } as Record<string, T[]>;
  }

  unsubscribe(): 'ok' {
    this.isSubscribed = false;
    this.socketCleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {}
    });
    this.socketCleanups = [];
    this.presenceCallbacks = [];
    this.broadcastCallbacks = [];
    return 'ok';
  }
}

class SupabaseRealtimeClient {
  private channels: Map<string, RealtimeChannel> = new Map();

  channel(name: string, config?: { config?: { presence?: { key?: string } } }): RealtimeChannel {
    if (this.channels.has(name)) {
      const existing = this.channels.get(name)!;
      existing.unsubscribe();
      this.channels.delete(name);
    }
    const channel = new RealtimeChannel(name, config);
    this.channels.set(name, channel);
    return channel;
  }

  removeChannel(channel: RealtimeChannel) {
    channel.unsubscribe();
    this.channels.delete(channel.name);
  }

  removeAllChannels() {
    this.channels.forEach(ch => ch.unsubscribe());
    this.channels.clear();
  }
}

export const supabase = new SupabaseRealtimeClient();
