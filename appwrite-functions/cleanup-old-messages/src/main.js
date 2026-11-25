import { Client, Query, Storage, TablesDB, Users } from 'node-appwrite';
import { CleanupHttpError, DEFAULT_GUEST_TTL_MS, runScheduledMaintenance } from './logic.js';

const TABLES = {
  users: process.env.APPWRITE_TABLE_USERS || 'users',
  userPrivate: process.env.APPWRITE_TABLE_USER_PRIVATE || 'user_private',
  messages: process.env.APPWRITE_TABLE_MESSAGES || 'messages',
  rooms: process.env.APPWRITE_TABLE_ROOMS || 'rooms',
  roomMessages: process.env.APPWRITE_TABLE_ROOM_MESSAGES || 'room_messages',
  wallPosts: process.env.APPWRITE_TABLE_WALL_POSTS || 'wall_posts',
  stories: process.env.APPWRITE_TABLE_STORIES || 'stories',
  storeItems: process.env.APPWRITE_TABLE_STORE_ITEMS || 'store_items',
  siteSettings: process.env.APPWRITE_TABLE_SITE_SETTINGS || 'site_settings',
  dailyClaims: process.env.APPWRITE_TABLE_DAILY_CLAIMS || 'daily_claims',
  notifications: process.env.APPWRITE_TABLE_NOTIFICATIONS || 'notifications',
  profileVisits: process.env.APPWRITE_TABLE_PROFILE_VISITS || 'profile_visits',
  matchQueue: process.env.APPWRITE_TABLE_MATCH_QUEUE || 'match_queue',
};

export default async ({ req, res, log, error }) => {
  try {
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
    const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '';
    const callerUid = req.headers['x-appwrite-user-id'] || '';
    const trigger = String(req.headers['x-appwrite-trigger'] || '').toLowerCase();
    const databaseId = process.env.APPWRITE_DATABASE_ID || 'fadfada_db';
    const bucketId = process.env.APPWRITE_STORAGE_BUCKET_ID || 'fadfada_media';

    if (!projectId || !apiKey) {
      return res.json({ ok: false, error: 'خادم التنظيف غير مهيأ بمفاتيح المشروع.' }, 500);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const tablesDB = new TablesDB(client);
    const usersApi = new Users(client);
    const storageApi = new Storage(client);

    const body = typeof req.body === 'string' && req.body.trim()
      ? JSON.parse(req.body)
      : req.body && typeof req.body === 'object'
      ? req.body
      : {};

    const ttlMinutes = Number(process.env.APPWRITE_GUEST_TTL_MINUTES || 0);
    const guestTtlMs = Number.isFinite(ttlMinutes) && ttlMinutes > 0
      ? ttlMinutes * 60 * 1000
      : DEFAULT_GUEST_TTL_MS;

    const isScheduledTrigger = trigger === 'schedule' || (trigger === 'event' && !callerUid);
    log?.(`cleanup-old-messages trigger=${trigger || 'http'} uid=${callerUid || 'system'}`);

    const data = await runScheduledMaintenance({
      callerUid,
      isScheduledTrigger,
      payload: { ...body, guestTtlMs },
      tablesDB,
      usersApi,
      storageApi,
      databaseId,
      bucketId,
      tables: TABLES,
      Query,
    });

    return res.json({ ok: true, data }, 200);
  } catch (err) {
    const status = err instanceof CleanupHttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ التنظيف المجدول.';
    error?.(message);
    return res.json({ ok: false, error: message }, status);
  }
};
