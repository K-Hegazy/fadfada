import { Client, ID, Permission, Query, Role, TablesDB, Users } from 'node-appwrite';
import { handleEconomyAction, HttpError } from './logic.js';

const TABLES = {
  users: process.env.APPWRITE_TABLE_USERS || 'users',
  userPrivate: process.env.APPWRITE_TABLE_USER_PRIVATE || 'user_private',
  conversations: process.env.APPWRITE_TABLE_CONVERSATIONS || 'conversations',
  messages: process.env.APPWRITE_TABLE_MESSAGES || 'messages',
  rooms: process.env.APPWRITE_TABLE_ROOMS || 'rooms',
  roomMessages: process.env.APPWRITE_TABLE_ROOM_MESSAGES || 'room_messages',
  wallPosts: process.env.APPWRITE_TABLE_WALL_POSTS || 'wall_posts',
  wallComments: process.env.APPWRITE_TABLE_WALL_COMMENTS || 'wall_comments',
  proposalComments: process.env.APPWRITE_TABLE_PROPOSAL_COMMENTS || 'proposal_comments',
  secrets: process.env.APPWRITE_TABLE_SECRETS || 'secrets',
  secretComments: process.env.APPWRITE_TABLE_SECRET_COMMENTS || 'secret_comments',
  storeItems: process.env.APPWRITE_TABLE_STORE_ITEMS || 'store_items',
  dailyTasks: process.env.APPWRITE_TABLE_DAILY_TASKS || 'daily_tasks',
  dailyClaims: process.env.APPWRITE_TABLE_DAILY_CLAIMS || 'daily_claims',
  coinTransactions: process.env.APPWRITE_TABLE_COIN_TRANSACTIONS || 'coin_transactions',
  shoutouts: process.env.APPWRITE_TABLE_SHOUTOUTS || 'shoutouts',
  relationships: process.env.APPWRITE_TABLE_RELATIONSHIPS || 'relationships',
  marriages: process.env.APPWRITE_TABLE_MARRIAGES || 'marriages',
  profileVisits: process.env.APPWRITE_TABLE_PROFILE_VISITS || 'profile_visits',
  notifications: process.env.APPWRITE_TABLE_NOTIFICATIONS || 'notifications',
  topupRequests: process.env.APPWRITE_TABLE_TOPUP_REQUESTS || 'topup_requests',
  reports: process.env.APPWRITE_TABLE_REPORTS || 'reports',
  appeals: process.env.APPWRITE_TABLE_APPEALS || 'appeals',
  supportTickets: process.env.APPWRITE_TABLE_SUPPORT_TICKETS || 'support_tickets',
  siteSettings: process.env.APPWRITE_TABLE_SITE_SETTINGS || 'site_settings',
  matchQueue: process.env.APPWRITE_TABLE_MATCH_QUEUE || 'match_queue',
  matchSessions: process.env.APPWRITE_TABLE_MATCH_SESSIONS || 'match_sessions',
  matchMessages: process.env.APPWRITE_TABLE_MATCH_MESSAGES || 'match_messages',
  matchCandidates: process.env.APPWRITE_TABLE_MATCH_CANDIDATES || 'match_candidates',
};

export default async ({ req, res, log, error }) => {
  try {
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
    const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '';
    const callerUid = req.headers['x-appwrite-user-id'] || '';
    const databaseId = process.env.APPWRITE_DATABASE_ID || 'fadfada_db';

    if (!projectId || !apiKey) {
      return res.json({ ok: false, error: 'خادم Appwrite Function غير مهيأ بمفاتيح المشروع.' }, 500);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const tablesDB = new TablesDB(client);
    const usersApi = new Users(client);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { action, ...payload } = body;

    log?.(`fadfada-economy action=${action} uid=${callerUid}`);

    const data = await handleEconomyAction({
      callerUid,
      action,
      payload,
      tablesDB,
      usersApi,
      databaseId,
      tables: TABLES,
      Permission,
      Role,
      ID,
      Query,
    });

    return res.json({ ok: true, data }, 200);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع في الخادم.';
    error?.(message);
    return res.json({ ok: false, error: message }, status);
  }
};
