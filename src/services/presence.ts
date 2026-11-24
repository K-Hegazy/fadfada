import { isAppwriteConfigured, realtime } from '../appwrite/config';
import { PRESENCE_TTL_MS, type PresenceConnectionState, type UserProfile } from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';
import { syncAppwritePresence } from './profiles';

const HEARTBEAT_INTERVAL_MS = 60_000;
const MIN_WRITE_GAP_MS = 45_000;
const VISIBILITY_REFRESH_GAP_MS = 30_000;

export interface PresenceSessionHandle {
  setOfflineNow: () => Promise<void>;
  dispose: () => void;
}

export function isUserPresenceOnline(user: UserProfile, nowMs = Date.now()): boolean {
  if (!user.isOnline) return false;
  const lastSeenMs = timestampToMillis(user.lastSeen);
  if (!lastSeenMs) {
    return true;
  }
  return nowMs - lastSeenMs <= PRESENCE_TTL_MS;
}

export function startRealtimePresence(
  uid: string,
  onStateChange: (state: PresenceConnectionState) => void
): PresenceSessionHandle {
  let disposed = false;
  let lastWriteMs = 0;

  onStateChange('connecting');

  const upsertAppwriteRealtimePresence = async (online: boolean) => {
    if (!isAppwriteConfigured) return;
    try {
      await realtime.upsertPresence({
        status: online ? 'online' : 'offline',
        presenceId: uid,
      });
    } catch {
      // Presence channel requires active project realtime endpoint; non-blocking fallback to row sync
    }
  };

  const writePresence = async (online: boolean, force = false) => {
    if (disposed && online) return;
    const now = Date.now();
    if (online && !force && now - lastWriteMs < MIN_WRITE_GAP_MS) {
      return;
    }
    lastWriteMs = now;
    try {
      await Promise.all([
        upsertAppwriteRealtimePresence(online),
        syncAppwritePresence(uid, online),
      ]);
      if (!disposed) {
        onStateChange(online ? 'connected' : 'offline');
      }
    } catch {
      if (!disposed) {
        onStateChange('offline');
      }
    }
  };

  void writePresence(true, true);

  const heartbeatTimer = window.setInterval(() => {
    if (disposed || document.visibilityState !== 'visible') return;
    void writePresence(true, false);
  }, HEARTBEAT_INTERVAL_MS);

  const handleVisibilityChange = () => {
    if (disposed) return;
    if (document.visibilityState === 'visible') {
      const elapsed = Date.now() - lastWriteMs;
      if (elapsed >= VISIBILITY_REFRESH_GAP_MS) {
        void writePresence(true, true);
      }
    }
  };

  const handlePageExit = () => {
    if (disposed) return;
    void upsertAppwriteRealtimePresence(false);
    void syncAppwritePresence(uid, false);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handlePageExit);
  window.addEventListener('pagehide', handlePageExit);

  const setOfflineNow = async () => {
    await Promise.all([
      upsertAppwriteRealtimePresence(false),
      syncAppwritePresence(uid, false),
    ]);
    if (!disposed) {
      onStateChange('offline');
    }
  };

  const dispose = () => {
    disposed = true;
    window.clearInterval(heartbeatTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handlePageExit);
    window.removeEventListener('pagehide', handlePageExit);
  };

  return { setOfflineNow, dispose };
}
