import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Cloud Functions business logic (pure JS ESM)
import {
  BOOTSTRAPPED_OWNER_EMAIL,
  deterministicRowId,
  getSortedParticipants,
  handleEconomyAction,
  HttpError,
  WHEEL_REWARDS,
} from '../appwrite-functions/fadfada-economy/src/logic.js';
import {
  AdminHttpError,
  handleAdminAction,
} from '../appwrite-functions/fadfada-admin/src/logic.js';
import {
  cleanupAbandonedGuests,
  CleanupHttpError,
  deleteOldChatMessages,
  runScheduledMaintenance,
} from './cleanup-old-messages-logic.ts';
import type { UserProfile } from '../src/types/fadfada.js';
import {
  isExpiredOrOfflineGuest,
  isUserPresenceOnline,
} from '../src/services/presence.js';
import {
  countryCodeToFlag,
  detectUserCountry,
  resetGeolocationCacheForTests,
  resolveArabicCountryName,
} from '../src/services/geolocation.js';
import {
  getGenderStyle,
  normalizeGender,
  sortOnlineUsers,
} from '../src/utils/progression.js';
import { sanitizeHttpUrl } from '../src/utils/formatters.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TABLES = {
  users: 'users',
  userPrivate: 'user_private',
  conversations: 'conversations',
  messages: 'messages',
  rooms: 'rooms',
  roomMessages: 'room_messages',
  stories: 'stories',
  wallPosts: 'wall_posts',
  wallComments: 'wall_comments',
  creatorProposals: 'creator_proposals',
  proposalComments: 'proposal_comments',
  secrets: 'secrets',
  secretComments: 'secret_comments',
  storeItems: 'store_items',
  dailyTasks: 'daily_tasks',
  dailyClaims: 'daily_claims',
  coinTransactions: 'coin_transactions',
  shoutouts: 'shoutouts',
  relationships: 'relationships',
  marriages: 'marriages',
  profileVisits: 'profile_visits',
  notifications: 'notifications',
  topupRequests: 'topup_requests',
  reports: 'reports',
  appeals: 'appeals',
  supportTickets: 'support_tickets',
  siteSettings: 'site_settings',
  matchQueue: 'match_queue',
  matchSessions: 'match_sessions',
  matchMessages: 'match_messages',
  matchCandidates: 'match_candidates',
};

