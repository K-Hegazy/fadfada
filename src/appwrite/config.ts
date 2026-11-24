import {
  Account,
  AppwriteException,
  Channel,
  Client,
  ExecutionMethod,
  Functions,
  ID,
  OAuthProvider,
  Permission,
  Presences,
  Query,
  Realtime,
  Role,
  Storage,
  TablesDB,
  type Models,
} from 'appwrite';
import resources from './resources.json';

const VITE_ENV_OVERRIDES: Record<string, string | undefined> = {
  VITE_APPWRITE_ENDPOINT: import.meta.env?.VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID: import.meta.env?.VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_DATABASE_ID: import.meta.env?.VITE_APPWRITE_DATABASE_ID,
  VITE_APPWRITE_STORAGE_BUCKET_ID: import.meta.env?.VITE_APPWRITE_STORAGE_BUCKET_ID,
  VITE_APPWRITE_ECONOMY_FUNCTION_ID: import.meta.env?.VITE_APPWRITE_ECONOMY_FUNCTION_ID,
  VITE_APPWRITE_ADMIN_FUNCTION_ID: import.meta.env?.VITE_APPWRITE_ADMIN_FUNCTION_ID,
  VITE_APPWRITE_TABLE_USERS: import.meta.env?.VITE_APPWRITE_TABLE_USERS,
  VITE_APPWRITE_TABLE_USER_PRIVATE: import.meta.env?.VITE_APPWRITE_TABLE_USER_PRIVATE,
  VITE_APPWRITE_TABLE_CONVERSATIONS: import.meta.env?.VITE_APPWRITE_TABLE_CONVERSATIONS,
  VITE_APPWRITE_TABLE_MESSAGES: import.meta.env?.VITE_APPWRITE_TABLE_MESSAGES,
  VITE_APPWRITE_TABLE_ROOMS: import.meta.env?.VITE_APPWRITE_TABLE_ROOMS,
  VITE_APPWRITE_TABLE_ROOM_MESSAGES: import.meta.env?.VITE_APPWRITE_TABLE_ROOM_MESSAGES,
  VITE_APPWRITE_TABLE_STORIES: import.meta.env?.VITE_APPWRITE_TABLE_STORIES,
  VITE_APPWRITE_TABLE_WALL_POSTS: import.meta.env?.VITE_APPWRITE_TABLE_WALL_POSTS,
  VITE_APPWRITE_TABLE_WALL_COMMENTS: import.meta.env?.VITE_APPWRITE_TABLE_WALL_COMMENTS,
  VITE_APPWRITE_TABLE_CREATOR_PROPOSALS: import.meta.env?.VITE_APPWRITE_TABLE_CREATOR_PROPOSALS,
  VITE_APPWRITE_TABLE_PROPOSAL_COMMENTS: import.meta.env?.VITE_APPWRITE_TABLE_PROPOSAL_COMMENTS,
  VITE_APPWRITE_TABLE_SECRETS: import.meta.env?.VITE_APPWRITE_TABLE_SECRETS,
  VITE_APPWRITE_TABLE_SECRET_COMMENTS: import.meta.env?.VITE_APPWRITE_TABLE_SECRET_COMMENTS,
  VITE_APPWRITE_TABLE_STORE_ITEMS: import.meta.env?.VITE_APPWRITE_TABLE_STORE_ITEMS,
  VITE_APPWRITE_TABLE_DAILY_TASKS: import.meta.env?.VITE_APPWRITE_TABLE_DAILY_TASKS,
  VITE_APPWRITE_TABLE_DAILY_CLAIMS: import.meta.env?.VITE_APPWRITE_TABLE_DAILY_CLAIMS,
  VITE_APPWRITE_TABLE_COIN_TRANSACTIONS: import.meta.env?.VITE_APPWRITE_TABLE_COIN_TRANSACTIONS,
  VITE_APPWRITE_TABLE_SHOUTOUTS: import.meta.env?.VITE_APPWRITE_TABLE_SHOUTOUTS,
  VITE_APPWRITE_TABLE_RELATIONSHIPS: import.meta.env?.VITE_APPWRITE_TABLE_RELATIONSHIPS,
  VITE_APPWRITE_TABLE_MARRIAGES: import.meta.env?.VITE_APPWRITE_TABLE_MARRIAGES,
  VITE_APPWRITE_TABLE_PROFILE_VISITS: import.meta.env?.VITE_APPWRITE_TABLE_PROFILE_VISITS,
  VITE_APPWRITE_TABLE_NOTIFICATIONS: import.meta.env?.VITE_APPWRITE_TABLE_NOTIFICATIONS,
  VITE_APPWRITE_TABLE_TOPUP_REQUESTS: import.meta.env?.VITE_APPWRITE_TABLE_TOPUP_REQUESTS,
  VITE_APPWRITE_TABLE_REPORTS: import.meta.env?.VITE_APPWRITE_TABLE_REPORTS,
  VITE_APPWRITE_TABLE_APPEALS: import.meta.env?.VITE_APPWRITE_TABLE_APPEALS,
  VITE_APPWRITE_TABLE_SUPPORT_TICKETS: import.meta.env?.VITE_APPWRITE_TABLE_SUPPORT_TICKETS,
  VITE_APPWRITE_TABLE_SITE_SETTINGS: import.meta.env?.VITE_APPWRITE_TABLE_SITE_SETTINGS,
  VITE_APPWRITE_TABLE_MATCH_QUEUE: import.meta.env?.VITE_APPWRITE_TABLE_MATCH_QUEUE,
  VITE_APPWRITE_TABLE_MATCH_SESSIONS: import.meta.env?.VITE_APPWRITE_TABLE_MATCH_SESSIONS,
  VITE_APPWRITE_TABLE_MATCH_MESSAGES: import.meta.env?.VITE_APPWRITE_TABLE_MATCH_MESSAGES,
  VITE_APPWRITE_TABLE_MATCH_CANDIDATES: import.meta.env?.VITE_APPWRITE_TABLE_MATCH_CANDIDATES,
};

