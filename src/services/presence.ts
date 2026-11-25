import { isAppwriteConfigured, realtime } from '../appwrite/config';
import { clearPendingRealtimePresence } from '../appwrite/realtime';
import { PRESENCE_TTL_MS, type PresenceConnectionState, type UserProfile } from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';
import { syncAppwritePresence } from './profiles';

const HEARTBEAT_INTERVAL_MS = 45_000;
const MIN_WRITE_GAP_MS = 35_000;
const VISIBILITY_REFRESH_GAP_MS = 25_000;

export interface PresenceSessionHandle {
  setOfflineNow: () => Promise<void>;
  dispose: () => void;
}

export function isUserPresenceOnline(user: UserProfile, nowMs = Date.now()): boolean {
  if (!user.isOnline) return false;
  const lastSeenMs = timestampToMillis(user.lastSeen);
  if (!lastSeenMs) {
    return false;
  }
  return nowMs - lastSeenMs <= PRESENCE_TTL_MS;
}

export function isExpiredOrOfflineGuest(user: UserProfile, nowMs = Date.now()): boolean {
  const isGuestAccount = user.role === 'guest' || user.isAnonymous;
  if (!isGuestAccount) return false;
  return !isUserPresenceOnline(user, nowMs);
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
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
    clearPendingRealtimePresence();
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
    clearPendingRealtimePresence();
    if (!disposed) {
      onStateChange('offline');
    }
  };

  const dispose = () => {
    disposed = true;
    clearPendingRealtimePresence();
    window.clearInterval(heartbeatTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handlePageExit);
    window.removeEventListener('pagehide', handlePageExit);
  };

  return { setOfflineNow, dispose };
}