function createInMemoryEnv() {
  const db = new Map<string, Map<string, Record<string, unknown>>>();
  const authUsers = new Map<string, { $id: string; email: string; name: string; phone?: string; emailVerification: boolean; labels: string[] }>();
  const storageFiles = new Map<string, { $id: string; bucketId: string }>();
  let seq = 1;

  const ensureTable = (tableId: string) => {
    let map = db.get(tableId);
    if (!map) {
      map = new Map();
      db.set(tableId, map);
    }
    return map;
  };

  const tablesDB = {
    async getRow({ tableId, rowId }: { databaseId: string; tableId: string; rowId: string }) {
      const row = ensureTable(tableId).get(rowId);
      if (!row) {
        const err = new Error(`Row not found: ${tableId}/${rowId}`) as Error & { code: number };
        err.code = 404;
        throw err;
      }
      return structuredClone(row);
    },
    async listRows({
      tableId,
      queries = [],
    }: {
      databaseId: string;
      tableId: string;
      queries?: Array<{ type: string; field?: string; value?: unknown; limit?: number }>;
    }) {
      let rows = Array.from(ensureTable(tableId).values()).map((r) => structuredClone(r));
      let limit = 100;
      let cursorId: string | null = null;
      for (const q of queries) {
        if (q?.type === 'equal' && q.field) {
          rows = rows.filter((r) => r[q.field!] === q.value);
        } else if (q?.type === 'greaterThanEqual' && q.field) {
          rows = rows.filter((r) => String(r[q.field!] ?? '') >= String(q.value ?? ''));
        } else if (q?.type === 'lessThan' && q.field) {
          rows = rows.filter((r) => {
            const val = String(r[q.field!] ?? '');
            return Boolean(val) && val < String(q.value ?? '');
          });
        } else if (q?.type === 'contains' && q.field) {
          rows = rows.filter((r) => {
            const val = r[q.field!];
            if (Array.isArray(val)) return val.includes(q.value);
            return String(val ?? '').includes(String(q.value ?? ''));
          });
        } else if (q?.type === 'orderDesc' && q.field) {
          rows.sort((a, b) => String(b[q.field!] ?? '').localeCompare(String(a[q.field!] ?? '')));
        } else if (q?.type === 'cursorAfter' && typeof q.value === 'string') {
          cursorId = q.value;
        } else if (q?.type === 'limit' && typeof q.limit === 'number') {
          limit = q.limit;
        }
      }
      if (cursorId) {
        const idx = rows.findIndex((r) => r.$id === cursorId);
        rows = idx >= 0 ? rows.slice(idx + 1) : [];
      }
      rows = rows.slice(0, limit);
      return { total: rows.length, rows };
    },
    async createRow({ tableId, rowId, data, permissions }: { databaseId: string; tableId: string; rowId: string; data: Record<string, unknown>; permissions?: string[] }) {
      const map = ensureTable(tableId);
      const id = rowId === 'unique()' ? `row_${seq++}` : rowId;
      if (map.has(id)) {
        const err = new Error(`Conflict: ${tableId}/${id}`) as Error & { code: number };
        err.code = 409;
        throw err;
      }
      const now = new Date().toISOString();
      const row = { $id: id, $createdAt: now, $updatedAt: now, $permissions: permissions ?? [], ...structuredClone(data) };
      map.set(id, row);
      return structuredClone(row);
    },
    async updateRow({ tableId, rowId, data }: { databaseId: string; tableId: string; rowId: string; data: Record<string, unknown> }) {
      const map = ensureTable(tableId);
      const existing = map.get(rowId);
      if (!existing) {
        const err = new Error(`Not found: ${tableId}/${rowId}`) as Error & { code: number };
        err.code = 404;
        throw err;
      }
      const updated = { ...existing, ...structuredClone(data), $updatedAt: new Date().toISOString() };
      map.set(rowId, updated);
      return structuredClone(updated);
    },
    async upsertRow({ tableId, rowId, data, permissions }: { databaseId: string; tableId: string; rowId: string; data: Record<string, unknown>; permissions?: string[] }) {
      const map = ensureTable(tableId);
      const existing = map.get(rowId);
      if (existing) {
        const updated = {
          ...existing,
          ...structuredClone(data),
          ...(permissions ? { $permissions: permissions } : {}),
          $updatedAt: new Date().toISOString(),
        };
        map.set(rowId, updated);
        return structuredClone(updated);
      }
      return await tablesDB.createRow({ databaseId: 'fadfada_db', tableId, rowId, data, permissions });
    },
    async deleteRow({ tableId, rowId }: { databaseId: string; tableId: string; rowId: string }) {
      ensureTable(tableId).delete(rowId);
    },
  };

  const usersApi = {
    async get({ userId }: { userId: string }) {
      const u = authUsers.get(userId);
      if (!u) {
        const err = new Error(`User not found: ${userId}`) as Error & { code: number };
        err.code = 404;
        throw err;
      }
      return structuredClone(u);
    },
    async updateLabels({ userId, labels }: { userId: string; labels: string[] }) {
      const u = authUsers.get(userId);
      if (u) u.labels = [...labels];
      return u;
    },
    async delete({ userId }: { userId: string }) {
      if (!authUsers.has(userId)) {
        const err = new Error(`User not found: ${userId}`) as Error & { code: number };
        err.code = 404;
        throw err;
      }
      authUsers.delete(userId);
    },
  };

  const storageApi = {
    async deleteFile({ fileId }: { bucketId: string; fileId: string }) {
      if (!storageFiles.has(fileId)) {
        const err = new Error(`File not found: ${fileId}`) as Error & { code: number };
        err.code = 404;
        throw err;
      }
      storageFiles.delete(fileId);
    },
  };

  const Permission = {
    read: (role: string) => `read("${role}")`,
    update: (role: string) => `update("${role}")`,
    delete: (role: string) => `delete("${role}")`,
  };
  const Role = {
    any: () => 'any',
    users: () => 'users',
    user: (id: string) => `user:${id}`,
    label: (lbl: string) => `label:${lbl}`,
  };
  const ID = {
    unique: () => 'unique()',
  };
  const Query = {
    equal: (field: string, value: unknown) => ({ type: 'equal', field, value }),
    greaterThanEqual: (field: string, value: unknown) => ({ type: 'greaterThanEqual', field, value }),
    lessThan: (field: string, value: unknown) => ({ type: 'lessThan', field, value }),
    contains: (field: string, value: unknown) => ({ type: 'contains', field, value }),
    orderDesc: (field: string) => ({ type: 'orderDesc', field }),
    cursorAfter: (value: string) => ({ type: 'cursorAfter', value }),
    limit: (limit: number) => ({ type: 'limit', limit }),
  };

  return {
    db,
    authUsers,
    storageFiles,
    tablesDB,
    usersApi,
    storageApi,
    Query,
    economyCtx: (callerUid: string, action: string, payload: Record<string, unknown> = {}) => ({
      callerUid,
      action,
      payload,
      tablesDB,
      usersApi,
      databaseId: 'fadfada_db',
      tables: TABLES,
      Permission,
      Role,
      ID,
      Query,
    }),
    adminCtx: (callerUid: string, action: string, payload: Record<string, unknown> = {}) => ({
      callerUid,
      action,
      payload,
      tablesDB,
      usersApi,
      storageApi,
      databaseId: 'fadfada_db',
      bucketId: 'fadfada_media',
      tables: TABLES,
      Permission,
      Role,
      ID,
      Query,
    }),
    cleanupCtx: (payload: Record<string, unknown> = {}, opts: { callerUid?: string; isScheduledTrigger?: boolean; nowMs?: number } = {}) => ({
      callerUid: opts.callerUid ?? '',
      isScheduledTrigger: opts.isScheduledTrigger ?? true,
      payload,
      tablesDB,
      usersApi,
      storageApi,
      databaseId: 'fadfada_db',
      bucketId: 'fadfada_media',
      tables: TABLES,
      Query,
      nowMs: opts.nowMs ?? Date.now(),
    }),
  };
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (/\.(ts|tsx|js|jsx|json|html)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test('Static migration audit: zero Firebase, Supabase, Vercel, or forbidden browser popups', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const depName of Object.keys(allDeps)) {
    assert.ok(!depName.includes('firebase'), `Unexpected Firebase package: ${depName}`);
    assert.ok(!depName.includes('supabase'), `Unexpected Supabase package: ${depName}`);
    assert.ok(!depName.includes('vercel'), `Unexpected Vercel package: ${depName}`);
  }
  assert.ok(allDeps.appwrite, 'appwrite client SDK must be installed');
  assert.ok(allDeps['node-appwrite'], 'node-appwrite SDK must be installed');

  const srcFiles = walkFiles(path.join(ROOT_DIR, 'src'));
  const forbiddenPatterns = [
    /firebase/i,
    /firestore/i,
    /supabase/i,
    /vercel/i,
    /\.toMillis\(/,
    /isMediaUploadAvailable/,
    /getMediaUnavailableReason/,
    /UnavailableMediaProvider/,
    /\bwindow\.(alert|confirm|open)\b/,
    /owner@fadfada\.app/i,
    /hegazymr6@gmail\.com/i,
  ];

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.ok(
        !pattern.test(content),
        `Forbidden pattern ${pattern} found in ${path.relative(ROOT_DIR, file)}`
      );
    }
  }

  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'appwrite.json')), 'appwrite.json must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'setup-appwrite.ts')), 'scripts/setup-appwrite.ts must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'cleanup-old-messages.ts')), 'scripts/cleanup-old-messages.ts must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'cleanup-old-messages-logic.ts')), 'scripts/cleanup-old-messages-logic.ts must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'appwrite-functions', 'fadfada-economy', 'src', 'main.js')));
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'appwrite-functions', 'fadfada-admin', 'src', 'main.js')));
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, 'appwrite-functions', 'cleanup-old-messages')),
    false,
    'Third Appwrite function directory must not exist on free-plan 2-function limit'
  );
  const appwriteCfg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'appwrite.json'), 'utf8')) as {
    functions: Array<{ $id: string; schedule?: string }>;
  };
  assert.equal(appwriteCfg.functions.length, 2, 'appwrite.json must contain only the 2 free-plan functions');
  assert.ok(appwriteCfg.functions.some((f) => f.$id === 'fadfada-economy'));
  assert.ok(appwriteCfg.functions.some((f) => f.$id === 'fadfada-admin'));
  assert.equal(
    appwriteCfg.functions.some((f) => f.$id === 'cleanup-old-messages'),
    false,
    'cleanup-old-messages must not be registered as a 3rd Appwrite Function'
  );

  const cleanupWorkflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'cleanup-messages.yml');
  assert.ok(fs.existsSync(cleanupWorkflowPath), '.github/workflows/cleanup-messages.yml must exist');
  const cleanupWorkflow = fs.readFileSync(cleanupWorkflowPath, 'utf8');
  assert.ok(cleanupWorkflow.includes("cron: '*/15 * * * *'"));
  assert.ok(cleanupWorkflow.includes('secrets.APPWRITE_API_KEY'));
  assert.ok(cleanupWorkflow.includes('scripts/cleanup-old-messages.ts'));

  // Ensure owner password is never hardcoded in source files or scripts
  const forbiddenSecret = ['Fadfada', '@2026!', 'Owner'].join('');
  const allAuditFiles = [
    ...srcFiles,
    ...walkFiles(path.join(ROOT_DIR, 'appwrite-functions')),
    ...walkFiles(path.join(ROOT_DIR, 'scripts')),
  ];
  for (const file of allAuditFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      !content.includes(forbiddenSecret),
      `Hardcoded owner password found in ${path.relative(ROOT_DIR, file)}`
    );
  }

  const authScreenCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'AuthScreen.tsx'), 'utf8');
  assert.ok(authScreenCode.includes('الدخول بحساب المالك'), 'AuthScreen must include owner login option');
  assert.equal(BOOTSTRAPPED_OWNER_EMAIL, 'owner@fadfada.app');
});

test('deterministicRowId produces <=32 char valid Appwrite IDs and preserves pair symmetry', () => {
  const longUidA = '67a9f2d8c4b1e0098123456789abcdef';
  const longUidB = '67a9f2d8c4b1e0098fedcba987654321';
  const [p1, p2] = getSortedParticipants(longUidB, longUidA);
  const id1 = deterministicRowId('c', `${p1}_${p2}`);
  const id2 = deterministicRowId('c', `${longUidA}_${longUidB}`);
  assert.equal(id1, id2);
  assert.ok(id1.length <= 32, `ID too long: ${id1.length}`);
  assert.match(id1, /^[a-zA-Z0-9_]+$/);
});

test('Owner bootstrap requires verified owner email and isolates PII in user_private', async () => {
  const env = createInMemoryEnv();

  // Unverified spoof attempt must NOT become owner
  env.authUsers.set('spoof_uid', {
    $id: 'spoof_uid',
    email: BOOTSTRAPPED_OWNER_EMAIL,
    name: 'Spoof',
    emailVerification: false,
    labels: [],
  });
  const spoofProfile = await handleEconomyAction(env.economyCtx('spoof_uid', 'ensureProfile'));
  assert.equal(spoofProfile.role, 'member');
  assert.equal(spoofProfile.coins, 50);
  assert.equal(env.authUsers.get('spoof_uid')?.labels.includes('staff'), false);

  // Regular member profile must NOT receive owner role or permissions
  env.authUsers.set('regular_member', {
    $id: 'regular_member',
    email: 'member@example.com',
    name: 'Regular Member',
    emailVerification: true,
    labels: [],
  });
  const memberProfile = await handleEconomyAction(env.economyCtx('regular_member', 'ensureProfile'));
  assert.equal(memberProfile.role, 'member');
  assert.deepEqual(memberProfile.permissions, []);
  assert.equal(env.authUsers.get('regular_member')?.labels.includes('staff'), false);

  // Verified owner bootstrap succeeds for owner@fadfada.app
  env.authUsers.set('owner_uid', {
    $id: 'owner_uid',
    email: BOOTSTRAPPED_OWNER_EMAIL,
    name: 'Mina Owner',
    emailVerification: true,
    labels: [],
  });
  const ownerProfile = await handleEconomyAction(env.economyCtx('owner_uid', 'ensureProfile'));
  assert.equal(ownerProfile.role, 'owner');
  assert.equal(ownerProfile.coins, 5000);
  assert.ok(Array.isArray(ownerProfile.permissions) && ownerProfile.permissions.includes('*'));
  assert.equal(env.authUsers.get('owner_uid')?.labels.includes('staff'), true);

  // Public users row does NOT contain email; user_private does with owner-only read permission
  assert.equal('email' in ownerProfile, false);
  const privateRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'user_private', rowId: 'owner_uid' });
  assert.equal(privateRow.email, BOOTSTRAPPED_OWNER_EMAIL);
  assert.deepEqual(privateRow.$permissions, ['read("user:owner_uid")']);
});

