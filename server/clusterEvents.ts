import pg from 'pg';
const { Client, Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

export const INSTANCE_ID = `inst_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
const CHANNEL_NAME = 'fadfada_cluster_events';

interface ClusterEventPayload {
  senderInstanceId: string;
  channel: 'room' | 'user' | 'presence' | 'all' | 'audio' | 'tod';
  target?: string;
  payload: any;
  excludeUserId?: string;
  timestamp: number;
}

export interface ClusterHandlers {
  onRoomBroadcast: (roomId: string, message: any, excludeUserId?: string) => void;
  onUserSend: (userId: string, message: any) => void;
  onPresenceBroadcast: (userId: string, isOnline: boolean, customActivityStatus?: string) => void;
  onGeneralBroadcast: (message: any) => void;
  onAudioBroadcast?: (roomId: string, message: any) => void;
  onTodBroadcast?: (message: any) => void;
}

let listenerClient: pg.Client | null = null;
let senderPool: pg.Pool | null = null;
let clusterHandlers: ClusterHandlers | null = null;
let isReconnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let isDestroyed = false;

function getSenderPool(): pg.Pool {
  if (!senderPool) {
    senderPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 5,
      connectionTimeoutMillis: 10000,
    });
    senderPool.on('error', () => {
      // Idle client errors in pool are safely handled by pg pool lifecycle
    });
  }
  return senderPool;
}

export async function initClusterEvents(handlers: ClusterHandlers) {
  clusterHandlers = handlers;
  
  if (!process.env.SQL_HOST) {
    return;
  }

  // Connect listener with gentle backoff
  scheduleReconnect(100);
}

function clearExistingListener() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (listenerClient) {
    try {
      listenerClient.removeAllListeners();
      listenerClient.end().catch(() => {});
    } catch {}
    listenerClient = null;
  }
}

async function connectListener() {
  if (isDestroyed || !process.env.SQL_HOST || isReconnecting) return;
  isReconnecting = true;

  try {
    clearExistingListener();

    const client = new Client({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      keepAlive: true,
      statement_timeout: 0,
    });

    client.on('error', (err: any) => {
      const msg = err?.message || '';
      // Gracefully handle expected disconnects from Cloud SQL proxy recycling or scale-to-zero
      if (
        msg.includes('administrator command') ||
        msg.includes('terminated unexpectedly') ||
        msg.includes('Connection closed') ||
        msg.includes('Connection refused')
      ) {
        scheduleReconnect(5000);
      } else {
        scheduleReconnect(8000);
      }
    });

    client.on('end', () => {
      scheduleReconnect(3000);
    });

    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL_NAME || !msg.payload) return;
      try {
        const data: ClusterEventPayload = JSON.parse(msg.payload);
        
        // Ignore events sent by this same instance (already handled locally)
        if (data.senderInstanceId === INSTANCE_ID) {
          return;
        }

        if (!clusterHandlers) return;

        switch (data.channel) {
          case 'room':
            if (data.target) {
              clusterHandlers.onRoomBroadcast(data.target, data.payload, data.excludeUserId);
            }
            break;
          case 'user':
            if (data.target) {
              clusterHandlers.onUserSend(data.target, data.payload);
            }
            break;
          case 'presence':
            if (data.target) {
              clusterHandlers.onPresenceBroadcast(
                data.target,
                data.payload.isOnline,
                data.payload.customActivityStatus
              );
            }
            break;
          case 'audio':
            if (data.target && clusterHandlers.onAudioBroadcast) {
              clusterHandlers.onAudioBroadcast(data.target, data.payload);
            }
            break;
          case 'tod':
            if (clusterHandlers.onTodBroadcast) {
              clusterHandlers.onTodBroadcast(data.payload);
            }
            break;
          case 'all':
            clusterHandlers.onGeneralBroadcast(data.payload);
            break;
        }
      } catch {}
    });

    await client.connect();
    await client.query(`LISTEN ${CHANNEL_NAME}`);
    listenerClient = client;
    isReconnecting = false;

    // Periodic gentle keepalive query every 40s to keep connection healthy through Cloud SQL Auth proxy
    pingInterval = setInterval(() => {
      if (listenerClient) {
        listenerClient.query('SELECT 1').catch(() => {
          scheduleReconnect(1000);
        });
      }
    }, 40000);
  } catch (err: any) {
    isReconnecting = false;
    scheduleReconnect(6000);
  }
}

function scheduleReconnect(delay = 5000) {
  if (isDestroyed || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectListener().catch(() => {});
  }, delay);
}

/**
 * Publish real-time event to all other running server instances on Cloud Run
 */
export async function publishClusterEvent(event: {
  channel: 'room' | 'user' | 'presence' | 'all' | 'audio' | 'tod';
  target?: string;
  payload: any;
  excludeUserId?: string;
}): Promise<void> {
  if (!process.env.SQL_HOST) return;

  const data: ClusterEventPayload = {
    senderInstanceId: INSTANCE_ID,
    channel: event.channel,
    target: event.target,
    payload: event.payload,
    excludeUserId: event.excludeUserId,
    timestamp: Date.now()
  };

  const rawJson = JSON.stringify(data);

  // Send via PostgreSQL NOTIFY for sub-5ms cross-instance delivery
  try {
    const pool = getSenderPool();
    await pool.query(
      `SELECT pg_notify($1, $2)`,
      [CHANNEL_NAME, rawJson]
    );

    // Also persist into cluster_events table for durability
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    await pool.query(
      `INSERT INTO cluster_events (id, channel, payload, created_at) VALUES ($1, $2, $3, NOW())`,
      [eventId, event.channel, rawJson]
    );

    // Periodically prune events older than 1 hour to keep table lean
    if (Math.random() < 0.05) {
      pool.query(`DELETE FROM cluster_events WHERE created_at < NOW() - INTERVAL '1 hour'`).catch(() => {});
    }
  } catch (err: any) {
    // Non-blocking: failure to notify external instance does not break local flow
  }
}

export function shutdownCluster() {
  isDestroyed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  clearExistingListener();
  if (senderPool) {
    senderPool.end().catch(() => {});
    senderPool = null;
  }
}
