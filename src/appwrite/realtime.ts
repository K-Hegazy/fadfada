import {
  APPWRITE_CONFIG,
  Channel,
  isAppwriteConfigured,
  realtime,
  type Models,
} from './config';
import { parseAppwriteError } from './errors';
import { listTableRows, type AppwriteRow } from './tables';

type InternalRealtimeShape = {
  reconnect?: boolean;
  activeSubscriptions?: Map<string, unknown>;
  pendingPresence?: unknown;
  createSocket?: () => Promise<void>;
  closeSocket?: () => Promise<void>;
};

let resilienceInitialized = false;
let hasConnectedOnce = false;
let needsResyncOnOpen = false;
const reconnectListeners = new Set<() => void>();

function notifyReconnectListeners(): void {
  for (const listener of reconnectListeners) {
    try {
      listener();
    } catch {
      // Non-blocking reconnect resync
    }
  }
}

function ensureRealtimeResilience(): void {
  if (resilienceInitialized || !isAppwriteConfigured || typeof window === 'undefined') {
    return;
  }
  resilienceInitialized = true;

  const rt = realtime as unknown as InternalRealtimeShape;

  realtime.onOpen?.(() => {
    if (!hasConnectedOnce) {
      hasConnectedOnce = true;
      needsResyncOnOpen = false;
      return;
    }
    if (needsResyncOnOpen) {
      needsResyncOnOpen = false;
      notifyReconnectListeners();
    }
  });

  realtime.onClose?.(() => {
    if (hasConnectedOnce) {
      needsResyncOnOpen = true;
    }
  });

  realtime.onError(() => {
    if (hasConnectedOnce) {
      needsResyncOnOpen = true;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      rt.reconnect = false;
    }
  });

  window.addEventListener('offline', () => {
    if (hasConnectedOnce) {
      needsResyncOnOpen = true;
    }
    rt.reconnect = false;
    void rt.closeSocket?.().catch(() => {});
  });

  window.addEventListener('online', () => {
    needsResyncOnOpen = true;
    const hasWork = Boolean(rt.activeSubscriptions?.size || rt.pendingPresence);
    if (!hasWork) return;
    rt.reconnect = true;
    void rt.createSocket?.().catch(() => {});
    notifyReconnectListeners();
  });
}

export async function disconnectRealtime(): Promise<void> {
  hasConnectedOnce = false;
  needsResyncOnOpen = false;
  if (!isAppwriteConfigured) return;
  try {
    await realtime.disconnect();
  } catch {
    // Ignore already closed socket errors
  }
}

export function clearPendingRealtimePresence(): void {
  if (!isAppwriteConfigured) return;
  const rt = realtime as unknown as InternalRealtimeShape;
  rt.pendingPresence = undefined;
}