test('Guest validation (18+/Terms), economy feature locks (403), and Member upgrade', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('guest_underage', {
    $id: 'guest_underage',
    email: '',
    name: '',
    emailVerification: false,
    labels: [],
  });
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('guest_underage', 'ensureProfile', {
          guestProfile: { displayName: 'قاصر', age: 16, gender: 'male', acceptedTerms: true },
        })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );

  env.authUsers.set('guest_1', {
    $id: 'guest_1',
    email: '',
    name: '',
    emailVerification: false,
    labels: [],
  });
  const initial = await handleEconomyAction(
    env.economyCtx('guest_1', 'ensureProfile', {
      guestProfile: { displayName: 'زائر كريم', age: 23, gender: 'female', acceptedTerms: true },
    })
  );
  assert.equal(initial.role, 'guest');
  assert.equal(initial.isAnonymous, true);
  assert.equal(initial.age, 23);
  assert.equal(initial.gender, 'female');
  assert.equal(initial.acceptedTerms, true);
  assert.equal(initial.country, '');

  // Guest blocked from store, gifts, transfer, daily rewards, shoutout, createMemberRoom
  for (const [act, payload] of [
    ['purchaseStoreItem', { itemId: 'vip_silver' }],
    ['claimDailyReward', { taskKey: 'checkin' }],
    ['postShoutout', { text: 'تجربة ضيف' }],
    ['createMemberRoom', { name: 'غرفة ضيف' }],
    ['transferCoins', { recipientId: 'guest_underage', amount: 10 }],
  ] as const) {
    await assert.rejects(
      () => handleEconomyAction(env.economyCtx('guest_1', act, payload as Record<string, unknown>)),
      (err: unknown) => err instanceof HttpError && err.status === 403
    );
  }

  // Simulate linking email
  env.authUsers.get('guest_1')!.email = 'upgraded@example.com';
  const upgraded = await handleEconomyAction(env.economyCtx('guest_1', 'ensureProfile'));
  assert.equal(upgraded.role, 'member');
  assert.equal(upgraded.isAnonymous, false);
});

test('Server-authoritative store purchase ignores client price spoofing and blocks insufficient coins', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('u1', {
    $id: 'u1',
    email: 'u1@example.com',
    name: 'Ahmed',
    emailVerification: true,
    labels: [],
  });
  await handleEconomyAction(env.economyCtx('u1', 'ensureProfile'));

  // u1 only has 50 coins; even if payload claims priceCoins=1, vip_silver costs 300
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('u1', 'purchaseStoreItem', { itemId: 'vip_silver', priceCoins: 1 })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );

  // Grant 400 coins via owner topup approval and verify server deducts 300 -> 150
  env.authUsers.set('owner_1', {
    $id: 'owner_1',
    email: BOOTSTRAPPED_OWNER_EMAIL,
    name: 'Owner',
    emailVerification: true,
    labels: ['staff'],
  });
  await handleEconomyAction(env.economyCtx('owner_1', 'ensureProfile'));
  const reqRow = await handleEconomyAction(
    env.economyCtx('u1', 'submitTopupRequest', {
      method: 'InstaPay',
      amount: 40,
      coinsRequested: 400,
      reference: 'TX-99',
    })
  );
  await handleAdminAction(
    env.adminCtx('owner_1', 'reviewTopupRequest', {
      requestId: reqRow.$id,
      approve: true,
      adminNote: 'OK',
    })
  );

  const afterPurchase = await handleEconomyAction(
    env.economyCtx('u1', 'purchaseStoreItem', { itemId: 'vip_silver', priceCoins: 1 })
  );
  assert.equal(afterPurchase.coins, 150);
  assert.equal(afterPurchase.vipTier, 'silver');
});

test('Coin transfers, duplicate daily rewards, gifts, and marriage dowry fee enforcement', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('alice', { $id: 'alice', email: 'alice@example.com', name: 'Alice', emailVerification: true, labels: [] });
  env.authUsers.set('bob', { $id: 'bob', email: 'bob@example.com', name: 'Bob', emailVerification: true, labels: [] });
  await handleEconomyAction(env.economyCtx('alice', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('bob', 'ensureProfile'));

  // Reject self transfer & negative transfer
  await assert.rejects(() =>
    handleEconomyAction(env.economyCtx('alice', 'transferCoins', { recipientId: 'alice', amount: 10 }))
  );
  await assert.rejects(() =>
    handleEconomyAction(env.economyCtx('alice', 'transferCoins', { recipientId: 'bob', amount: -20 }))
  );

  // Incomplete daily task cannot be claimed before action
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'engage' })),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'share' })),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );

  // Daily checkin claims once per day (+35 => 85 coins)
  const claim1 = await handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'checkin' }));
  assert.equal(claim1.rewardCoins, 35);
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'checkin' })),
    (err: unknown) => err instanceof HttpError && err.status === 409
  );

  // Perform real engage + share actions then claim
  await handleEconomyAction(env.economyCtx('alice', 'sendPrivateMessage', { recipientId: 'bob', text: 'مرحبًا بوب' }));
  await handleEconomyAction(env.economyCtx('alice', 'recordDailyTaskActivity', { kind: 'share' }));
  const claimEngage = await handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'engage' }));
  const claimShare = await handleEconomyAction(env.economyCtx('alice', 'claimDailyReward', { taskKey: 'share' }));
  assert.equal(claimEngage.rewardCoins, 45);
  assert.equal(claimShare.rewardCoins, 40);

  const progress = await handleEconomyAction(env.economyCtx('alice', 'getDailyTaskProgress'));
  assert.equal((progress.claimedByKey as Record<string, boolean>).checkin, true);
  assert.equal((progress.claimedByKey as Record<string, boolean>).engage, true);
  assert.equal((progress.claimedByKey as Record<string, boolean>).share, true);

  // Alice now has 170 coins (50 + 35 + 45 + 40); propose marriage to Bob with 60 dowry (20% site fee -> wifeShare=48)
  await handleEconomyAction(
    env.economyCtx('alice', 'proposeMarriage', { partnerId: 'bob', dowry: 60, message: 'Hello' })
  );
  const marriageId = deterministicRowId('m', `${getSortedParticipants('alice', 'bob').join('_')}`);
  const acceptRes = await handleEconomyAction(
    env.economyCtx('bob', 'respondMarriage', { marriageId, accept: true })
  );
  assert.equal(acceptRes.accepted, true);

  const aliceRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'alice' });
  const bobRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'bob' });
  assert.equal(aliceRow.coins, 110); // 170 - 60
  assert.equal(bobRow.coins, 98); // 50 + 48
  assert.equal(aliceRow.maritalStatus, 'married');
  assert.equal(bobRow.maritalStatus, 'married');
});