function readViteEnv(key: string, fallback = ''): string {
  const fromVite = VITE_ENV_OVERRIDES[key];
  if (typeof fromVite === 'string' && fromVite.trim().length > 0) {
    return fromVite.trim();
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return String(process.env[key]).trim();
  }
  return fallback;
}

export const APPWRITE_CONFIG = {
  endpoint: readViteEnv('VITE_APPWRITE_ENDPOINT', resources.endpoint || 'https://fra.cloud.appwrite.io/v1'),
  projectId: readViteEnv('VITE_APPWRITE_PROJECT_ID', resources.projectId || '6b022cc5002da26b7487'),
  databaseId: readViteEnv('VITE_APPWRITE_DATABASE_ID', resources.databaseId),
  bucketId: readViteEnv('VITE_APPWRITE_STORAGE_BUCKET_ID', resources.bucketId),
  economyFunctionId: readViteEnv('VITE_APPWRITE_ECONOMY_FUNCTION_ID', resources.economyFunctionId),
  adminFunctionId: readViteEnv('VITE_APPWRITE_ADMIN_FUNCTION_ID', resources.adminFunctionId),
  tables: {
    users: readViteEnv('VITE_APPWRITE_TABLE_USERS', resources.tables.users),
    userPrivate: readViteEnv('VITE_APPWRITE_TABLE_USER_PRIVATE', resources.tables.userPrivate),
    conversations: readViteEnv('VITE_APPWRITE_TABLE_CONVERSATIONS', resources.tables.conversations),
    messages: readViteEnv('VITE_APPWRITE_TABLE_MESSAGES', resources.tables.messages),
    rooms: readViteEnv('VITE_APPWRITE_TABLE_ROOMS', resources.tables.rooms),
    roomMessages: readViteEnv('VITE_APPWRITE_TABLE_ROOM_MESSAGES', resources.tables.roomMessages),
    stories: readViteEnv('VITE_APPWRITE_TABLE_STORIES', resources.tables.stories),
    wallPosts: readViteEnv('VITE_APPWRITE_TABLE_WALL_POSTS', resources.tables.wallPosts),
    wallComments: readViteEnv('VITE_APPWRITE_TABLE_WALL_COMMENTS', resources.tables.wallComments),
    creatorProposals: readViteEnv('VITE_APPWRITE_TABLE_CREATOR_PROPOSALS', resources.tables.creatorProposals),
    proposalComments: readViteEnv('VITE_APPWRITE_TABLE_PROPOSAL_COMMENTS', resources.tables.proposalComments),
    secrets: readViteEnv('VITE_APPWRITE_TABLE_SECRETS', resources.tables.secrets),
    secretComments: readViteEnv('VITE_APPWRITE_TABLE_SECRET_COMMENTS', resources.tables.secretComments),
    storeItems: readViteEnv('VITE_APPWRITE_TABLE_STORE_ITEMS', resources.tables.storeItems),
    dailyTasks: readViteEnv('VITE_APPWRITE_TABLE_DAILY_TASKS', resources.tables.dailyTasks),
    dailyClaims: readViteEnv('VITE_APPWRITE_TABLE_DAILY_CLAIMS', resources.tables.dailyClaims),
    coinTransactions: readViteEnv('VITE_APPWRITE_TABLE_COIN_TRANSACTIONS', resources.tables.coinTransactions),
    shoutouts: readViteEnv('VITE_APPWRITE_TABLE_SHOUTOUTS', resources.tables.shoutouts),
    relationships: readViteEnv('VITE_APPWRITE_TABLE_RELATIONSHIPS', resources.tables.relationships),
    marriages: readViteEnv('VITE_APPWRITE_TABLE_MARRIAGES', resources.tables.marriages),
    profileVisits: readViteEnv('VITE_APPWRITE_TABLE_PROFILE_VISITS', resources.tables.profileVisits),
    notifications: readViteEnv('VITE_APPWRITE_TABLE_NOTIFICATIONS', resources.tables.notifications),
    topupRequests: readViteEnv('VITE_APPWRITE_TABLE_TOPUP_REQUESTS', resources.tables.topupRequests),
    reports: readViteEnv('VITE_APPWRITE_TABLE_REPORTS', resources.tables.reports),
    appeals: readViteEnv('VITE_APPWRITE_TABLE_APPEALS', resources.tables.appeals),
    supportTickets: readViteEnv('VITE_APPWRITE_TABLE_SUPPORT_TICKETS', resources.tables.supportTickets),
    siteSettings: readViteEnv('VITE_APPWRITE_TABLE_SITE_SETTINGS', resources.tables.siteSettings),
    matchQueue: readViteEnv('VITE_APPWRITE_TABLE_MATCH_QUEUE', resources.tables.matchQueue),
    matchSessions: readViteEnv('VITE_APPWRITE_TABLE_MATCH_SESSIONS', resources.tables.matchSessions),
    matchMessages: readViteEnv('VITE_APPWRITE_TABLE_MATCH_MESSAGES', resources.tables.matchMessages),
    matchCandidates: readViteEnv('VITE_APPWRITE_TABLE_MATCH_CANDIDATES', resources.tables.matchCandidates),
  },
} as const;