export interface TableSubscriptionOptions<T> {
  tableId: string;
  queries?: string[];
  mapRow: (row: AppwriteRow) => T;
  getKey?: (item: T, raw: AppwriteRow) => string;
  matchesRow?: (item: T, raw: AppwriteRow) => boolean;
  sort?: (a: T, b: T) => number;
  limit?: number;
  onData: (items: T[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscribes to an Appwrite TablesDB table via initial fetch + Appwrite Realtime WebSocket channel.
 * Properly cleans up even if unmounted before the WebSocket promise settles, and resyncs on reconnect.
 */
export function subscribeToTableRows<T>({
  tableId,
  queries = [],
  mapRow,
  getKey,
  matchesRow,
  sort,
  limit,
  onData,
  onError,
}: TableSubscriptionOptions<T>): () => void {
  if (!isAppwriteConfigured) {
    onData([]);
    return () => {};
  }

  ensureRealtimeResilience();
  let disposed = false;
  const rowsByKey = new Map<string, T>();
  let subscriptionHandle: { unsubscribe: () => Promise<void> } | null = null;
  let loadingInitial = false;
  let resyncPending = false;

  const resolveKey = (item: T, raw: AppwriteRow): string => {
    if (getKey) return getKey(item, raw);
    if (typeof raw.$id === 'string' && raw.$id) return raw.$id;
    const candidate = item as { id?: string; uid?: string };
    return candidate.id || candidate.uid || '';
  };

  const emit = () => {
    if (disposed) return;
    let list = Array.from(rowsByKey.values());
    if (sort) list = list.sort(sort);
    if (typeof limit === 'number' && limit > 0) list = list.slice(0, limit);
    onData(list);
  };

  const loadInitial = async () => {
    if (disposed) return;
    if (loadingInitial) {
      resyncPending = true;
      return;
    }
    loadingInitial = true;
    try {
      const rows = await listTableRows(tableId, queries);
      if (disposed) return;
      rowsByKey.clear();
      for (const raw of rows) {
        const mapped = mapRow(raw);
        if (!matchesRow || matchesRow(mapped, raw)) {
          const k = resolveKey(mapped, raw);
          if (k) rowsByKey.set(k, mapped);
        }
      }
      emit();
    } catch (error) {
      if (!disposed && onError) {
        onError(parseAppwriteError(error));
      }
    } finally {
      loadingInitial = false;
      if (resyncPending && !disposed) {
        resyncPending = false;
        void loadInitial();
      }
    }
  };

  const handleReconnect = () => {
    void loadInitial();
  };
  reconnectListeners.add(handleReconnect);

  void loadInitial();

  const channel = Channel.tablesdb(APPWRITE_CONFIG.databaseId).table(tableId).row();

  realtime
    .subscribe<AppwriteRow>(channel, (event) => {
      if (disposed || !event.payload) return;
      const raw = event.payload;
      const mapped = mapRow(raw);
      const key = resolveKey(mapped, raw);
      if (!key) return;

      const isDelete = event.events.some((e) => e.endsWith('.delete'));
      if (isDelete || (matchesRow && !matchesRow(mapped, raw))) {
        rowsByKey.delete(key);
      } else {
        rowsByKey.set(key, mapped);
      }
      emit();
    })
    .then((sub) => {
      if (disposed) {
        void sub.unsubscribe().catch(() => {});
      } else {
        subscriptionHandle = sub;
      }
    })
    .catch((err) => {
      if (!disposed && onError) {
        onError(parseAppwriteError(err));
      }
    });

  return () => {
    disposed = true;
    reconnectListeners.delete(handleReconnect);
    if (subscriptionHandle) {
      const sub = subscriptionHandle;
      subscriptionHandle = null;
      void sub.unsubscribe().catch(() => {});
    }
  };
}

export function subscribeToSingleRow<T>(options: {
  tableId: string;
  rowId: string;
  fetchRow: () => Promise<T | null>;
  mapRow: (row: AppwriteRow) => T;
  onData: (item: T | null) => void;
  onError?: (error: Error) => void;
}): () => void {
  if (!isAppwriteConfigured) {
    options.onData(null);
    return () => {};
  }

  ensureRealtimeResilience();
  let disposed = false;
  let subscriptionHandle: { unsubscribe: () => Promise<void> } | null = null;
  let loadingSingle = false;

  const loadSingle = async () => {
    if (disposed || loadingSingle) return;
    loadingSingle = true;
    try {
      const item = await options.fetchRow();
      if (!disposed) options.onData(item);
    } catch (err) {
      if (!disposed && options.onError) options.onError(parseAppwriteError(err));
    } finally {
      loadingSingle = false;
    }
  };

  const handleReconnect = () => {
    void loadSingle();
  };
  reconnectListeners.add(handleReconnect);

  void loadSingle();

  const channel = Channel.tablesdb(APPWRITE_CONFIG.databaseId)
    .table(options.tableId)
    .row(options.rowId);

  realtime
    .subscribe<AppwriteRow>(channel, (event) => {
      if (disposed || !event.payload) return;
      const isDelete = event.events.some((e) => e.endsWith('.delete'));
      if (isDelete) {
        options.onData(null);
        return;
      }
      options.onData(options.mapRow(event.payload));
    })
    .then((sub) => {
      if (disposed) {
        void sub.unsubscribe().catch(() => {});
      } else {
        subscriptionHandle = sub;
      }
    })
    .catch(() => {});

  return () => {
    disposed = true;
    reconnectListeners.delete(handleReconnect);
    if (subscriptionHandle) {
      const sub = subscriptionHandle;
      subscriptionHandle = null;
      void sub.unsubscribe().catch(() => {});
    }
  };
}

export function subscribeToAccountEvents(onEvent: () => void): () => void {
  if (!isAppwriteConfigured) return () => {};
  ensureRealtimeResilience();
  let disposed = false;
  let subHandle: { unsubscribe: () => Promise<void> } | null = null;

  realtime
    .subscribe<Models.User<Models.Preferences>>(Channel.account(), () => {
      if (!disposed) onEvent();
    })
    .then((sub) => {
      if (disposed) {
        void sub.unsubscribe().catch(() => {});
      } else {
        subHandle = sub;
      }
    })
    .catch(() => {});

  return () => {
    disposed = true;
    if (subHandle) {
      const s = subHandle;
      subHandle = null;
      void s.unsubscribe().catch(() => {});
    }
  };
}