test('RBAC: moderator restrictions, owner-only controls, and banned user appeals', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('owner', { $id: 'owner', email: BOOTSTRAPPED_OWNER_EMAIL, name: 'Owner', emailVerification: true, labels: [] });
  env.authUsers.set('mod', { $id: 'mod', email: 'mod@example.com', name: 'Mod', emailVerification: true, labels: [] });
  env.authUsers.set('user', { $id: 'user', email: 'user@example.com', name: 'Member', emailVerification: true, labels: [] });

  await handleEconomyAction(env.economyCtx('owner', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('mod', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('user', 'ensureProfile'));

  // Promote mod via owner
  await handleAdminAction(env.adminCtx('owner', 'adminUpdateUser', { targetUid: 'mod', updates: { role: 'moderator' } }));
  assert.equal(env.authUsers.get('mod')?.labels.includes('staff'), true);

  // Regular user cannot call admin actions
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('user', 'adminUpdateUser', { targetUid: 'user', updates: { coins: 99999 } })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );

  // Moderator cannot change role/coins/vip/settings or edit owner
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mod', 'adminUpdateUser', { targetUid: 'user', updates: { coins: 5000 } })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mod', 'adminUpdateUser', { targetUid: 'owner', updates: { isBanned: true } })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mod', 'updateSiteSettings', { settings: { shoutoutCost: 1 } })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );

  // Moderator CAN ban a regular member; banned user is blocked from economy/match but CAN submit an appeal
  await handleAdminAction(
    env.adminCtx('mod', 'adminUpdateUser', { targetUid: 'user', updates: { isBanned: true, banReason: 'Spam' } })
  );
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('user', 'transferCoins', { recipientId: 'mod', amount: 10 })),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );
  const appeal = await handleEconomyAction(
    env.economyCtx('user', 'submitAppeal', { reason: 'أرجو مراجعة قرار الحظر' })
  );
  assert.equal(appeal.status, 'pending');

  // Review appeal -> unbans user
  await handleAdminAction(
    env.adminCtx('mod', 'reviewAppeal', { appealId: appeal.$id, accept: true, adminNote: 'تم القبول' })
  );
  const unbannedUser = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'user' });
  assert.equal(unbannedUser.isBanned, false);
});

test('Random matchmaking skips stale queue entries (>5 min) and pairs compatible active users', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('u1', { $id: 'u1', email: 'u1@example.com', name: 'U1', emailVerification: true, labels: [] });
  env.authUsers.set('u2', { $id: 'u2', email: 'u2@example.com', name: 'U2', emailVerification: true, labels: [] });
  await handleEconomyAction(env.economyCtx('u1', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('u2', 'ensureProfile'));

  // Insert stale queue entry
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'match_queue',
    rowId: 'stale_uid',
    data: {
      uid: 'stale_uid',
      displayName: 'Stale',
      gender: 'unspecified',
      country: 'مصر',
      mode: 'text',
      preferredGender: 'all',
      preferredCountry: '',
      status: 'waiting',
      sessionId: '',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  });

  // u1 joins -> skips stale entry, enters queue waiting
  const res1 = await handleEconomyAction(
    env.economyCtx('u1', 'joinRandomMatch', { mode: 'text', preferredGender: 'all' })
  );
  assert.equal(res1.matchedSessionId, null);

  // u2 joins -> immediately matches u1
  const res2 = await handleEconomyAction(
    env.economyCtx('u2', 'joinRandomMatch', { mode: 'text', preferredGender: 'all' })
  );
  assert.ok(res2.matchedSessionId, 'u2 should match with waiting u1');

  const session = await env.tablesDB.getRow({
    databaseId: 'fadfada_db',
    tableId: 'match_sessions',
    rowId: String(res2.matchedSessionId),
  });
  assert.equal(session.status, 'active');
  assert.deepEqual(session.participantIds, getSortedParticipants('u1', 'u2'));

  // Session participants can send match messages; third parties cannot
  await handleEconomyAction(
    env.economyCtx('u1', 'sendMatchMessage', { sessionId: session.$id, text: 'أهلًا في المطابقة' })
  );
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('u1', 'sendPrivateMessage', { recipientId: 'u1', text: 'bad' })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );
});

test('Server-authoritative sendPrivateMessage sets strict 2-party row permissions and enforces privacy', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('sender_1', { $id: 'sender_1', email: 's@example.com', name: 'Sender', emailVerification: true, labels: [] });
  env.authUsers.set('recv_1', { $id: 'recv_1', email: 'r@example.com', name: 'Receiver', emailVerification: true, labels: [] });
  await handleEconomyAction(env.economyCtx('sender_1', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('recv_1', 'ensureProfile'));

  const dmRes = await handleEconomyAction(
    env.economyCtx('sender_1', 'sendPrivateMessage', { recipientId: 'recv_1', text: 'مرحبًا بك' })
  );
  assert.ok(dmRes.messageId);
  assert.ok(dmRes.conversationId);

  const msgRow = await env.tablesDB.getRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: String(dmRes.messageId),
  });
  assert.deepEqual(msgRow.$permissions, [
    'read("user:recv_1")',
    'read("user:sender_1")',
    'update("user:recv_1")',
    'update("user:sender_1")',
  ]);

  // Privacy = nobody blocks non-staff sender
  await env.tablesDB.updateRow({
    databaseId: 'fadfada_db',
    tableId: 'users',
    rowId: 'recv_1',
    data: { privacyJson: JSON.stringify({ messagePermission: 'nobody' }) },
  });
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('sender_1', 'sendPrivateMessage', { recipientId: 'recv_1', text: 'blocked' })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );

  // Privacy = friends blocks non-friends, then allows once accepted via deterministic 'r' row ID
  await env.tablesDB.updateRow({
    databaseId: 'fadfada_db',
    tableId: 'users',
    rowId: 'recv_1',
    data: { privacyJson: JSON.stringify({ messagePermission: 'friends' }) },
  });
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('sender_1', 'sendPrivateMessage', { recipientId: 'recv_1', text: 'not friends yet' })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );

  await handleEconomyAction(env.economyCtx('sender_1', 'sendFriendRequest', { targetUid: 'recv_1' }));
  const [f1, f2] = getSortedParticipants('sender_1', 'recv_1');
  const relId = deterministicRowId('r', `${f1}_${f2}`);
  await handleEconomyAction(env.economyCtx('recv_1', 'respondFriendRequest', { relationshipId: relId, accept: true }));

  const contactDm = await handleEconomyAction(
    env.economyCtx('sender_1', 'sendPrivateMessage', {
      recipientId: 'recv_1',
      text: 'بطاقة تواصل',
      type: 'contact',
    })
  );
  const contactRow = await env.tablesDB.getRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: String(contactDm.messageId),
  });
  assert.equal(contactRow.type, 'contact');

  const alertDm = await handleEconomyAction(
    env.economyCtx('sender_1', 'sendPrivateMessage', {
      recipientId: 'recv_1',
      text: 'تنبيه لقطة شاشة',
      type: 'screenshot_alert',
    })
  );
  const alertRow = await env.tablesDB.getRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: String(alertDm.messageId),
  });
  assert.equal(alertRow.type, 'screenshot_alert');

  // Edit, View-Once & Delete Private Messages
  const edited = await handleEconomyAction(
    env.economyCtx('sender_1', 'editPrivateMessage', { messageId: String(dmRes.messageId), text: 'نص معدّل' })
  );
  assert.equal(edited.text, 'نص معدّل');
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('recv_1', 'editPrivateMessage', { messageId: String(dmRes.messageId), text: 'اختراق' })),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );

  const viewOnceDm = await handleEconomyAction(
    env.economyCtx('sender_1', 'sendPrivateMessage', {
      recipientId: 'recv_1',
      text: 'فيديو مرة واحدة',
      type: 'video',
      mediaUrl: 'https://example.com/clip.mp4',
      isViewOnce: true,
    })
  );
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('sender_1', 'consumeViewOnceMessage', { messageId: String(viewOnceDm.messageId) })),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );
  const openedOnce = await handleEconomyAction(
    env.economyCtx('recv_1', 'consumeViewOnceMessage', { messageId: String(viewOnceDm.messageId) })
  );
  assert.equal(openedOnce.mediaUrl, 'https://example.com/clip.mp4');
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('recv_1', 'consumeViewOnceMessage', { messageId: String(viewOnceDm.messageId) })),
    (err: unknown) => err instanceof HttpError && err.status === 410
  );

  const deletedDm = await handleEconomyAction(
    env.economyCtx('sender_1', 'deletePrivateMessage', { messageId: String(dmRes.messageId) })
  );
  assert.equal(deletedDm.isDeleted, true);
});

