import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client, Query, Storage, TablesDB, Users } from 'node-appwrite';
import {
  DEFAULT_GUEST_TTL_MS,
  DEFAULT_RETENTION_DAYS,
  runScheduledMaintenance,
  type CleanupTablesMap,
} from './cleanup-old-messages-logic.ts';

interface ResourcesConfig {
  endpoint?: string;
  projectId?: string;
  databaseId?: string;
  bucketId?: string;
  tables?: Partial<CleanupTablesMap>;
}

function loadResourcesFallback(): ResourcesConfig {
  try {
    const resourcesPath = path.resolve(process.cwd(), 'src', 'appwrite', 'resources.json');
    if (fs.existsSync(resourcesPath)) {
      return JSON.parse(fs.readFileSync(resourcesPath, 'utf8')) as ResourcesConfig;
    }
  } catch {
    // Fallback to defaults if resources.json cannot be parsed
  }
  return {};
}

async function run(): Promise<void> {
  const resources = loadResourcesFallback();

  const endpoint = (
    process.env.VITE_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    resources.endpoint ||
    'https://fra.cloud.appwrite.io/v1'
  ).trim();
  const projectId = (
    process.env.VITE_APPWRITE_PROJECT_ID ||
    process.env.APPWRITE_PROJECT_ID ||
    resources.projectId ||
    ''
  ).trim();
  const apiKey = (process.env.APPWRITE_API_KEY || '').trim();
  const databaseId = (
    process.env.APPWRITE_DATABASE_ID ||
    process.env.VITE_APPWRITE_DATABASE_ID ||
    resources.databaseId ||
    'fadfada_db'
  ).trim();
  const bucketId = (
    process.env.APPWRITE_STORAGE_BUCKET_ID ||
    process.env.VITE_APPWRITE_STORAGE_BUCKET_ID ||
    resources.bucketId ||
    'fadfada_media'
  ).trim();

  if (!endpoint || !projectId || !apiKey) {
    console.error(
      'Missing required Appwrite cleanup env vars (endpoint, projectId, or APPWRITE_API_KEY).'
    );
    process.exit(1);
  }

  const tables: CleanupTablesMap = {
    users: process.env.APPWRITE_TABLE_USERS || process.env.VITE_APPWRITE_TABLE_USERS || resources.tables?.users || 'users',
    userPrivate:
      process.env.APPWRITE_TABLE_USER_PRIVATE ||
      process.env.VITE_APPWRITE_TABLE_USER_PRIVATE ||
      resources.tables?.userPrivate ||
      'user_private',
    messages:
      process.env.APPWRITE_TABLE_MESSAGES ||
      process.env.VITE_APPWRITE_TABLE_MESSAGES ||
      resources.tables?.messages ||
      'messages',
    rooms: process.env.APPWRITE_TABLE_ROOMS || process.env.VITE_APPWRITE_TABLE_ROOMS || resources.tables?.rooms || 'rooms',
    roomMessages:
      process.env.APPWRITE_TABLE_ROOM_MESSAGES ||
      process.env.VITE_APPWRITE_TABLE_ROOM_MESSAGES ||
      resources.tables?.roomMessages ||
      'room_messages',
    wallPosts:
      process.env.APPWRITE_TABLE_WALL_POSTS ||
      process.env.VITE_APPWRITE_TABLE_WALL_POSTS ||
      resources.tables?.wallPosts ||
      'wall_posts',
    stories:
      process.env.APPWRITE_TABLE_STORIES ||
      process.env.VITE_APPWRITE_TABLE_STORIES ||
      resources.tables?.stories ||
      'stories',
    storeItems:
      process.env.APPWRITE_TABLE_STORE_ITEMS ||
      process.env.VITE_APPWRITE_TABLE_STORE_ITEMS ||
      resources.tables?.storeItems ||
      'store_items',
    siteSettings:
      process.env.APPWRITE_TABLE_SITE_SETTINGS ||
      process.env.VITE_APPWRITE_TABLE_SITE_SETTINGS ||
      resources.tables?.siteSettings ||
      'site_settings',
    dailyClaims:
      process.env.APPWRITE_TABLE_DAILY_CLAIMS ||
      process.env.VITE_APPWRITE_TABLE_DAILY_CLAIMS ||
      resources.tables?.dailyClaims ||
      'daily_claims',
    notifications:
      process.env.APPWRITE_TABLE_NOTIFICATIONS ||
      process.env.VITE_APPWRITE_TABLE_NOTIFICATIONS ||
      resources.tables?.notifications ||
      'notifications',
    profileVisits:
      process.env.APPWRITE_TABLE_PROFILE_VISITS ||
      process.env.VITE_APPWRITE_TABLE_PROFILE_VISITS ||
      resources.tables?.profileVisits ||
      'profile_visits',
    matchQueue:
      process.env.APPWRITE_TABLE_MATCH_QUEUE ||
      process.env.VITE_APPWRITE_TABLE_MATCH_QUEUE ||
      resources.tables?.matchQueue ||
      'match_queue',
  };

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const tablesDB = new TablesDB(client);
  const usersApi = new Users(client);
  const storageApi = new Storage(client);

  const retentionDaysEnv = Number(process.env.APPWRITE_MESSAGE_RETENTION_DAYS || 0);
  const retentionDays =
    Number.isFinite(retentionDaysEnv) && retentionDaysEnv >= 1
      ? retentionDaysEnv
      : DEFAULT_RETENTION_DAYS;

  const ttlMinutes = Number(process.env.APPWRITE_GUEST_TTL_MINUTES || 0);
  const guestTtlMs =
    Number.isFinite(ttlMinutes) && ttlMinutes > 0
      ? ttlMinutes * 60 * 1000
      : DEFAULT_GUEST_TTL_MS;

  const result = await runScheduledMaintenance({
    isScheduledTrigger: true,
    payload: { mode: 'all', retentionDays, guestTtlMs },
    tablesDB,
    usersApi,
    storageApi,
    databaseId,
    bucketId,
    tables,
    Query,
  });

  console.log(
    JSON.stringify({
      ok: result.ok,
      cutoffIso: result.messages?.cutoffIso ?? null,
      deletedMessages: result.messages?.deletedMessages ?? 0,
      deletedRoomMessages: result.messages?.deletedRoomMessages ?? 0,
      deletedFiles: result.messages?.deletedFiles ?? 0,
      skippedReferencedFiles: result.messages?.skippedReferencedFiles ?? 0,
      scannedGuests: result.guests?.scannedGuests ?? 0,
      deletedGuests: result.guests?.deletedGuests ?? 0,
    })
  );
}

void run().catch((err) => {
  console.error('Cleanup execution failed:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
