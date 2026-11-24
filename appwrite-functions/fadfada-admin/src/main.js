import { Client, ID, Permission, Query, Role, TablesDB, Users } from 'node-appwrite';
import { AdminHttpError, handleAdminAction } from './logic.js';

const TABLES = {
  users: process.env.APPWRITE_TABLE_USERS || 'users',
  rooms: process.env.APPWRITE_TABLE_ROOMS || 'rooms',
  stories: process.env.APPWRITE_TABLE_STORIES || 'stories',
  wallPosts: process.env.APPWRITE_TABLE_WALL_POSTS || 'wall_posts',
  creatorProposals: process.env.APPWRITE_TABLE_CREATOR_PROPOSALS || 'creator_proposals',
  storeItems: process.env.APPWRITE_TABLE_STORE_ITEMS || 'store_items',
  dailyTasks: process.env.APPWRITE_TABLE_DAILY_TASKS || 'daily_tasks',
  coinTransactions: process.env.APPWRITE_TABLE_COIN_TRANSACTIONS || 'coin_transactions',
  notifications: process.env.APPWRITE_TABLE_NOTIFICATIONS || 'notifications',
  topupRequests: process.env.APPWRITE_TABLE_TOPUP_REQUESTS || 'topup_requests',
  reports: process.env.APPWRITE_TABLE_REPORTS || 'reports',
  appeals: process.env.APPWRITE_TABLE_APPEALS || 'appeals',
  supportTickets: process.env.APPWRITE_TABLE_SUPPORT_TICKETS || 'support_tickets',
  siteSettings: process.env.APPWRITE_TABLE_SITE_SETTINGS || 'site_settings',
};

export default async ({ req, res, log, error }) => {
  try {
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
    const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '';
    const callerUid = req.headers['x-appwrite-user-id'] || '';
    const databaseId = process.env.APPWRITE_DATABASE_ID || 'fadfada_db';

    if (!projectId || !apiKey) {
      return res.json({ ok: false, error: 'خادم Appwrite Admin Function غير مهيأ بمفاتيح المشروع.' }, 500);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const tablesDB = new TablesDB(client);
    const usersApi = new Users(client);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { action, ...payload } = body;

    log?.(`fadfada-admin action=${action} uid=${callerUid}`);

    const data = await handleAdminAction({
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
    const status = err instanceof AdminHttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'حدث خطأ في خادم الإدارة.';
    error?.(message);
    return res.json({ ok: false, error: message }, status);
  }
};