test('Daily wheel claim, verified daily tasks, rich room messages & leaveRoom membership lock', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('owner_r', { $id: 'owner_r', email: 'or@example.com', name: 'OwnerR', emailVerification: true, labels: [] });
  env.authUsers.set('guest_r', { $id: 'guest_r', email: 'gr@example.com', name: 'GuestR', emailVerification: true, labels: [] });
  await handleEconomyAction(env.economyCtx('owner_r', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('guest_r', 'ensureProfile'));

  // Wheel spin matches WHEEL_REWARDS[wheelIndex]
  const wheelRes = await handleEconomyAction(env.economyCtx('owner_r', 'claimDailyReward', { taskKey: 'daily_wheel' }));
  assert.equal(typeof wheelRes.wheelIndex, 'number');
  const expectedSeg = WHEEL_REWARDS[Number(wheelRes.wheelIndex)];
  assert.ok(expectedSeg, 'wheelIndex must map to WHEEL_REWARDS');
  assert.equal(wheelRes.rewardCoins, expectedSeg.coins);
  assert.equal(wheelRes.rewardXp, expectedSeg.xp);

  // Complete real actions to earn >= 150 coins before creating a room
  await handleEconomyAction(env.economyCtx('owner_r', 'sendPrivateMessage', { recipientId: 'guest_r', text: 'مرحبًا' }));
  await handleEconomyAction(env.economyCtx('owner_r', 'recordDailyTaskActivity', { kind: 'share' }));
  await handleEconomyAction(env.economyCtx('owner_r', 'recordDailyTaskActivity', { kind: 'ad_watch' }));
  for (const key of ['checkin', 'engage', 'share', 'ad_watch']) {
    await handleEconomyAction(env.economyCtx('owner_r', 'claimDailyReward', { taskKey: key }));
  }
  const { roomId } = await handleEconomyAction(
    env.economyCtx('owner_r', 'createMemberRoom', {
      name: 'غرفة الأصدقاء',
      description: 'وصف الغرفة',
      category: 'عام',
      theme: 'emerald',
    })
  );

  // guest_r joins and sends rich room message + view-once + reactions
  const joinRes = await handleEconomyAction(env.economyCtx('guest_r', 'joinRoom', { roomId }));
  assert.equal(joinRes.activeCount, 2);

  const rMsg = await handleEconomyAction(
    env.economyCtx('owner_r', 'sendRoomMessage', {
      roomId,
      text: 'صورة للمشاهدة مرة واحدة',
      type: 'image',
      mediaUrl: 'https://example.com/pic.png',
      isViewOnce: true,
    })
  );
  const reacted = await handleEconomyAction(
    env.economyCtx('guest_r', 'toggleRoomMessageReaction', { messageId: String(rMsg.$id), emoji: '❤️' })
  );
  assert.ok(String(reacted.reactionsJson).includes('guest_r'));

  const roomOpened = await handleEconomyAction(
    env.economyCtx('guest_r', 'consumeRoomViewOnce', { messageId: String(rMsg.$id) })
  );
  assert.equal(roomOpened.mediaUrl, 'https://example.com/pic.png');
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('guest_r', 'consumeRoomViewOnce', { messageId: String(rMsg.$id) })),
    (err: unknown) => err instanceof HttpError && err.status === 410
  );

  const editedRoomMsg = await handleEconomyAction(
    env.economyCtx('owner_r', 'editRoomMessage', { messageId: String(rMsg.$id), text: 'تم تحديث التسمية' })
  );
  assert.equal(editedRoomMsg.text, 'تم تحديث التسمية');

  // Non-owner cannot update room metadata
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('guest_r', 'updateRoomMeta', { roomId, pinnedMessage: 'اختراق' })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );

  // Owner updates room metadata
  const updateRes = await handleEconomyAction(
    env.economyCtx('owner_r', 'updateRoomMeta', { roomId, pinnedMessage: 'رسالة مثبتة جديدة', theme: 'amber' })
  );
  assert.equal(updateRes.ok, true);
  const roomRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'rooms', rowId: String(roomId) });
  assert.equal(roomRow.pinnedMessage, 'رسالة مثبتة جديدة');
  assert.equal(roomRow.theme, 'amber');

  // Leave room -> member removed without deleting room, and sending while not a member is blocked (403)
  const leaveRes = await handleEconomyAction(env.economyCtx('guest_r', 'leaveRoom', { roomId }));
  assert.equal(leaveRes.activeCount, 1);
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('guest_r', 'sendRoomMessage', { roomId, text: 'بعد المغادرة' })),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );
});

test('sortOnlineUsers prioritizes self country (female->male), then other countries (female->male), missing country last', () => {
  const sample = [
    { uid: 'no_country_m', displayName: 'A', country: '', gender: 'male' as const, isOnline: true },
    { uid: 'other_m', displayName: 'B', country: 'السعودية', gender: 'male' as const, isOnline: true },
    { uid: 'other_f', displayName: 'C', country: 'السعودية', gender: 'female' as const, isOnline: true },
    { uid: 'same_m', displayName: 'D', country: 'مصر', gender: 'male' as const, isOnline: true },
    { uid: 'same_f', displayName: 'E', country: 'مصر', gender: 'female' as const, isOnline: true },
    { uid: 'no_country_f', displayName: 'F', country: 'دولة غير محددة', gender: 'female' as const, isOnline: true },
  ] as unknown as UserProfile[];
  const sorted = sortOnlineUsers(
    sample,
    { country: 'مصر' } as UserProfile,
    (u) => Boolean(u.isOnline),
    () => 0
  ).map((u) => u.uid);
  assert.deepEqual(sorted, ['same_f', 'same_m', 'other_f', 'other_m', 'no_country_f', 'no_country_m']);
});

test('getGenderStyle maps female/male/unspecified consistently to Rose, Blue, and Neutral styles', () => {
  const female = getGenderStyle('female');
  assert.equal(female.gender, 'female');
  assert.equal(female.label, 'أنثى');
  assert.match(female.cardClass, /rose-/);
  assert.match(female.avatarRingClass, /rose-/);
  assert.match(female.badgeClass, /rose-/);
  assert.equal(getGenderStyle('أنثى').gender, 'female');

  const male = getGenderStyle('male');
  assert.equal(male.gender, 'male');
  assert.equal(male.label, 'ذكر');
  assert.match(male.cardClass, /sky-/);
  assert.match(male.avatarRingClass, /sky-/);
  assert.match(male.badgeClass, /sky-/);
  assert.equal(getGenderStyle('ذكر').gender, 'male');

  for (const raw of ['', undefined, 'unspecified', 'other']) {
    const neutral = getGenderStyle(raw);
    assert.equal(normalizeGender(raw), 'unspecified');
    assert.equal(neutral.gender, 'unspecified');
    assert.equal(neutral.label, 'غير محدد');
    assert.ok(!/rose-|sky-/.test(neutral.cardClass));
    assert.ok(!/rose-|sky-/.test(neutral.badgeClass));
  }
});

test('sanitizeHttpUrl blocks unsafe schemes and production hosting assets exist', () => {
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeHttpUrl('vbscript:msgbox(1)'), '');
  assert.equal(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeHttpUrl('//evil.example/path'), '');
  assert.equal(sanitizeHttpUrl('https://fadfada.app/promo?ref=1'), 'https://fadfada.app/promo?ref=1');
  assert.equal(sanitizeHttpUrl('http://example.com'), 'http://example.com/');
  assert.equal(sanitizeHttpUrl('/assets/pic.webp', { allowRelative: true }), '/assets/pic.webp');
  assert.equal(sanitizeHttpUrl('//evil.example', { allowRelative: true }), '');
  assert.equal(sanitizeHttpUrl('blob:https://fadfada.app/123', { allowBlob: true }), 'blob:https://fadfada.app/123');

  const adSlotCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'AdSlot.tsx'), 'utf8');
  const viewerCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'MediaViewerModal.tsx'), 'utf8');
  assert.ok(adSlotCode.includes('sanitizeHttpUrl'), 'AdSlot must sanitize targetUrl');
  assert.ok(viewerCode.includes('sanitizeHttpUrl'), 'MediaViewerModal must sanitize media url');

  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'public', '_redirects')), 'public/_redirects must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'public', '_headers')), 'public/_headers must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'public', 'favicon.svg')), 'public/favicon.svg must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'public', '404.html')), 'public/404.html must exist');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'vercel.json')), 'vercel.json must exist');

  const ghWorkflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'deploy.yml');
  assert.ok(fs.existsSync(ghWorkflowPath), '.github/workflows/deploy.yml must exist');
  const ghWorkflow = fs.readFileSync(ghWorkflowPath, 'utf8');
  assert.ok(ghWorkflow.includes('https://fra.cloud.appwrite.io/v1'));
  assert.ok(ghWorkflow.includes('6b022cc5002da26b7487'));
  assert.ok(!ghWorkflow.includes('APPWRITE_API_KEY'), 'Workflow must never expose APPWRITE_API_KEY');
});