const hasAllTableIds = Object.values(APPWRITE_CONFIG.tables).every(
  (tableId) => typeof tableId === 'string' && tableId.trim().length > 0
);

export const isAppwriteConfigured = Boolean(
  APPWRITE_CONFIG.endpoint &&
    APPWRITE_CONFIG.projectId &&
    APPWRITE_CONFIG.databaseId &&
    APPWRITE_CONFIG.bucketId &&
    APPWRITE_CONFIG.economyFunctionId &&
    APPWRITE_CONFIG.adminFunctionId &&
    hasAllTableIds
);

export const appwriteConfigError = isAppwriteConfigured
  ? null
  : !APPWRITE_CONFIG.projectId
    ? 'إعدادات الاتصال بخدمة Appwrite غير مكتملة حاليًا.'
    : 'تعذّر تهيئة الاتصال بخدمة Appwrite حاليًا. يرجى المحاولة لاحقًا أو التواصل مع إدارة المنصة.';

export const client = new Client().setEndpoint(APPWRITE_CONFIG.endpoint);

if (APPWRITE_CONFIG.projectId) {
  client.setProject(APPWRITE_CONFIG.projectId);
}

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const realtime = new Realtime(client);
export const presences = new Presences(client);

export function assertAppwriteConfigured(): void {
  if (!isAppwriteConfigured) {
    throw new Error(
      appwriteConfigError ?? 'إعدادات Appwrite غير مكتملة.'
    );
  }
}

/**
 * Appwrite row $id limit is 36 characters (a-z, A-Z, 0-9, ., -, _) and cannot start with a symbol.
 * For composite keys like `${uidA}_${uidB}` (>40 chars), derive a deterministic <=24 char row ID.
 */
export function deterministicRowId(prefix: string, rawKey: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'r';
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < rawKey.length; i += 1) {
    const code = rawKey.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + ((h1 << 5) | (h1 >>> 27));
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${safePrefix}_${h1.toString(36)}${h2.toString(36)}`.slice(0, 32);
}

export {
  AppwriteException,
  Channel,
  ExecutionMethod,
  ID,
  OAuthProvider,
  Permission,
  Query,
  Role,
  type Models,
};