test('Guest logout deletes temporary DB records and Appwrite Auth user while blocking member self-purge', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('owner_g', { $id: 'owner_g', email: BOOTSTRAPPED_OWNER_EMAIL, name: 'Owner', emailVerification: true, labels: [] });
  env.authUsers.set('member_g', { $id: 'member_g', email: 'm@example.com', name: 'Member', emailVerification: true, labels: [] });
  env.authUsers.set('guest_temp', { $id: 'guest_temp', email: '', name: '', emailVerification: false, labels: [] });

  await handleEconomyAction(env.economyCtx('owner_g', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('member_g', 'ensureProfile'));
  await handleEconomyAction(
    env.economyCtx('guest_temp', 'ensureProfile', {
      guestProfile: { displayName: 'ضيف مؤقت', age: 24, gender: 'male', acceptedTerms: true },
    })
  );

  // Guest joins a room and has match queue / notification / visit rows
  await handleAdminAction(env.adminCtx('owner_g', 'ensureOfficialRooms'));
  await handleEconomyAction(env.economyCtx('guest_temp', 'joinRoom', { roomId: 'official_cafe' }));
  await handleEconomyAction(env.economyCtx('guest_temp', 'recordProfileVisit', { profileUid: 'member_g' }));
  await handleEconomyAction(env.economyCtx('guest_temp', 'joinRandomMatch', { mode: 'text', preferredGender: 'all' }));

  // Permanent member cannot call deleteGuestAccount (403)
  await assert.rejects(
    () => handleEconomyAction(env.economyCtx('member_g', 'deleteGuestAccount')),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );

  // Guest logout purges everything cleanly
  const delRes = await handleEconomyAction(env.economyCtx('guest_temp', 'deleteGuestAccount'));
  assert.equal(delRes.deleted, true);
  assert.equal(env.authUsers.has('guest_temp'), false);
  assert.equal(env.db.get('users')?.has('guest_temp'), false);
  assert.equal(env.db.get('user_private')?.has('guest_temp'), false);
  assert.equal(env.db.get('match_queue')?.has('guest_temp'), false);

  const cafe = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'rooms', rowId: 'official_cafe' });
  assert.equal((cafe.memberIds as string[]).includes('guest_temp'), false);
  assert.equal(cafe.activeCount, 0);
  // Permanent member untouched
  assert.equal(env.authUsers.has('member_g'), true);
  assert.equal(env.db.get('users')?.has('member_g'), true);
});

test('Abandoned Guest TTL cleanup removes stale guests without touching active guests or permanent members', async () => {
  const env = createInMemoryEnv();
  const nowMs = Date.now();
  const staleIso = new Date(nowMs - 30 * 60 * 1000).toISOString();
  const freshIso = new Date(nowMs - 10 * 1000).toISOString();

  env.authUsers.set('guest_stale', { $id: 'guest_stale', email: '', name: '', emailVerification: false, labels: [] });
  env.authUsers.set('guest_active', { $id: 'guest_active', email: '', name: '', emailVerification: false, labels: [] });
  env.authUsers.set('member_old', { $id: 'member_old', email: 'old@example.com', name: 'Old Member', emailVerification: true, labels: [] });

  await handleEconomyAction(
    env.economyCtx('guest_stale', 'ensureProfile', {
      guestProfile: { displayName: 'ضيف مهجور', age: 25, gender: 'female', acceptedTerms: true },
    })
  );
  await handleEconomyAction(
    env.economyCtx('guest_active', 'ensureProfile', {
      guestProfile: { displayName: 'ضيف نشط', age: 26, gender: 'male', acceptedTerms: true },
    })
  );
  await handleEconomyAction(env.economyCtx('member_old', 'ensureProfile'));

  await env.tablesDB.updateRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'guest_stale', data: { lastSeen: staleIso } });
  await env.tablesDB.updateRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'guest_active', data: { lastSeen: freshIso } });
  await env.tablesDB.updateRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'member_old', data: { lastSeen: staleIso } });

  const cleanupRes = await cleanupAbandonedGuests({
    tablesDB: env.tablesDB,
    usersApi: env.usersApi,
    databaseId: 'fadfada_db',
    tables: TABLES,
    Query: env.Query,
    nowMs,
    guestTtlMs: 15 * 60 * 1000,
  });

  assert.equal(cleanupRes.deletedGuests, 1);
  assert.deepEqual(cleanupRes.deletedGuestIds, ['guest_stale']);
  assert.equal(env.authUsers.has('guest_stale'), false);
  assert.equal(env.db.get('users')?.has('guest_stale'), false);
  assert.equal(env.authUsers.has('guest_active'), true);
  assert.equal(env.db.get('users')?.has('guest_active'), true);
  assert.equal(env.authUsers.has('member_old'), true);
  assert.equal(env.db.get('users')?.has('member_old'), true);
});

test('Presence TTL helpers expire stale/offline guests cleanly while preserving members', () => {
  const nowMs = Date.now();
  const base = {
    uid: 'x',
    username: 'x',
    displayName: 'X',
    avatar: '',
    cover: '',
    bio: '',
    gender: 'male',
    age: 22,
    country: '',
    countryCode: '',
    countryFlag: '',
    maritalStatus: 'single',
    partnerUid: '',
    partnerName: '',
    affiliation: '',
    role: 'guest',
    permissions: [],
    isBanned: false,
    banReason: '',
    level: 1,
    xp: 0,
    coins: 0,
    lastClaimKey: '',
    giftsSentCount: 0,
    giftsReceivedCount: 0,
    likesCount: 0,
    visitsCount: 0,
    friendsCount: 0,
    vipTier: 'none',
    vipExpiresAt: null,
    frameId: 'none',
    nameColor: '',
    isNamePinned: false,
    unlockedFeatures: [],
    badges: [],
    ghostMode: false,
    hideLastSeen: false,
    privacy: { messagePermission: 'everyone', showOnline: true, soundNotifications: true, visualNotifications: true },
    isOnline: true,
    isAnonymous: true,
    isPublic: true,
    freeMatchesUsedToday: 0,
    lastMatchDate: '',
    dailyMessagesSent: 0,
    lastMessageDate: '',
    createdAt: null,
    lastSeen: new Date(nowMs - 30_000).toISOString(),
  } as UserProfile;

  assert.equal(isUserPresenceOnline(base, nowMs), true);
  assert.equal(isExpiredOrOfflineGuest(base, nowMs), false);

  const missingLastSeen = { ...base, lastSeen: null };
  assert.equal(isUserPresenceOnline(missingLastSeen, nowMs), false);
  assert.equal(isExpiredOrOfflineGuest(missingLastSeen, nowMs), true);

  const expiredGuest = { ...base, lastSeen: new Date(nowMs - 180_000).toISOString() };
  assert.equal(isUserPresenceOnline(expiredGuest, nowMs), false);
  assert.equal(isExpiredOrOfflineGuest(expiredGuest, nowMs), true);

  const offlineMember = { ...expiredGuest, role: 'member' as const, isAnonymous: false };
  assert.equal(isExpiredOrOfflineGuest(offlineMember, nowMs), false);
});

test('7-day chat message retention deletes old DM & room messages + unreferenced Storage files only', async () => {
  const env = createInMemoryEnv();
  const nowMs = Date.now();
  const eightDaysAgo = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();

  env.authUsers.set('u_a', { $id: 'u_a', email: 'ua@example.com', name: 'A', emailVerification: true, labels: [] });
  env.authUsers.set('u_b', { $id: 'u_b', email: 'ub@example.com', name: 'B', emailVerification: true, labels: [] });
  await handleEconomyAction(env.economyCtx('u_a', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('u_b', 'ensureProfile'));

  env.storageFiles.set('orphan_old_file', { $id: 'orphan_old_file', bucketId: 'fadfada_media' });
  env.storageFiles.set('shared_wall_file', { $id: 'shared_wall_file', bucketId: 'fadfada_media' });
  env.storageFiles.set('fresh_chat_file', { $id: 'fresh_chat_file', bucketId: 'fadfada_media' });

  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: 'old_dm_1',
    data: {
      conversationId: 'c_1',
      senderId: 'u_a',
      recipientId: 'u_b',
      text: 'رسالة قديمة',
      mediaUrl: 'https://fra.cloud.appwrite.io/v1/storage/buckets/fadfada_media/files/orphan_old_file/view?project=p',
      createdAt: eightDaysAgo,
    },
  });
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: 'old_dm_shared',
    data: {
      conversationId: 'c_1',
      senderId: 'u_a',
      recipientId: 'u_b',
      text: 'ملف مشترك مع الحائط',
      mediaUrl: 'https://fra.cloud.appwrite.io/v1/storage/buckets/fadfada_media/files/shared_wall_file/view?project=p',
      createdAt: eightDaysAgo,
    },
  });
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'messages',
    rowId: 'fresh_dm_1',
    data: {
      conversationId: 'c_1',
      senderId: 'u_b',
      recipientId: 'u_a',
      text: 'رسالة حديثة',
      mediaUrl: 'https://fra.cloud.appwrite.io/v1/storage/buckets/fadfada_media/files/fresh_chat_file/view?project=p',
      createdAt: twoDaysAgo,
    },
  });
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'room_messages',
    rowId: 'old_room_msg',
    data: {
      roomId: 'official_cafe',
      senderId: 'u_a',
      text: 'رسالة غرفة قديمة',
      mediaUrl: '',
      createdAt: eightDaysAgo,
    },
  });
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'room_messages',
    rowId: 'fresh_room_msg',
    data: {
      roomId: 'official_cafe',
      senderId: 'u_a',
      text: 'رسالة غرفة حديثة',
      mediaUrl: '',
      createdAt: twoDaysAgo,
    },
  });
  await env.tablesDB.createRow({
    databaseId: 'fadfada_db',
    tableId: 'wall_posts',
    rowId: 'wall_1',
    data: {
      authorId: 'u_a',
      text: 'منشور يستخدم نفس الصورة',
      imageUrl: 'https://fra.cloud.appwrite.io/v1/storage/buckets/fadfada_media/files/shared_wall_file/view?project=p',
      createdAt: eightDaysAgo,
    },
  });

  // Non-owner cannot trigger maintenance manually
  await assert.rejects(
    () => runScheduledMaintenance(env.cleanupCtx({}, { callerUid: 'u_a', isScheduledTrigger: false, nowMs })),
    (err: unknown) => err instanceof CleanupHttpError && err.status === 403
  );

  const res = await deleteOldChatMessages({
    tablesDB: env.tablesDB,
    storageApi: env.storageApi,
    databaseId: 'fadfada_db',
    bucketId: 'fadfada_media',
    tables: TABLES,
    Query: env.Query,
    nowMs,
    retentionDays: 7,
  });

  assert.equal(res.deletedMessages, 2);
  assert.equal(res.deletedRoomMessages, 1);
  assert.equal(res.deletedFiles, 1);
  assert.equal(res.skippedReferencedFiles, 1);
  assert.equal(env.db.get('messages')?.has('fresh_dm_1'), true);
  assert.equal(env.db.get('room_messages')?.has('fresh_room_msg'), true);
  assert.equal(env.storageFiles.has('orphan_old_file'), false);
  assert.equal(env.storageFiles.has('shared_wall_file'), true);
  assert.equal(env.storageFiles.has('fresh_chat_file'), true);
  assert.equal(env.db.get('users')?.has('u_a'), true);
  assert.equal(env.db.get('users')?.has('u_b'), true);
});

test('Owner-only group deletion cascades room_messages and media without affecting moderators, users, or DMs', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('owner_x', { $id: 'owner_x', email: BOOTSTRAPPED_OWNER_EMAIL, name: 'OwnerX', emailVerification: true, labels: [] });
  env.authUsers.set('mod_x', { $id: 'mod_x', email: 'modx@example.com', name: 'ModX', emailVerification: true, labels: [] });
  env.authUsers.set('mem_x', { $id: 'mem_x', email: 'memx@example.com', name: 'MemX', emailVerification: true, labels: [] });

  await handleEconomyAction(env.economyCtx('owner_x', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('mod_x', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('mem_x', 'ensureProfile'));
  await handleAdminAction(env.adminCtx('owner_x', 'adminUpdateUser', { targetUid: 'mod_x', updates: { role: 'moderator' } }));

  const { roomId } = await handleEconomyAction(
    env.economyCtx('owner_x', 'createMemberRoom', { name: 'جروب للحذف', description: 'وصف', category: 'عام', theme: 'emerald' })
  );
  env.storageFiles.set('room_media_1', { $id: 'room_media_1', bucketId: 'fadfada_media' });
  await handleEconomyAction(
    env.economyCtx('owner_x', 'sendRoomMessage', {
      roomId,
      text: 'صورة داخل الجروب',
      type: 'image',
      mediaUrl: 'https://fra.cloud.appwrite.io/v1/storage/buckets/fadfada_media/files/room_media_1/view?project=p',
    })
  );
  await handleEconomyAction(env.economyCtx('owner_x', 'sendPrivateMessage', { recipientId: 'mem_x', text: 'رسالة خاصة باقية' }));

  // Moderator & member are rejected (403) on both deleteRoomAsOwner and deleteContentAsStaff('rooms')
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mod_x', 'deleteRoomAsOwner', { roomId })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mod_x', 'deleteContentAsStaff', { tableKey: 'rooms', rowId: roomId })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );
  await assert.rejects(
    () => handleAdminAction(env.adminCtx('mem_x', 'deleteRoomAsOwner', { roomId })),
    (err: unknown) => err instanceof AdminHttpError && err.status === 403
  );

  // Owner deletes the room cleanly
  const delRes = await handleAdminAction(env.adminCtx('owner_x', 'deleteRoomAsOwner', { roomId }));
  assert.equal(delRes.ok, true);
  assert.equal(delRes.deletedRoomId, roomId);
  assert.equal(delRes.deletedMessagesCount, 1);
  assert.equal(delRes.deletedFilesCount, 1);
  assert.equal(env.db.get('rooms')?.has(String(roomId)), false);
  assert.equal(env.storageFiles.has('room_media_1'), false);
  assert.equal(env.db.get('room_messages')?.size ?? 0, 0);
  // Users and private messages untouched
  assert.equal(env.db.get('users')?.has('mem_x'), true);
  assert.equal((env.db.get('messages')?.size ?? 0) >= 1, true);
});

test('Owner-configurable roomCreationCost enforces 0 (free), positive coin deduction, and insufficient balance 400', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('owner_p', { $id: 'owner_p', email: BOOTSTRAPPED_OWNER_EMAIL, name: 'OwnerP', emailVerification: true, labels: [] });
  env.authUsers.set('mem_p', { $id: 'mem_p', email: 'memp@example.com', name: 'MemP', emailVerification: true, labels: [] });

  await handleEconomyAction(env.economyCtx('owner_p', 'ensureProfile'));
  await handleEconomyAction(env.economyCtx('mem_p', 'ensureProfile'));
  await handleAdminAction(env.adminCtx('owner_p', 'ensureStaffDefaults'));

  // 1. Set roomCreationCost = 0 -> member with 50 coins creates room for free
  await handleAdminAction(
    env.adminCtx('owner_p', 'updateSiteSettings', { settings: { roomCreationCost: 0 } })
  );
  const freeRoom = await handleEconomyAction(
    env.economyCtx('mem_p', 'createMemberRoom', { name: 'جروب مجاني', description: 'مجاني', category: 'عام', theme: 'emerald' })
  );
  assert.ok(freeRoom.roomId);
  let memRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'mem_p' });
  assert.equal(memRow.coins, 50);

  // 2. Set roomCreationCost = 120 -> member with 50 coins gets 400
  await handleAdminAction(
    env.adminCtx('owner_p', 'updateSiteSettings', { settings: { roomCreationCost: 120 } })
  );
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('mem_p', 'createMemberRoom', { name: 'جروب مدفوع', description: '', category: 'عام', theme: 'emerald' })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 400
  );

  // 3. Give member 200 coins -> creates room -> exact 120 coins deducted -> 80 remaining
  await handleAdminAction(
    env.adminCtx('owner_p', 'adminUpdateUser', { targetUid: 'mem_p', updates: { coins: 200 } })
  );
  const paidRoom = await handleEconomyAction(
    env.economyCtx('mem_p', 'createMemberRoom', { name: 'جروب مدفوع ناجح', description: '', category: 'عام', theme: 'emerald' })
  );
  assert.ok(paidRoom.roomId);
  memRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'mem_p' });
  assert.equal(memRow.coins, 80);
});

test('IP Geolocation detects country via HTTPS, supports fallback & timeout, caches result, and never uses GPS or stores IP', async () => {
  resetGeolocationCacheForTests();

  // Verify no navigator.geolocation anywhere in src/
  const walkSrc = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walkSrc(full));
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  };
  for (const file of walkSrc(path.join(ROOT_DIR, 'src'))) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(/navigator\.geolocation/i.test(content), false, `Must not use GPS geolocation in ${file}`);
  }

  // 1. Primary HTTPS provider (ipwho.is) succeeds and caches without storing IP
  let calls = 0;
  const primaryFetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    assert.ok(String(input).startsWith('https://'), 'Geolocation endpoint must use HTTPS');
    return new Response(
      JSON.stringify({
        success: true,
        ip: '41.234.56.78',
        country: 'Egypt',
        country_code: 'EG',
        flag: { emoji: '🇪🇬' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as unknown as typeof fetch;

  const first = await detectUserCountry({ fetchImpl: primaryFetch });
  assert.deepEqual(first, { country: 'مصر', countryCode: 'EG', countryFlag: '🇪🇬' });
  assert.equal('ip' in (first as unknown as Record<string, unknown>), false);
  assert.equal(calls, 1);

  // Subsequent call uses cache without hitting network
  const cached = await detectUserCountry({ fetchImpl: primaryFetch });
  assert.deepEqual(cached, first);
  assert.equal(calls, 1);

  // 2. Primary fails/times out -> falls back to ipapi.co
  resetGeolocationCacheForTests();
  const hitUrls: string[] = [];
  const fallbackFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    hitUrls.push(url);
    if (url.includes('ipwho.is')) {
      return new Response('rate limited', { status: 429 });
    }
    if (url.includes('ipapi.co')) {
      assert.equal(init?.cache, 'no-store');
      return new Response(
        JSON.stringify({
          ip: '5.6.7.8',
          country_code: 'SA',
          country_name: 'Saudi Arabia',
        }),
        { status: 200 }
      );
    }
    throw new Error('Unexpected provider');
  }) as unknown as typeof fetch;

  const fallbackRes = await detectUserCountry({ fetchImpl: fallbackFetch, forceRefresh: true });
  assert.deepEqual(fallbackRes, { country: 'السعودية', countryCode: 'SA', countryFlag: '🇸🇦' });
  assert.equal(hitUrls.length, 2);

  // 3. Primary + Fallback1 fail -> Fallback2 (api.country.is) + Arabic Intl fallback
  resetGeolocationCacheForTests();
  const secondFallbackFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('country.is')) {
      return new Response(JSON.stringify({ ip: '1.2.3.4', country: 'DE' }), { status: 200 });
    }
    return new Response('{}', { status: 503 });
  }) as unknown as typeof fetch;

  const deRes = await detectUserCountry({ fetchImpl: secondFallbackFetch, forceRefresh: true });
  assert.ok(deRes);
  assert.equal(deRes.countryCode, 'DE');
  assert.equal(deRes.countryFlag, countryCodeToFlag('DE'));
  assert.equal(deRes.country, resolveArabicCountryName('DE'));

  // 4. All providers timeout/abort or error -> cleanly returns null without throwing
  resetGeolocationCacheForTests();
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })) as unknown as typeof fetch;

  const failedRes = await detectUserCountry({
    fetchImpl: hangingFetch,
    forceRefresh: true,
    timeoutMs: 25,
  });
  assert.equal(failedRes, null);
  resetGeolocationCacheForTests();
});

test('Server-side syncUserCountry stores country safely, blocks cross-user writes (403), and grants no guest privileges', async () => {
  const env = createInMemoryEnv();
  env.authUsers.set('mem_geo', { $id: 'mem_geo', email: 'geo@example.com', name: 'GeoMember', emailVerification: true, labels: [] });
  env.authUsers.set('guest_geo', { $id: 'guest_geo', email: '', name: '', emailVerification: false, labels: [] });

  // ensureProfile attaches detectedCountry cleanly for registered members without storing IP
  await handleEconomyAction(
    env.economyCtx('mem_geo', 'ensureProfile', {
      detectedCountry: { country: 'مصر', countryCode: 'EG', countryFlag: '🇪🇬', ip: '1.2.3.4' },
    })
  );
  let memRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'mem_geo' });
  assert.equal(memRow.country, 'مصر');
  assert.equal(memRow.countryCode, 'EG');
  assert.equal(memRow.countryFlag, '🇪🇬');
  assert.equal('ip' in memRow, false);

  // Country change updates user's country cleanly
  const syncRes = await handleEconomyAction(
    env.economyCtx('mem_geo', 'syncUserCountry', {
      country: 'الإمارات',
      countryCode: 'AE',
      countryFlag: '🇦🇪',
      ip: '9.9.9.9',
      coins: 99999,
      role: 'owner',
    })
  );
  assert.equal(syncRes.country, 'الإمارات');
  assert.equal(syncRes.countryCode, 'AE');
  assert.equal(syncRes.countryFlag, '🇦🇪');
  memRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'mem_geo' });
  assert.equal(memRow.country, 'الإمارات');
  assert.equal(memRow.countryCode, 'AE');
  assert.equal(memRow.countryFlag, '🇦🇪');
  assert.equal(memRow.coins, 50, 'syncUserCountry must never alter coins');
  assert.equal(memRow.role, 'member', 'syncUserCountry must never alter role');
  assert.equal('ip' in memRow, false);

  // Guest profile creation + syncUserCountry cannot grant member perks or coins
  await handleEconomyAction(
    env.economyCtx('guest_geo', 'ensureProfile', {
      guestProfile: { displayName: 'ضيف جغرافي', age: 23, gender: 'female', acceptedTerms: true },
      detectedCountry: { country: 'الأردن', countryCode: 'JO', countryFlag: '🇯🇴' },
    })
  );
  let guestRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'guest_geo' });
  assert.equal(guestRow.role, 'guest');
  assert.equal(guestRow.coins, 0);
  assert.equal(guestRow.country, 'الأردن');

  // Guest or member attempting to modify another user's country via targetUid/uid gets 403
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('guest_geo', 'syncUserCountry', {
          targetUid: 'mem_geo',
          country: 'المغرب',
          countryCode: 'MA',
          countryFlag: '🇲🇦',
        })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );
  await assert.rejects(
    () =>
      handleEconomyAction(
        env.economyCtx('guest_geo', 'updateProfile', {
          uid: 'mem_geo',
          username: 'hacked',
          displayName: 'Hacked',
        })
      ),
    (err: unknown) => err instanceof HttpError && err.status === 403
  );
  memRow = await env.tablesDB.getRow({ databaseId: 'fadfada_db', tableId: 'users', rowId: 'mem_geo' });
  assert.equal(memRow.country, 'الإمارات', 'Target user country must remain untouched');
});

test('sortOnlineUsers matches by countryCode as well as country name while preserving gender ordering', () => {
  const sample = [
    { uid: 'unk_m', displayName: 'أحمد', country: '', countryCode: '', gender: 'male' as const, isOnline: true },
    { uid: 'other_f', displayName: 'سارة', country: 'السعودية', countryCode: 'SA', gender: 'female' as const, isOnline: true },
    { uid: 'same_m', displayName: 'كريم', country: 'Egypt', countryCode: 'EG', gender: 'male' as const, isOnline: true },
    { uid: 'same_f', displayName: 'ليلى', country: 'مصر', countryCode: 'EG', gender: 'female' as const, isOnline: true },
    { uid: 'other_m', displayName: 'فهد', country: 'السعودية', countryCode: 'SA', gender: 'male' as const, isOnline: true },
  ] as unknown as UserProfile[];

  const sorted = sortOnlineUsers(
    sample,
    { country: 'مصر', countryCode: 'EG' } as UserProfile,
    (u) => Boolean(u.isOnline),
    () => 0
  ).map((u) => u.uid);

  assert.deepEqual(sorted, ['same_f', 'same_m', 'other_f', 'other_m', 'unk_m']);
});


