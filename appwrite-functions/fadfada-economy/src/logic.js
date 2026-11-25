export const BOOTSTRAPPED_OWNER_EMAIL = 'owner@fadfada.app';
export const BOOTSTRAPPED_OWNER_EMAILS = ['owner@fadfada.app', 'hegazymr6@gmail.com'];

export const WHEEL_REWARDS = [
  { coins: 25, xp: 30 },
  { coins: 50, xp: 45 },
  { coins: 75, xp: 60 },
  { coins: 100, xp: 90 },
  { coins: 150, xp: 120 },
  { coins: 200, xp: 150 },
];

export const DEFAULT_STORE_PRICES = {
  vip_silver: { id: 'vip_silver', section: 'vip', name: 'عضوية VIP فضية', priceCoins: 300, durationDays: 30, code: 'silver', color: '#64748B', imageUrl: '', isActive: true },
  vip_gold: { id: 'vip_gold', section: 'vip', name: 'عضوية VIP ذهبية', priceCoins: 650, durationDays: 30, code: 'gold', color: '#D97706', imageUrl: '', isActive: true },
  vip_royal: { id: 'vip_royal', section: 'vip', name: 'عضوية VIP ملكية', priceCoins: 1200, durationDays: 30, code: 'royal', color: '#0D7A5F', imageUrl: '', isActive: true },
  feat_ghost: { id: 'feat_ghost', section: 'feature', name: 'وضع الشبح (Ghost Mode)', priceCoins: 200, durationDays: 30, code: 'ghostMode', color: '#475569', imageUrl: '', isActive: true },
  feat_pin: { id: 'feat_pin', section: 'feature', name: 'تثبيت الاسم (Pin Name)', priceCoins: 250, durationDays: 30, code: 'pinName', color: '#0D7A5F', imageUrl: '', isActive: true },
  feat_color: { id: 'feat_color', section: 'feature', name: 'تلوين الاسم', priceCoins: 120, durationDays: 30, code: 'nameColor', color: '#0369A1', imageUrl: '', isActive: true },
  feat_hidelast: { id: 'feat_hidelast', section: 'feature', name: 'إخفاء آخر ظهور', priceCoins: 150, durationDays: 30, code: 'hideLastSeen', color: '#334155', imageUrl: '', isActive: true },
  feat_themes: { id: 'feat_themes', section: 'feature', name: 'ثيمات المحادثة', priceCoins: 100, durationDays: 365, code: 'chatThemes', color: '#B45309', imageUrl: '', isActive: true },
  frame_emerald: { id: 'frame_emerald', section: 'frame', name: 'إطار الزمرد', priceCoins: 140, durationDays: 90, code: 'emerald_glow', color: '#0D7A5F', imageUrl: '', isActive: true },
  frame_gold: { id: 'frame_gold', section: 'frame', name: 'إطار الذهب الملكي', priceCoins: 240, durationDays: 90, code: 'gold_crown', color: '#D97706', imageUrl: '', isActive: true },
  frame_sapphire: { id: 'frame_sapphire', section: 'frame', name: 'إطار الياقوت', priceCoins: 220, durationDays: 90, code: 'royal_sapphire', color: '#0284C7', imageUrl: '', isActive: true },
  badge_supporter: { id: 'badge_supporter', section: 'badge', name: 'شارة داعم فضفضة', priceCoins: 350, durationDays: 365, code: 'supporter', color: '#0D7A5F', imageUrl: '', isActive: true },
  badge_star: { id: 'badge_star', section: 'badge', name: 'شارة نجم الحوار', priceCoins: 280, durationDays: 180, code: 'dialogue_star', color: '#B45309', imageUrl: '', isActive: true },
  gift_coffee: { id: 'gift_coffee', section: 'gift', name: 'فنجان قهوة', priceCoins: 25, durationDays: 0, code: 'coffee', color: '#92400E', imageUrl: '', isActive: true },
  gift_rose: { id: 'gift_rose', section: 'gift', name: 'باقة ورد', priceCoins: 60, durationDays: 0, code: 'rose', color: '#BE123C', imageUrl: '', isActive: true },
  gift_crown: { id: 'gift_crown', section: 'gift', name: 'تاج الفخامة', priceCoins: 250, durationDays: 0, code: 'crown', color: '#D97706', imageUrl: '', isActive: true },
};

export const DEFAULT_TASK_MAP = {
  checkin: { key: 'checkin', rewardCoins: 35, rewardXp: 40, isActive: true },
  engage: { key: 'engage', rewardCoins: 45, rewardXp: 60, isActive: true },
  send_message: { key: 'engage', rewardCoins: 45, rewardXp: 60, isActive: true },
  send_image: { key: 'send_image', rewardCoins: 40, rewardXp: 45, isActive: true },
  join_room: { key: 'join_room', rewardCoins: 35, rewardXp: 40, isActive: true },
  use_microphone: { key: 'use_microphone', rewardCoins: 50, rewardXp: 60, isActive: true },
  share: { key: 'share', rewardCoins: 40, rewardXp: 50, isActive: true },
  ad_watch: { key: 'ad_watch', rewardCoins: 30, rewardXp: 35, isActive: true },
  referral: { key: 'referral', rewardCoins: 75, rewardXp: 80, isActive: true },
};

export const DEFAULT_SETTINGS = {
  guestDailyMessageLimit: 25,
  roomCreationCost: 150,
  randomMatchFreeDaily: 3,
  randomMatchCost: 30,
  randomMatchDurationSec: 300,
  shoutoutCost: 80,
  marriageSiteFeePercent: 20,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function calculateLevelFromXp(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, Number(xp || 0)) / 40)) + 1;
  return Math.min(100, Math.max(1, level));
}

export function deterministicRowId(prefix, rawKey) {
  const safePrefix = String(prefix || 'r').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'r';
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

export function getSortedParticipants(uid1, uid2) {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

function parseJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return fallback;
  }
}

function buildSafeUsername(user) {
  const baseFromEmail = user.email ? String(user.email).split('@')[0] : '';
  const baseFromName = user.name ? String(user.name) : '';
  const isAnon = !user.email;
  const raw = (baseFromEmail || baseFromName || (isAnon ? 'guest' : 'user'))
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 18);
  const prefix = raw.length >= 3 ? raw : isAnon ? 'guest' : 'fadfada';
  const suffix = String(user.$id).slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, '0');
  return `${prefix}_${suffix}`.slice(0, 30);
}

function buildDisplayName(user) {
  if (user.name && String(user.name).trim().length > 0) {
    return String(user.name).trim().slice(0, 60);
  }
  if (user.email) {
    return String(user.email).split('@')[0].slice(0, 60);
  }
  return `زائر ${String(user.$id).slice(0, 4)}`;
}

async function getRowOrNull(tablesDB, databaseId, tableId, rowId) {
  try {
    return await tablesDB.getRow({ databaseId, tableId, rowId });
  } catch (err) {
    if (err?.code === 404) return null;
    throw err;
  }
}

async function getSiteSettings(tablesDB, databaseId, tables) {
  const row = await getRowOrNull(tablesDB, databaseId, tables.siteSettings, 'global');
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    guestDailyMessageLimit: Number(row.guestDailyMessageLimit ?? DEFAULT_SETTINGS.guestDailyMessageLimit),
    roomCreationCost: Number(row.roomCreationCost ?? DEFAULT_SETTINGS.roomCreationCost),
    randomMatchFreeDaily: Number(row.randomMatchFreeDaily ?? DEFAULT_SETTINGS.randomMatchFreeDaily),
    randomMatchCost: Number(row.randomMatchCost ?? DEFAULT_SETTINGS.randomMatchCost),
    randomMatchDurationSec: Number(row.randomMatchDurationSec ?? DEFAULT_SETTINGS.randomMatchDurationSec),
    shoutoutCost: Number(row.shoutoutCost ?? DEFAULT_SETTINGS.shoutoutCost),
    marriageSiteFeePercent: Number(row.marriageSiteFeePercent ?? DEFAULT_SETTINGS.marriageSiteFeePercent),
  };
}

async function createNotification(ctx, { recipientId, senderId, type, title, body }) {
  const { tablesDB, databaseId, tables, Permission, Role, ID } = ctx;
  try {
    await tablesDB.createRow({
      databaseId,
      tableId: tables.notifications,
      rowId: ID.unique(),
      data: {
        recipientId,
        senderId,
        type,
        title: String(title).slice(0, 120),
        body: String(body).slice(0, 400),
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      permissions: [Permission.read(Role.user(recipientId))],
    });
  } catch {
    // Non-blocking notification write
  }
}

async function logCoinTx(ctx, { type, senderId, recipientId, amount, recipientAmount, note }) {
  const { tablesDB, databaseId, tables, Permission, Role, ID } = ctx;
  const perms = new Set([Permission.read(Role.label('staff'))]);
  if (senderId && senderId !== 'system' && senderId !== 'admin') {
    perms.add(Permission.read(Role.user(senderId)));
  }
  if (recipientId && recipientId !== 'system' && recipientId !== 'admin') {
    perms.add(Permission.read(Role.user(recipientId)));
  }
  await tablesDB.createRow({
    databaseId,
    tableId: tables.coinTransactions,
    rowId: ID.unique(),
    data: {
      type,
      senderId,
      recipientId,
      amount: Math.floor(amount),
      recipientAmount: Math.floor(recipientAmount),
      note: String(note || '').slice(0, 200),
      createdAt: new Date().toISOString(),
    },
    permissions: Array.from(perms),
  });
}

function assertNotBanned(profile) {
  if (profile.isBanned && profile.role !== 'owner' && profile.role !== 'moderator') {
    throw new HttpError(403, 'هذا الحساب مقيد حاليًا ولا يمكنه تنفيذ هذه العملية.');
  }
}

function assertNotGuest(profile) {
  if (profile.role === 'guest' || profile.isAnonymous === true) {
    throw new HttpError(
      403,
      'هذه الميزة متاحة للأعضاء المسجلين فقط. يمكنك ترقية حسابك من صفحة الحساب.'
    );
  }
}

function safeMediaUrl(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  if (/^(https?:\/\/|\/)/.test(clean)) return clean.slice(0, 850);
  return '';
}

async function listRowsSafe(tablesDB, params) {
  try {
    return await tablesDB.listRows(params);
  } catch {
    return { rows: [], total: 0 };
  }
}

function sanitizeCountryPayload(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawCountry = String(src.country ?? '').trim();
  const cleanCountry =
    rawCountry === 'أخرى' || rawCountry === 'غير محدد' || rawCountry === 'دولة غير محددة'
      ? ''
      : rawCountry.slice(0, 60);
  const rawCode = String(src.countryCode ?? '').trim().toUpperCase();
  const cleanCode = /^[A-Z]{2}$/.test(rawCode) ? rawCode : '';
  const cleanFlag = cleanCountry ? String(src.countryFlag ?? '').trim().slice(0, 16) : '';
  return {
    country: cleanCountry,
    countryCode: cleanCountry ? cleanCode : '',
    countryFlag: cleanFlag,
  };
}

function isUnknownCountryCodeAttrError(err) {
  const msg = String(err?.message || '');
  return err?.code === 400 && msg.includes('countryCode');
}

async function createUserRowWithCountryFallback(tablesDB, params) {
  try {
    return await tablesDB.createRow(params);
  } catch (err) {
    if (isUnknownCountryCodeAttrError(err) && 'countryCode' in (params.data || {})) {
      const fallbackData = { ...(params.data || {}) };
      delete fallbackData.countryCode;
      return await tablesDB.createRow({ ...params, data: fallbackData });
    }
    throw err;
  }
}

async function updateUserRowWithCountryFallback(tablesDB, params) {
  try {
    return await tablesDB.updateRow(params);
  } catch (err) {
    if (isUnknownCountryCodeAttrError(err) && 'countryCode' in (params.data || {})) {
      const fallbackData = { ...(params.data || {}) };
      delete fallbackData.countryCode;
      return await tablesDB.updateRow({ ...params, data: fallbackData });
    }
    throw err;
  }
}

const GUEST_ABANDONED_TTL_MS = 15 * 60 * 1000;

async function purgeGuestRecordsAndAuth({
  uid,
  tablesDB,
  usersApi,
  databaseId,
  tables,
  Query,
}) {
  if (!uid) return;

  if (tables.rooms) {
    const roomsRes = await listRowsSafe(tablesDB, {
      databaseId,
      tableId: tables.rooms,
      queries: [Query.contains('memberIds', uid), Query.limit(100)],
    });
    for (const room of roomsRes.rows || []) {
      const members = Array.isArray(room.memberIds) ? room.memberIds.map(String) : [];
      if (members.includes(uid)) {
        const nextMembers = members.filter((id) => id !== uid);
        await tablesDB
          .updateRow({
            databaseId,
            tableId: tables.rooms,
            rowId: room.$id,
            data: { memberIds: nextMembers, activeCount: nextMembers.length },
          })
          .catch(() => {});
      }
    }
  }

  if (tables.matchQueue) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.matchQueue, rowId: uid }).catch(() => {});
  }

  const cleanupQueries = [
    tables.dailyClaims ? { tableId: tables.dailyClaims, field: 'uid' } : null,
    tables.notifications ? { tableId: tables.notifications, field: 'recipientId' } : null,
    tables.notifications ? { tableId: tables.notifications, field: 'senderId' } : null,
    tables.profileVisits ? { tableId: tables.profileVisits, field: 'visitorUid' } : null,
    tables.profileVisits ? { tableId: tables.profileVisits, field: 'profileUid' } : null,
  ].filter(Boolean);

  for (const target of cleanupQueries) {
    const res = await listRowsSafe(tablesDB, {
      databaseId,
      tableId: target.tableId,
      queries: [Query.equal(target.field, uid), Query.limit(100)],
    });
    for (const row of res.rows || []) {
      await tablesDB.deleteRow({ databaseId, tableId: target.tableId, rowId: row.$id }).catch(() => {});
    }
  }

  if (tables.userPrivate) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.userPrivate, rowId: uid }).catch(() => {});
  }
  if (tables.users) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.users, rowId: uid }).catch(() => {});
  }

  if (usersApi && typeof usersApi.delete === 'function') {
    const targetAuth =
      typeof usersApi.get === 'function' ? await usersApi.get({ userId: uid }).catch(() => null) : null;
    const hasEmailOrPhone = Boolean(targetAuth?.email) || Boolean(targetAuth?.phone);
    const hasStaff = Array.isArray(targetAuth?.labels) && targetAuth.labels.includes('staff');
    if (targetAuth && !hasEmailOrPhone && !hasStaff) {
      await usersApi.delete({ userId: uid }).catch(() => {});
    }
  }
}

async function sweepAbandonedGuestsQuick({
  tablesDB,
  usersApi,
  databaseId,
  tables,
  Query,
  excludeUid = '',
  nowMs = Date.now(),
}) {
  try {
    const cutoffIso = new Date(nowMs - GUEST_ABANDONED_TTL_MS).toISOString();
    const res = await listRowsSafe(tablesDB, {
      databaseId,
      tableId: tables.users,
      queries: [Query.equal('role', 'guest'), Query.limit(20)],
    });
    for (const row of res.rows || []) {
      const uid = String(row.uid || row.$id);
      if (!uid || uid === excludeUid) continue;
      if (row.role !== 'guest' || row.isAnonymous !== true) continue;
      const lastSeenRaw = String(row.lastSeen || row.$updatedAt || row.createdAt || '');
      const lastSeenMs = Date.parse(lastSeenRaw);
      if (!Number.isFinite(lastSeenMs) || lastSeenRaw >= cutoffIso || nowMs - lastSeenMs < GUEST_ABANDONED_TTL_MS) {
        continue;
      }
      await purgeGuestRecordsAndAuth({
        uid,
        tablesDB,
        usersApi,
        databaseId,
        tables,
        Query,
      });
    }
  } catch {
    // Non-blocking opportunistic sweep
  }
}

async function checkDailyTaskCompletion(ctx, caller, rawKey, payload, dateKey) {
  const { callerUid, tablesDB, databaseId, tables, Query } = ctx;
  const dayStartIso = `${dateKey}T00:00:00.000Z`;
  const canonicalKey = rawKey === 'send_message' ? 'engage' : rawKey;

  if (canonicalKey === 'checkin' || canonicalKey === 'daily_wheel') {
    return { completed: true };
  }

  if (canonicalKey === 'engage') {
    const [dmRes, roomRes, wallRes, commentRes] = await Promise.all([
      tables.messages
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.messages,
            queries: [
              Query.equal('senderId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(1),
            ],
          })
        : Promise.resolve({ rows: [] }),
      tables.roomMessages
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.roomMessages,
            queries: [
              Query.equal('senderId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(1),
            ],
          })
        : Promise.resolve({ rows: [] }),
      tables.wallPosts
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.wallPosts,
            queries: [
              Query.equal('authorId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(1),
            ],
          })
        : Promise.resolve({ rows: [] }),
      tables.wallComments
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.wallComments,
            queries: [
              Query.equal('senderId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(1),
            ],
          })
        : Promise.resolve({ rows: [] }),
    ]);
    const ok =
      dmRes.rows.length > 0 ||
      roomRes.rows.length > 0 ||
      wallRes.rows.length > 0 ||
      commentRes.rows.length > 0;
    return { completed: ok };
  }

  if (canonicalKey === 'send_image') {
    const [dmMedia, roomMedia, wallPosts] = await Promise.all([
      tables.messages
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.messages,
            queries: [
              Query.equal('senderId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(20),
            ],
          })
        : Promise.resolve({ rows: [] }),
      tables.roomMessages
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.roomMessages,
            queries: [
              Query.equal('senderId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(20),
            ],
          })
        : Promise.resolve({ rows: [] }),
      tables.wallPosts
        ? listRowsSafe(tablesDB, {
            databaseId,
            tableId: tables.wallPosts,
            queries: [
              Query.equal('authorId', callerUid),
              Query.greaterThanEqual('createdAt', dayStartIso),
              Query.limit(10),
            ],
          })
        : Promise.resolve({ rows: [] }),
    ]);
    const hasMedia =
      dmMedia.rows.some((r) => r.type === 'image' || r.type === 'video') ||
      roomMedia.rows.some((r) => r.type === 'image' || r.type === 'video') ||
      wallPosts.rows.some((r) => Boolean(String(r.imageUrl || '').trim()));
    return { completed: hasMedia };
  }

  if (canonicalKey === 'join_room') {
    const roomsRes = await listRowsSafe(tablesDB, {
      databaseId,
      tableId: tables.rooms,
      queries: [Query.contains('memberIds', callerUid), Query.limit(1)],
    });
    return { completed: roomsRes.rows.length > 0 };
  }

  if (canonicalKey === 'use_microphone') {
    const shoutRes = await listRowsSafe(tablesDB, {
      databaseId,
      tableId: tables.shoutouts,
      queries: [
        Query.equal('authorId', callerUid),
        Query.greaterThanEqual('createdAt', dayStartIso),
        Query.limit(1),
      ],
    });
    return { completed: shoutRes.rows.length > 0 };
  }

  if (canonicalKey === 'share' || canonicalKey === 'ad_watch') {
    const priv = await getRowOrNull(tablesDB, databaseId, tables.userPrivate, callerUid);
    const activity = parseJson(priv?.dailyActivityJson, {});
    const isToday = activity?.dateKey === dateKey;
    const completed =
      canonicalKey === 'share'
        ? Boolean(isToday && activity?.shared)
        : Boolean(isToday && activity?.watchedAd);
    return { completed };
  }

  if (canonicalKey === 'referral') {
    const priv = await getRowOrNull(tablesDB, databaseId, tables.userPrivate, callerUid);
    if (priv?.referredBy && String(priv.referredBy) !== callerUid) {
      return { completed: true, referrerUid: String(priv.referredBy) };
    }
    const rawCode = String(payload?.referralCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (rawCode.length >= 6) {
      const usersList = await listRowsSafe(tablesDB, {
        databaseId,
        tableId: tables.users,
        queries: [Query.limit(200)],
      });
      const match = usersList.rows.find(
        (u) =>
          u.$id !== callerUid &&
          u.role !== 'guest' &&
          !u.isAnonymous &&
          String(u.$id).slice(0, 8).toUpperCase() === rawCode.slice(0, 8)
      );
      if (match) {
        return { completed: true, referrerUid: String(match.$id) };
      }
    }
    return { completed: false };
  }

  return { completed: false };
}

export async function handleEconomyAction(ctx) {
  const {
    callerUid,
    action,
    payload = {},
    tablesDB,
    usersApi,
    databaseId,
    tables,
    Permission,
    Role,
    ID,
    Query,
  } = ctx;

  if (!callerUid) {
    throw new HttpError(401, 'يجب تسجيل الدخول أولاً.');
  }

  const nowIso = new Date().toISOString();

  // -------------------------------------------------------------------------
  // 1. Ensure / Bootstrap Profile
  // -------------------------------------------------------------------------
  if (action === 'ensureProfile') {
    const authUser = await usersApi.get({ userId: callerUid });
    const email = String(authUser.email || '').toLowerCase();
    const isOwnerEmail = BOOTSTRAPPED_OWNER_EMAILS.includes(email) && Boolean(authUser.emailVerification);
    const isAnonymous = !email && !(authUser.phone && authUser.phone.length > 0);
    const guestProfile = payload.guestProfile && typeof payload.guestProfile === 'object' ? payload.guestProfile : null;
    const acceptedTermsFlag = Boolean(guestProfile?.acceptedTerms ?? payload.acceptedTerms);

    const existing = await getRowOrNull(tablesDB, databaseId, tables.users, callerUid);
    let profileRow;

    if (!existing) {
      let initialDisplayName = buildDisplayName(authUser);
      let initialGender = 'unspecified';
      let initialAge = 0;

      if (isAnonymous && guestProfile) {
        const gName = String(guestProfile.displayName || '').trim();
        const gAge = Math.floor(Number(guestProfile.age ?? 0));
        const gGender = guestProfile.gender === 'female' || guestProfile.gender === 'male' ? guestProfile.gender : '';
        if (gName.length < 2 || gName.length > 60) {
          throw new HttpError(400, 'يرجى إدخال اسم ظاهر مناسب (حرفين على الأقل).');
        }
        if (!Number.isFinite(gAge) || gAge < 18 || gAge > 99) {
          throw new HttpError(400, 'الدخول متاح لمن هم بعمر 18 سنة فأكثر فقط.');
        }
        if (!gGender) {
          throw new HttpError(400, 'يرجى اختيار النوع (ذكر أو أنثى).');
        }
        if (!guestProfile.acceptedTerms) {
          throw new HttpError(400, 'يجب الموافقة على الشروط والأحكام أولاً.');
        }
        initialDisplayName = gName;
        initialGender = gGender;
        initialAge = gAge;
      }

      const initialCountry = sanitizeCountryPayload(payload.detectedCountry || {});
      const role = isOwnerEmail ? 'owner' : isAnonymous ? 'guest' : 'member';
      profileRow = await createUserRowWithCountryFallback(tablesDB, {
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: {
          uid: callerUid,
          username: buildSafeUsername(authUser),
          displayName: initialDisplayName,
          avatar: '',
          cover: '',
          bio: isAnonymous ? 'ضيف في منصة فضفضة' : 'عضو جديد في فضفضة',
          gender: initialGender,
          age: initialAge,
          country: initialCountry.country,
          countryCode: initialCountry.countryCode,
          countryFlag: initialCountry.countryFlag,
          maritalStatus: 'single',
          partnerUid: '',
          partnerName: '',
          affiliation: '',
          role,
          permissions: isOwnerEmail ? ['*'] : [],
          isBanned: false,
          banReason: '',
          level: 1,
          xp: 0,
          coins: isOwnerEmail ? 5000 : isAnonymous ? 0 : 50,
          lastClaimKey: '',
          giftsSentCount: 0,
          giftsReceivedCount: 0,
          likesCount: 0,
          visitsCount: 0,
          friendsCount: 0,
          vipTier: 'none',
          vipExpiresAt: 0,
          frameId: 'none',
          nameColor: '',
          isNamePinned: false,
          unlockedFeatures: [],
          badgesJson: '[]',
          ghostMode: false,
          hideLastSeen: false,
          privacyJson: JSON.stringify({
            messagePermission: 'everyone',
            showOnline: true,
            soundNotifications: true,
            visualNotifications: true,
          }),
          isOnline: true,
          isAnonymous,
          acceptedTerms: isAnonymous ? Boolean(guestProfile?.acceptedTerms) : Boolean(payload.acceptedTerms ?? true),
          isPublic: true,
          freeMatchesUsedToday: 0,
          lastMatchDate: '',
          dailyMessagesSent: 0,
          lastMessageDate: '',
          createdAt: nowIso,
          lastSeen: nowIso,
        },
        permissions: [Permission.read(Role.users())],
      });
    } else {
      const updates = {
        isOnline: true,
        lastSeen: nowIso,
      };
      if (isOwnerEmail && existing.role !== 'owner') {
        updates.role = 'owner';
        updates.coins = Math.max(5000, Number(existing.coins ?? 0));
        const existingPerms = Array.isArray(existing.permissions) ? existing.permissions : [];
        if (!existingPerms.includes('*')) {
          updates.permissions = [...existingPerms, '*'];
        }
      }
      if (isAnonymous && guestProfile) {
        const gName = String(guestProfile.displayName || '').trim();
        const gAge = Math.floor(Number(guestProfile.age ?? 0));
        const gGender = guestProfile.gender === 'female' || guestProfile.gender === 'male' ? guestProfile.gender : '';
        if (gName.length >= 2) updates.displayName = gName.slice(0, 60);
        if (gAge >= 18 && gAge <= 99) updates.age = gAge;
        if (gGender) updates.gender = gGender;
        if (guestProfile.acceptedTerms) updates.acceptedTerms = true;
      }
      if (!isAnonymous && existing.isAnonymous) {
        updates.isAnonymous = false;
        if (existing.role === 'guest') {
          updates.role = 'member';
          updates.coins = Math.max(Number(existing.coins ?? 0), 50);
          updates.bio = existing.bio === 'ضيف في منصة فضفضة' ? 'عضو في فضفضة' : existing.bio;
        }
      }
      if (acceptedTermsFlag && !existing.acceptedTerms) {
        updates.acceptedTerms = true;
      }
      profileRow = await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: updates,
      });
    }

    // Ensure staff label sync for RBAC queries & Realtime
    const effectiveRole = String(profileRow.role || 'member');
    const shouldBeStaff = effectiveRole === 'owner' || effectiveRole === 'moderator';
    const currentLabels = Array.isArray(authUser.labels) ? authUser.labels : [];
    const hasStaffLabel = currentLabels.includes('staff');
    if (shouldBeStaff !== hasStaffLabel && typeof usersApi.updateLabels === 'function') {
      const nextLabels = shouldBeStaff
        ? Array.from(new Set([...currentLabels, 'staff']))
        : currentLabels.filter((l) => l !== 'staff');
      await usersApi.updateLabels({ userId: callerUid, labels: nextLabels }).catch(() => {});
    }

    // Store private user email only in private row readable strictly by owner
    const existingPrivate = await getRowOrNull(tablesDB, databaseId, tables.userPrivate, callerUid);
    await tablesDB
      .upsertRow({
        databaseId,
        tableId: tables.userPrivate,
        rowId: callerUid,
        data: {
          uid: callerUid,
          email: String(authUser.email || '').slice(0, 254),
          provider: isAnonymous ? 'anonymous' : 'account',
          dailyActivityJson: String(existingPrivate?.dailyActivityJson || '{}'),
          referredBy: String(existingPrivate?.referredBy || ''),
          updatedAt: nowIso,
        },
        permissions: [Permission.read(Role.user(callerUid))],
      })
      .catch(() => {});

    await sweepAbandonedGuestsQuick({
      tablesDB,
      usersApi,
      databaseId,
      tables,
      Query,
      excludeUid: callerUid,
    });

    return profileRow;
  }

  // Load caller profile for all subsequent actions
  const caller = await getRowOrNull(tablesDB, databaseId, tables.users, callerUid);
  if (!caller) {
    throw new HttpError(404, 'تعذر العثور على ملف المستخدم.');
  }

  // -------------------------------------------------------------------------
  // 2. Presence, Guest Logout Purge & Safe Self Profile Updates
  // -------------------------------------------------------------------------
  if (action === 'deleteGuestAccount') {
    const authUser =
      typeof usersApi.get === 'function' ? await usersApi.get({ userId: callerUid }).catch(() => null) : null;
    const isAuthAnonymous = authUser
      ? !authUser.email && !(authUser.phone && authUser.phone.length > 0)
      : true;
    const isStaffAuth = Array.isArray(authUser?.labels) && authUser.labels.includes('staff');

    if (caller.role !== 'guest' || caller.isAnonymous !== true || !isAuthAnonymous || isStaffAuth) {
      throw new HttpError(403, 'حذف الجلسة الفوري متاح لحسابات الضيوف المؤقتة فقط.');
    }

    await purgeGuestRecordsAndAuth({
      uid: callerUid,
      tablesDB,
      usersApi,
      databaseId,
      tables,
      Query,
    });

    return { ok: true, deleted: true, deletedUid: callerUid };
  }

  if (action === 'syncPresence') {
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        isOnline: Boolean(payload.isOnline),
        lastSeen: nowIso,
      },
    });
  }

  if (action === 'syncUserCountry') {
    if ((payload.targetUid && payload.targetUid !== callerUid) || (payload.uid && payload.uid !== callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بتعديل دولة مستخدم آخر.');
    }
    const clean = sanitizeCountryPayload(payload);
    if (!clean.country) {
      throw new HttpError(400, 'بيانات الدولة غير صالحة.');
    }
    return await updateUserRowWithCountryFallback(tablesDB, {
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        country: clean.country,
        countryCode: clean.countryCode,
        countryFlag: clean.countryFlag,
        lastSeen: nowIso,
      },
    });
  }

  if (action === 'submitAppeal') {
    const reason = String(payload.reason || '').trim().slice(0, 1000);
    if (!reason) throw new HttpError(400, 'يرجى كتابة سبب الالتماس.');
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.appeals,
      rowId: ID.unique(),
      data: {
        userId: callerUid,
        userName: String(caller.displayName || 'عضو'),
        reason,
        status: 'pending',
        adminNote: '',
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid)), Permission.read(Role.label('staff'))],
    });
  }

  // Block banned users from remaining actions
  assertNotBanned(caller);

  if (action === 'updateProfile') {
    if ((payload.targetUid && payload.targetUid !== callerUid) || (payload.uid && payload.uid !== callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بتعديل ملف مستخدم آخر.');
    }
    const username = String(payload.username || '').trim().toLowerCase();
    const displayName = String(payload.displayName || '').trim();
    const bio = String(payload.bio || '').trim();
    const age = Math.floor(Number(payload.age ?? 0));

    if (username.length < 3 || username.length > 30 || !/^[a-z0-9_.]+$/.test(username)) {
      throw new HttpError(400, 'اسم المستخدم يجب أن يكون بين 3 و30 حرفًا (أحرف إنجليزية، أرقام، _ أو . فقط).');
    }
    if (displayName.length < 1 || displayName.length > 60) {
      throw new HttpError(400, 'الاسم الظاهر يجب أن يكون بين 1 و60 حرفًا.');
    }
    if (bio.length > 240) {
      throw new HttpError(400, 'النبذة التعريفية لا يجب أن تتجاوز 240 حرفًا.');
    }
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      throw new HttpError(400, 'العمر غير صالح.');
    }

    // Enforce unique username
    if (username !== caller.username) {
      const dupes = await tablesDB.listRows({
        databaseId,
        tableId: tables.users,
        queries: [Query.equal('username', username), Query.limit(2)],
      });
      if (dupes.rows.some((r) => r.$id !== callerUid)) {
        throw new HttpError(409, 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر.');
      }
    }

    const allowedGenders = ['unspecified', 'male', 'female'];
    const gender = allowedGenders.includes(payload.gender) ? payload.gender : caller.gender;
    const allowedMarital = ['single', 'engaged', 'complicated'];
    const requestedMarital = String(payload.maritalStatus || 'single');
    const maritalStatus =
      caller.maritalStatus === 'married'
        ? 'married'
        : allowedMarital.includes(requestedMarital)
        ? requestedMarital
        : 'single';

    const cleanCountryData = sanitizeCountryPayload(payload);

    return await updateUserRowWithCountryFallback(tablesDB, {
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        username,
        displayName,
        avatar: String(payload.avatar || '').trim().slice(0, 500),
        cover: String(payload.cover || '').trim().slice(0, 500),
        bio,
        gender,
        age,
        country: cleanCountryData.country,
        countryCode: cleanCountryData.countryCode,
        countryFlag: cleanCountryData.countryFlag,
        maritalStatus,
        affiliation: String(payload.affiliation || '').trim().slice(0, 60),
        isPublic: true,
        lastSeen: nowIso,
      },
    });
  }

  if (action === 'updatePrivacy') {
    const rawPrivacy = payload.privacy || {};
    const allowedPerms = ['everyone', 'friends', 'nobody'];
    const messagePermission = allowedPerms.includes(rawPrivacy.messagePermission)
      ? rawPrivacy.messagePermission
      : 'everyone';
    const privacyJson = JSON.stringify({
      messagePermission,
      showOnline: rawPrivacy.showOnline !== false,
      soundNotifications: rawPrivacy.soundNotifications !== false,
      visualNotifications: rawPrivacy.visualNotifications !== false,
    });
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        ghostMode: Boolean(payload.ghostMode),
        hideLastSeen: Boolean(payload.hideLastSeen),
        privacyJson,
        isPublic: payload.isPublic !== false,
        lastSeen: nowIso,
      },
    });
  }

  if (action === 'likeProfile') {
    const targetUid = String(payload.targetUid || '');
    if (!targetUid || targetUid === callerUid) {
      throw new HttpError(400, 'لا يمكنك الإعجاب بملفك الشخصي.');
    }
    const target = await getRowOrNull(tablesDB, databaseId, tables.users, targetUid);
    if (!target) throw new HttpError(404, 'المستخدم غير موجود.');
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: targetUid,
      data: { likesCount: Number(target.likesCount ?? 0) + 1 },
    });
  }

  if (action === 'recordProfileVisit') {
    const profileUid = String(payload.profileUid || '');
    if (!profileUid || profileUid === callerUid || caller.ghostMode) {
      return { skipped: true };
    }
    const target = await getRowOrNull(tablesDB, databaseId, tables.users, profileUid);
    if (!target) return { skipped: true };

    const visitRowId = deterministicRowId('v', `${profileUid}_${callerUid}`);
    const existingVisit = await getRowOrNull(tablesDB, databaseId, tables.profileVisits, visitRowId);

    await tablesDB.upsertRow({
      databaseId,
      tableId: tables.profileVisits,
      rowId: visitRowId,
      data: {
        profileUid,
        visitorUid: callerUid,
        visitorName: String(caller.displayName || 'عضو'),
        visitorAvatar: String(caller.avatar || ''),
        visitedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(profileUid)), Permission.read(Role.user(callerUid))],
    });

    if (!existingVisit) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: profileUid,
        data: { visitsCount: Number(target.visitsCount ?? 0) + 1 },
      });
    }
    return { ok: true };
  }

  if (action === 'awardActivityXp') {
    if (caller.role === 'guest' || caller.isAnonymous) {
      return caller;
    }
    const safeDelta = Math.min(25, Math.max(1, Math.floor(Number(payload.deltaXp ?? 5))));
    const nextXp = Number(caller.xp ?? 0) + safeDelta;
    const nextLevel = calculateLevelFromXp(nextXp);
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: { xp: nextXp, level: nextLevel, lastSeen: nowIso },
    });
  }

  if (action === 'consumeGuestQuota') {
    if (caller.role !== 'guest' && !caller.isAnonymous) {
      return { allowed: true };
    }
    const settings = await getSiteSettings(tablesDB, databaseId, tables);
    const limit = settings.guestDailyMessageLimit;
    if (limit <= 0) return { allowed: true };
    const today = nowIso.slice(0, 10);
    const sentToday = caller.lastMessageDate === today ? Number(caller.dailyMessagesSent ?? 0) : 0;
    if (sentToday >= limit) {
      throw new HttpError(
        429,
        `وصل حساب الضيف للحد اليومي للرسائل (${limit} رسالة). سجّل حسابًا دائمًا للمتابعة بلا حدود.`
      );
    }
    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: { dailyMessagesSent: sentToday + 1, lastMessageDate: today, lastSeen: nowIso },
    });
    return { allowed: true, remaining: limit - (sentToday + 1) };
  }

  // -------------------------------------------------------------------------
  // 3. Economy: Store Purchases, Gifts, Coin Transfers, Daily Rewards
  // -------------------------------------------------------------------------
  if (action === 'purchaseStoreItem') {
    assertNotGuest(caller);
    const itemId = String(payload.itemId || '');
    if (!itemId) throw new HttpError(400, 'معرف العنصر مطلوب.');

    const dbItem = await getRowOrNull(tablesDB, databaseId, tables.storeItems, itemId);
    const item = dbItem || DEFAULT_STORE_PRICES[itemId];
    if (!item) throw new HttpError(404, 'العنصر غير موجود في المتجر.');
    if (item.isActive === false) throw new HttpError(400, 'هذا العنصر غير متاح حاليًا.');
    if (item.section === 'gift') {
      throw new HttpError(400, 'اختر العضو المستلم لإرسال الهدية من ملفه أو داخل المحادثة.');
    }

    const price = Number(item.priceCoins);
    const currentCoins = Number(caller.coins ?? 0);
    if (currentCoins < price) {
      throw new HttpError(400, `رصيدك غير كافٍ. السعر ${price} عملة.`);
    }

    const updates = {
      coins: currentCoins - price,
      lastSeen: nowIso,
    };
    const durationDays = Number(item.durationDays ?? 0);
    const expiresMs = durationDays > 0 ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : 0;

    if (item.section === 'vip') {
      updates.vipTier = String(item.code || 'silver');
      updates.vipExpiresAt = expiresMs;
    } else if (item.section === 'feature') {
      const features = Array.isArray(caller.unlockedFeatures) ? [...caller.unlockedFeatures] : [];
      if (!features.includes(item.code)) {
        features.push(String(item.code));
      }
      updates.unlockedFeatures = features;
      if (item.code === 'pinName') updates.isNamePinned = true;
      if (item.code === 'ghostMode') updates.ghostMode = true;
      if (item.code === 'hideLastSeen') updates.hideLastSeen = true;
      if (item.code === 'nameColor') updates.nameColor = String(item.color || '#0D7A5F');
    } else if (item.section === 'frame') {
      updates.frameId = String(item.code || 'none');
    } else if (item.section === 'badge') {
      const badges = parseJson(caller.badgesJson, []);
      const newBadge = {
        id: String(item.code),
        name: String(item.name),
        color: String(item.color || '#0D7A5F'),
        imageUrl: String(item.imageUrl || ''),
        expiresAt: expiresMs > 0 ? expiresMs : null,
      };
      const nextBadges = [...badges.filter((b) => b.id !== item.code), newBadge];
      updates.badgesJson = JSON.stringify(nextBadges);
    }

    const updatedUser = await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: updates,
    });

    await logCoinTx(ctx, {
      type: 'purchase',
      senderId: callerUid,
      recipientId: 'system',
      amount: price,
      recipientAmount: 0,
      note: `شراء ${item.name}`,
    });

    await createNotification(ctx, {
      recipientId: callerUid,
      senderId: callerUid,
      type: 'coins',
      title: 'تمت عملية الشراء',
      body: `تم تفعيل ${item.name} بنجاح.`,
    });

    return updatedUser;
  }

  if (action === 'sendGift') {
    assertNotGuest(caller);
    const recipientId = String(payload.recipientId || '');
    const giftId = String(payload.giftId || '');
    const alsoInChat = payload.alsoInChat !== false;
    if (!recipientId || recipientId === callerUid) {
      throw new HttpError(400, 'لا يمكنك إهداء نفسك.');
    }

    const dbGift = await getRowOrNull(tablesDB, databaseId, tables.storeItems, giftId);
    const gift = dbGift || DEFAULT_STORE_PRICES[giftId];
    if (!gift || gift.section !== 'gift' || gift.isActive === false) {
      throw new HttpError(404, 'الهدية المطلوبة غير متاحة.');
    }

    const recipient = await getRowOrNull(tablesDB, databaseId, tables.users, recipientId);
    if (!recipient) throw new HttpError(404, 'العضو المستلم غير موجود.');

    const senderShare = Number(gift.priceCoins);
    const recipientBonus = Math.floor(senderShare * 0.5);
    const sCoins = Number(caller.coins ?? 0);
    if (sCoins < senderShare) {
      throw new HttpError(400, `رصيدك غير كافٍ لإرسال ${gift.name} (${senderShare} عملة).`);
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        coins: sCoins - senderShare,
        giftsSentCount: Number(caller.giftsSentCount ?? 0) + 1,
        lastSeen: nowIso,
      },
    });

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: recipientId,
      data: {
        coins: Number(recipient.coins ?? 0) + recipientBonus,
        giftsReceivedCount: Number(recipient.giftsReceivedCount ?? 0) + 1,
      },
    });

    await logCoinTx(ctx, {
      type: 'gift',
      senderId: callerUid,
      recipientId,
      amount: senderShare,
      recipientAmount: recipientBonus,
      note: `هدية: ${gift.name}`,
    });

    if (alsoInChat) {
      const [partA, partB] = getSortedParticipants(callerUid, recipientId);
      const convKey = `${partA}_${partB}`;
      const convRowId = deterministicRowId('c', convKey);
      const existingConv = await getRowOrNull(tablesDB, databaseId, tables.conversations, convRowId);
      const isSenderA = callerUid === partA;
      const preview = `أرسل لك هدية: ${gift.name} (${senderShare} عملة)`;

      const convPerms = [
        Permission.read(Role.user(partA)),
        Permission.read(Role.user(partB)),
        Permission.update(Role.user(partA)),
        Permission.update(Role.user(partB)),
      ];

      if (!existingConv) {
        await tablesDB.createRow({
          databaseId,
          tableId: tables.conversations,
          rowId: convRowId,
          data: {
            pairKey: convKey,
            participantA: partA,
            participantB: partB,
            participantIds: [partA, partB],
            lastMessageText: preview.slice(0, 200),
            lastMessageSenderId: callerUid,
            lastMessageStatus: 'sent',
            lastMessageAt: nowIso,
            unreadCountA: isSenderA ? 0 : 1,
            unreadCountB: isSenderA ? 1 : 0,
            theme: 'emerald',
            pinnedMessageId: '',
            pinnedMessageText: '',
            archivedBy: [],
            clearedAtA: 0,
            clearedAtB: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          permissions: convPerms,
        });
      } else {
        await tablesDB.updateRow({
          databaseId,
          tableId: tables.conversations,
          rowId: convRowId,
          data: {
            lastMessageText: preview.slice(0, 200),
            lastMessageSenderId: callerUid,
            lastMessageStatus: 'sent',
            lastMessageAt: nowIso,
            unreadCountA: isSenderA ? Number(existingConv.unreadCountA ?? 0) : Number(existingConv.unreadCountA ?? 0) + 1,
            unreadCountB: isSenderA ? Number(existingConv.unreadCountB ?? 0) + 1 : Number(existingConv.unreadCountB ?? 0),
            updatedAt: nowIso,
          },
        });
      }

      await tablesDB.createRow({
        databaseId,
        tableId: tables.messages,
        rowId: ID.unique(),
        data: {
          conversationId: convRowId,
          senderId: callerUid,
          recipientId,
          participantIds: [partA, partB],
          type: 'gift',
          text: preview,
          mediaUrl: String(gift.imageUrl || '').slice(0, 800),
          replyToId: '',
          replyToText: '',
          reactionsJson: '{}',
          isWhisper: false,
          whisperRevealed: false,
          expiresAt: 0,
          isDeleted: false,
          editedAt: '',
          status: 'sent',
          createdAt: nowIso,
          seenAt: '',
        },
        permissions: [
          Permission.read(Role.user(partA)),
          Permission.read(Role.user(partB)),
          Permission.update(Role.user(partA)),
          Permission.update(Role.user(partB)),
        ],
      });
    }

    await createNotification(ctx, {
      recipientId,
      senderId: callerUid,
      type: 'gift',
      title: 'هدية جديدة!',
      body: `أرسل لك ${caller.displayName} هدية ${gift.name} وحصلت على ${recipientBonus} عملة.`,
    });

    return { ok: true, senderShare, recipientBonus };
  }

  if (action === 'transferCoins') {
    assertNotGuest(caller);
    const recipientId = String(payload.recipientId || '');
    const cleanAmount = Math.floor(Number(payload.amount ?? 0));
    if (!recipientId || recipientId === callerUid) {
      throw new HttpError(400, 'لا يمكنك التحويل لنفسك.');
    }
    if (!Number.isInteger(cleanAmount) || cleanAmount < 10 || cleanAmount > 1_000_000) {
      throw new HttpError(400, 'الحد الأدنى للتحويل 10 عملات ومبلغ صحيح.');
    }
    const recipient = await getRowOrNull(tablesDB, databaseId, tables.users, recipientId);
    if (!recipient) throw new HttpError(404, 'المستخدم المستلم غير موجود.');

    const sCoins = Number(caller.coins ?? 0);
    if (sCoins < cleanAmount) {
      throw new HttpError(400, 'رصيد العملات غير كافٍ.');
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: { coins: sCoins - cleanAmount, lastSeen: nowIso },
    });

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: recipientId,
      data: { coins: Number(recipient.coins ?? 0) + cleanAmount },
    });

    await logCoinTx(ctx, {
      type: 'transfer',
      senderId: callerUid,
      recipientId,
      amount: cleanAmount,
      recipientAmount: cleanAmount,
      note: `تحويل من ${caller.displayName}`,
    });

    await createNotification(ctx, {
      recipientId,
      senderId: callerUid,
      type: 'coins',
      title: 'استلمت عملات',
      body: `حوّل لك ${caller.displayName} مبلغ ${cleanAmount} عملة.`,
    });

    return { ok: true, amount: cleanAmount };
  }

  if (action === 'recordDailyTaskActivity') {
    assertNotGuest(caller);
    const kind = String(payload.kind || '');
    if (kind !== 'share' && kind !== 'ad_watch') {
      throw new HttpError(400, 'نوع النشاط اليومي غير صالح.');
    }
    const dateKey = nowIso.slice(0, 10);
    const existingPrivate = await getRowOrNull(tablesDB, databaseId, tables.userPrivate, callerUid);
    const prevAct = parseJson(existingPrivate?.dailyActivityJson, {});
    const nextAct = {
      dateKey,
      shared: prevAct?.dateKey === dateKey ? Boolean(prevAct.shared) : false,
      watchedAd: prevAct?.dateKey === dateKey ? Boolean(prevAct.watchedAd) : false,
    };
    if (kind === 'share') nextAct.shared = true;
    if (kind === 'ad_watch') nextAct.watchedAd = true;

    await tablesDB.upsertRow({
      databaseId,
      tableId: tables.userPrivate,
      rowId: callerUid,
      data: {
        uid: callerUid,
        email: String(existingPrivate?.email || ''),
        provider: String(existingPrivate?.provider || 'account'),
        dailyActivityJson: JSON.stringify(nextAct),
        referredBy: String(existingPrivate?.referredBy || ''),
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid))],
    });

    return { ok: true, activity: nextAct };
  }

  if (action === 'getDailyTaskProgress') {
    if (caller.role === 'guest' || caller.isAnonymous) {
      return { dateKey: nowIso.slice(0, 10), completedByKey: {}, claimedByKey: {} };
    }
    const dateKey = nowIso.slice(0, 10);
    const keys = ['checkin', 'engage', 'send_image', 'join_room', 'use_microphone', 'share', 'ad_watch', 'referral', 'daily_wheel'];
    const completedByKey = {};
    const claimedByKey = {};

    await Promise.all(
      keys.map(async (k) => {
        const [comp, claimRow] = await Promise.all([
          checkDailyTaskCompletion(ctx, caller, k, {}, dateKey),
          getRowOrNull(
            tablesDB,
            databaseId,
            tables.dailyClaims,
            deterministicRowId('d', `${callerUid}_${dateKey}_${k}`)
          ),
        ]);
        completedByKey[k] = Boolean(comp.completed);
        claimedByKey[k] = Boolean(claimRow);
      })
    );

    return { dateKey, completedByKey, claimedByKey };
  }

  if (action === 'claimDailyReward') {
    assertNotGuest(caller);
    const rawKey = String(payload.taskKey || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!rawKey) throw new HttpError(400, 'مفتاح المهمة غير صالح.');

    const dateKey = nowIso.slice(0, 10);
    const claimRowId = deterministicRowId('d', `${callerUid}_${dateKey}_${rawKey}`);
    const existingClaim = await getRowOrNull(tablesDB, databaseId, tables.dailyClaims, claimRowId);
    if (existingClaim) {
      throw new HttpError(409, 'تم استلام هذه المكافأة اليوم بالفعل.');
    }

    let safeCoins = 0;
    let safeXp = 0;
    let wheelIndex;

    if (rawKey === 'daily_wheel') {
      wheelIndex = Math.floor(Math.random() * WHEEL_REWARDS.length);
      const segment = WHEEL_REWARDS[wheelIndex];
      safeCoins = segment.coins;
      safeXp = segment.xp;
    } else {
      const dbTask = await getRowOrNull(tablesDB, databaseId, tables.dailyTasks, `task_${rawKey}`);
      const task = dbTask || DEFAULT_TASK_MAP[rawKey];
      if (!task || task.isActive === false) {
        throw new HttpError(404, 'المهمة اليومية غير متاحة حاليًا.');
      }

      const verification = await checkDailyTaskCompletion(ctx, caller, rawKey, payload, dateKey);
      if (!verification.completed) {
        throw new HttpError(400, 'لم تكتمل المهمة بعد. نفّذ المطلوب أولاً ثم استلم المكافأة.');
      }

      if (rawKey === 'referral' && verification.referrerUid) {
        const existingPrivate = await getRowOrNull(tablesDB, databaseId, tables.userPrivate, callerUid);
        if (!existingPrivate?.referredBy) {
          await tablesDB.upsertRow({
            databaseId,
            tableId: tables.userPrivate,
            rowId: callerUid,
            data: {
              uid: callerUid,
              email: String(existingPrivate?.email || ''),
              provider: String(existingPrivate?.provider || 'account'),
              dailyActivityJson: String(existingPrivate?.dailyActivityJson || '{}'),
              referredBy: verification.referrerUid,
              updatedAt: nowIso,
            },
            permissions: [Permission.read(Role.user(callerUid))],
          });
        }
      }

      safeCoins = Math.min(250, Math.max(0, Math.floor(Number(task.rewardCoins ?? 0))));
      safeXp = Math.min(300, Math.max(0, Math.floor(Number(task.rewardXp ?? 0))));
    }

    await tablesDB.createRow({
      databaseId,
      tableId: tables.dailyClaims,
      rowId: claimRowId,
      data: {
        claimKey: `${callerUid}_${dateKey}_${rawKey}`,
        uid: callerUid,
        dateKey,
        taskKey: rawKey,
        rewardCoins: safeCoins,
        rewardXp: safeXp,
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid))],
    });

    const nextXp = Number(caller.xp ?? 0) + safeXp;
    const nextLevel = calculateLevelFromXp(nextXp);

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        coins: Number(caller.coins ?? 0) + safeCoins,
        xp: nextXp,
        level: nextLevel,
        lastClaimKey: `${dateKey}_${rawKey}`,
        lastSeen: nowIso,
      },
    });

    await logCoinTx(ctx, {
      type: 'reward',
      senderId: 'system',
      recipientId: callerUid,
      amount: safeCoins,
      recipientAmount: safeCoins,
      note: rawKey === 'daily_wheel' ? 'عجلة الحظ اليومية' : `مهمة يومية: ${rawKey}`,
    });

    await createNotification(ctx, {
      recipientId: callerUid,
      senderId: callerUid,
      type: 'reward',
      title: 'مكافأة يومية!',
      body: `حصلت على +${safeCoins} عملة و +${safeXp} XP.`,
    });

    return {
      ok: true,
      rewardCoins: safeCoins,
      rewardXp: safeXp,
      ...(wheelIndex !== undefined ? { wheelIndex } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // 4. Paid Social: Shoutouts, Rooms, Random Match, Friends, Marriage
  // -------------------------------------------------------------------------
  if (action === 'postShoutout') {
    assertNotGuest(caller);
    const clean = String(payload.text || '').trim();
    if (!clean || clean.length > 240) {
      throw new HttpError(400, 'نص الإعلان غير صالح (يجب أن يكون بين 1 و240 حرفًا).');
    }
    const kind = payload.kind === 'admin' || payload.kind === 'urgent' ? payload.kind : 'user';
    const isStaff = caller.role === 'owner' || caller.role === 'moderator';
    if (kind !== 'user' && !isStaff) {
      throw new HttpError(403, 'صلاحيات الإدارة مطلوبة لإرسال إعلان إداري.');
    }

    const settings = await getSiteSettings(tablesDB, databaseId, tables);
    const hasFreePerms = Array.isArray(caller.permissions) && caller.permissions.includes('shoutout_free');
    const actualCost = kind === 'user' && !isStaff && !hasFreePerms ? settings.shoutoutCost : 0;
    const currentCoins = Number(caller.coins ?? 0);
    if (actualCost > 0 && currentCoins < actualCost) {
      throw new HttpError(400, `تحتاج إلى ${actualCost} عملة لإرسال نداء في الميكروفون.`);
    }

    if (actualCost > 0) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: { coins: currentCoins - actualCost, lastSeen: nowIso },
      });
      await logCoinTx(ctx, {
        type: 'megaphone',
        senderId: callerUid,
        recipientId: 'system',
        amount: actualCost,
        recipientAmount: 0,
        note: 'نداء الميكروفون العلوي',
      });
    }

    return await tablesDB.createRow({
      databaseId,
      tableId: tables.shoutouts,
      rowId: ID.unique(),
      data: {
        authorId: callerUid,
        authorName: String(caller.displayName || 'عضو'),
        kind,
        text: clean,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000,
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.users())],
    });
  }

  if (action === 'createMemberRoom') {
    assertNotGuest(caller);
    const name = String(payload.name || '').trim();
    if (name.length < 2 || name.length > 80) {
      throw new HttpError(400, 'اسم الغرفة غير صالح.');
    }
    const settings = await getSiteSettings(tablesDB, databaseId, tables);
    const cost = settings.roomCreationCost;
    const coins = Number(caller.coins ?? 0);
    if (coins < cost) {
      throw new HttpError(400, `تحتاج إلى ${cost} عملة لإنشاء غرفة جديدة.`);
    }

    if (cost > 0) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: { coins: coins - cost, lastSeen: nowIso },
      });
      await logCoinTx(ctx, {
        type: 'room',
        senderId: callerUid,
        recipientId: 'system',
        amount: cost,
        recipientAmount: 0,
        note: `إنشاء غرفة: ${name}`,
      });
    }

    const room = await tablesDB.createRow({
      databaseId,
      tableId: tables.rooms,
      rowId: ID.unique(),
      data: {
        name,
        description: String(payload.description || '').trim().slice(0, 240),
        category: String(payload.category || 'عام').trim().slice(0, 40) || 'عام',
        isOfficial: false,
        ownerId: callerUid,
        ownerName: String(caller.displayName || 'عضو'),
        theme: String(payload.theme || 'emerald').slice(0, 32),
        pinnedMessage: `مرحبًا بكم في غرفة ${name}`,
        memberIds: [callerUid],
        activeCount: 1,
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.users()), Permission.update(Role.users())],
    });

    return { roomId: room.$id };
  }

  if (action === 'joinRoom') {
    const roomId = String(payload.roomId || '').trim();
    if (!roomId) throw new HttpError(400, 'معرف الغرفة مطلوب.');
    const room = await getRowOrNull(tablesDB, databaseId, tables.rooms, roomId);
    if (!room) throw new HttpError(404, 'الغرفة غير موجودة.');
    const members = Array.isArray(room.memberIds) ? room.memberIds.map(String) : [];
    if (!members.includes(callerUid)) {
      const updated = [...members, callerUid];
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.rooms,
        rowId: roomId,
        data: { memberIds: updated, activeCount: updated.length },
      });
      return { ok: true, activeCount: updated.length };
    }
    return { ok: true, activeCount: members.length };
  }

  if (action === 'leaveRoom') {
    const roomId = String(payload.roomId || '').trim();
    if (!roomId) throw new HttpError(400, 'معرف الغرفة مطلوب.');
    const room = await getRowOrNull(tablesDB, databaseId, tables.rooms, roomId);
    if (!room) return { ok: true, activeCount: 0 };
    const members = Array.isArray(room.memberIds) ? room.memberIds.map(String) : [];
    if (members.includes(callerUid)) {
      const updated = members.filter((id) => id !== callerUid);
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.rooms,
        rowId: roomId,
        data: { memberIds: updated, activeCount: updated.length },
      });
      return { ok: true, activeCount: updated.length };
    }
    return { ok: true, activeCount: members.length };
  }

  if (action === 'updateRoomMeta') {
    const roomId = String(payload.roomId || '').trim();
    if (!roomId) throw new HttpError(400, 'معرف الغرفة مطلوب.');
    const room = await getRowOrNull(tablesDB, databaseId, tables.rooms, roomId);
    if (!room) throw new HttpError(404, 'الغرفة غير موجودة.');
    const isStaff = caller.role === 'owner' || caller.role === 'moderator';
    if (room.ownerId !== callerUid && !isStaff) {
      throw new HttpError(403, 'غير مصرح لك بتعديل إعدادات هذه الغرفة.');
    }
    const updates = {};
    if (payload.pinnedMessage !== undefined) {
      updates.pinnedMessage = String(payload.pinnedMessage || '').trim().slice(0, 300);
    }
    if (payload.theme !== undefined) {
      const cleanTheme = String(payload.theme || '').trim().slice(0, 32);
      if (cleanTheme) updates.theme = cleanTheme;
    }
    if (Object.keys(updates).length > 0) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.rooms,
        rowId: roomId,
        data: updates,
      });
    }
    return { ok: true };
  }

  if (action === 'joinRandomMatch') {
    const mode = ['text', 'voice', 'video'].includes(payload.mode) ? payload.mode : 'text';
    const preferredGender = ['all', 'male', 'female'].includes(payload.preferredGender)
      ? payload.preferredGender
      : 'all';
    const preferredCountry = String(payload.preferredCountry || '').slice(0, 60);

    const settings = await getSiteSettings(tablesDB, databaseId, tables);
    const today = nowIso.slice(0, 10);
    const usedToday = caller.lastMatchDate === today ? Number(caller.freeMatchesUsedToday ?? 0) : 0;
    const needsPaid = usedToday >= settings.randomMatchFreeDaily;
    const currentCoins = Number(caller.coins ?? 0);

    if (needsPaid && currentCoins < settings.randomMatchCost) {
      throw new HttpError(
        400,
        `انتهت محاولاتك المجانية اليوم (${settings.randomMatchFreeDaily}). تحتاج ${settings.randomMatchCost} عملة للمطابقة.`
      );
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: {
        freeMatchesUsedToday: usedToday + 1,
        lastMatchDate: today,
        coins: needsPaid ? currentCoins - settings.randomMatchCost : currentCoins,
        lastSeen: nowIso,
      },
    });

    if (needsPaid && settings.randomMatchCost > 0) {
      await logCoinTx(ctx, {
        type: 'match',
        senderId: callerUid,
        recipientId: 'system',
        amount: settings.randomMatchCost,
        recipientAmount: 0,
        note: 'جلسة مطابقة عشوائية',
      });
    }

    const waiting = await tablesDB.listRows({
      databaseId,
      tableId: tables.matchQueue,
      queries: [Query.equal('status', 'waiting'), Query.limit(40)],
    });

    const staleCutoff = Date.now() - 5 * 60 * 1000;
    const candidate = waiting.rows.find((entry) => {
      const uid = String(entry.uid || entry.$id);
      if (uid === callerUid) return false;
      if (entry.mode !== mode) return false;
      const createdMs = Date.parse(String(entry.createdAt || entry.$createdAt || ''));
      if (Number.isFinite(createdMs) && createdMs < staleCutoff) return false;
      const iAccept =
        (preferredGender === 'all' || entry.gender === preferredGender) &&
        (!preferredCountry || entry.country === preferredCountry);
      const theyAccept =
        (entry.preferredGender === 'all' || caller.gender === entry.preferredGender) &&
        (!entry.preferredCountry || caller.country === entry.preferredCountry);
      return iAccept && theyAccept;
    });

    if (candidate) {
      const candidateUid = String(candidate.uid || candidate.$id);
      const pair = getSortedParticipants(callerUid, candidateUid);
      const session = await tablesDB.createRow({
        databaseId,
        tableId: tables.matchSessions,
        rowId: ID.unique(),
        data: {
          participantIds: pair,
          mode,
          status: 'active',
          endsAt: Date.now() + settings.randomMatchDurationSec * 1000,
          offerJson: '',
          answerJson: '',
          createdAt: nowIso,
        },
        permissions: [
          Permission.read(Role.user(pair[0])),
          Permission.read(Role.user(pair[1])),
          Permission.update(Role.user(pair[0])),
          Permission.update(Role.user(pair[1])),
        ],
      });

      await tablesDB.updateRow({
        databaseId,
        tableId: tables.matchQueue,
        rowId: candidate.$id,
        data: { status: 'matched', sessionId: session.$id },
      });

      return { matchedSessionId: session.$id };
    }

    await tablesDB.upsertRow({
      databaseId,
      tableId: tables.matchQueue,
      rowId: callerUid,
      data: {
        uid: callerUid,
        displayName: String(caller.displayName || 'عضو'),
        gender: String(caller.gender || 'unspecified'),
        country: String(caller.country || ''),
        mode,
        preferredGender,
        preferredCountry,
        status: 'waiting',
        sessionId: '',
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.users()), Permission.delete(Role.user(callerUid))],
    });

    return { matchedSessionId: null };
  }

  // Relationships
  if (action === 'sendFriendRequest') {
    const targetUid = String(payload.targetUid || '');
    if (!targetUid || targetUid === callerUid) throw new HttpError(400, 'طلب غير صالح.');
    const target = await getRowOrNull(tablesDB, databaseId, tables.users, targetUid);
    if (!target) throw new HttpError(404, 'المستخدم غير موجود.');

    const pair = getSortedParticipants(callerUid, targetUid);
    const relRowId = deterministicRowId('r', `${pair[0]}_${pair[1]}`);
    const existing = await getRowOrNull(tablesDB, databaseId, tables.relationships, relRowId);
    if (existing && existing.status === 'accepted') {
      throw new HttpError(409, 'أنتما أصدقاء بالفعل.');
    }

    await tablesDB.upsertRow({
      databaseId,
      tableId: tables.relationships,
      rowId: relRowId,
      data: {
        pairKey: `${pair[0]}_${pair[1]}`,
        requesterId: callerUid,
        recipientId: targetUid,
        participantIds: pair,
        status: 'pending',
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(pair[0])), Permission.read(Role.user(pair[1]))],
    });

    await createNotification(ctx, {
      recipientId: targetUid,
      senderId: callerUid,
      type: 'friend_request',
      title: 'طلب صداقة جديد',
      body: `أرسل لك ${caller.displayName} طلب صداقة.`,
    });

    return { ok: true };
  }

  if (action === 'respondFriendRequest') {
    const relationshipId = String(payload.relationshipId || '');
    const accept = Boolean(payload.accept);
    const rel = await getRowOrNull(tablesDB, databaseId, tables.relationships, relationshipId);
    if (!rel) throw new HttpError(404, 'طلب الصداقة غير موجود.');
    if (rel.recipientId !== callerUid || rel.status !== 'pending') {
      throw new HttpError(403, 'غير مصرح لك بالرد على هذا الطلب.');
    }

    if (!accept) {
      await tablesDB.deleteRow({ databaseId, tableId: tables.relationships, rowId: rel.$id });
      return { ok: true, accepted: false };
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.relationships,
      rowId: rel.$id,
      data: { status: 'accepted', updatedAt: nowIso },
    });

    const requester = await getRowOrNull(tablesDB, databaseId, tables.users, String(rel.requesterId));
    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: { friendsCount: Number(caller.friendsCount ?? 0) + 1 },
    });
    if (requester) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: requester.$id,
        data: { friendsCount: Number(requester.friendsCount ?? 0) + 1 },
      });
    }

    await createNotification(ctx, {
      recipientId: String(rel.requesterId),
      senderId: callerUid,
      type: 'friend_request',
      title: 'تم قبول طلب الصداقة',
      body: 'أصبحتما أصدقاء الآن!',
    });

    return { ok: true, accepted: true };
  }

  if (action === 'removeFriend') {
    const relationshipId = String(payload.relationshipId || '');
    const rel = await getRowOrNull(tablesDB, databaseId, tables.relationships, relationshipId);
    if (!rel) return { ok: true };
    const participants = Array.isArray(rel.participantIds) ? rel.participantIds : [];
    if (!participants.includes(callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بإزالة هذه الصداقة.');
    }
    const wasAccepted = rel.status === 'accepted';
    await tablesDB.deleteRow({ databaseId, tableId: tables.relationships, rowId: rel.$id });
    if (wasAccepted) {
      const peerUid = participants.find((id) => id !== callerUid);
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: { friendsCount: Math.max(0, Number(caller.friendsCount ?? 1) - 1) },
      });
      if (peerUid) {
        const peer = await getRowOrNull(tablesDB, databaseId, tables.users, String(peerUid));
        if (peer) {
          await tablesDB.updateRow({
            databaseId,
            tableId: tables.users,
            rowId: peer.$id,
            data: { friendsCount: Math.max(0, Number(peer.friendsCount ?? 1) - 1) },
          });
        }
      }
    }
    return { ok: true };
  }

  // Marriages
  if (action === 'proposeMarriage') {
    assertNotGuest(caller);
    const partnerId = String(payload.partnerId || '');
    const cleanDowry = Math.floor(Number(payload.dowry ?? 0));
    const message = String(payload.message || '').trim().slice(0, 300);

    if (!partnerId || partnerId === callerUid) throw new HttpError(400, 'طلب غير صالح.');
    if (caller.maritalStatus === 'married') throw new HttpError(400, 'أنت متزوج بالفعل.');
    if (!Number.isInteger(cleanDowry) || cleanDowry < 50 || cleanDowry > 1_000_000) {
      throw new HttpError(400, 'الحد الأدنى للمهر 50 عملة.');
    }

    const partner = await getRowOrNull(tablesDB, databaseId, tables.users, partnerId);
    if (!partner) throw new HttpError(404, 'الطرف الآخر غير موجود.');
    if (partner.maritalStatus === 'married') throw new HttpError(400, 'هذا العضو متزوج بالفعل.');

    const currentCoins = Number(caller.coins ?? 0);
    if (currentCoins < cleanDowry) throw new HttpError(400, 'رصيدك غير كافٍ لدفع المهر.');

    const settings = await getSiteSettings(tablesDB, databaseId, tables);
    const siteFee = Math.floor((cleanDowry * settings.marriageSiteFeePercent) / 100);
    const wifeShare = cleanDowry - siteFee;
    const pair = getSortedParticipants(callerUid, partnerId);
    const marriageRowId = deterministicRowId('m', `${pair[0]}_${pair[1]}`);
    const existing = await getRowOrNull(tablesDB, databaseId, tables.marriages, marriageRowId);

    if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
      throw new HttpError(409, 'يوجد طلب زواج أو عقد قائم بالفعل بينكما.');
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: callerUid,
      data: { coins: currentCoins - cleanDowry, lastSeen: nowIso },
    });

    await tablesDB.upsertRow({
      databaseId,
      tableId: tables.marriages,
      rowId: marriageRowId,
      data: {
        pairKey: `${pair[0]}_${pair[1]}`,
        proposerId: callerUid,
        proposerName: String(caller.displayName || 'عضو'),
        partnerId,
        partnerName: String(partner.displayName || 'عضو'),
        participantIds: pair,
        dowry: cleanDowry,
        wifeShare,
        siteFee,
        message,
        status: 'pending',
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(pair[0])), Permission.read(Role.user(pair[1]))],
    });

    await createNotification(ctx, {
      recipientId: partnerId,
      senderId: callerUid,
      type: 'marriage',
      title: 'عرض زواج جديد!',
      body: `تقدم ${caller.displayName} لخطبتك بمهر ${cleanDowry} عملة (نصيبك ${wifeShare} عملة).`,
    });

    return { ok: true };
  }

  if (action === 'respondMarriage') {
    const marriageId = String(payload.marriageId || '');
    const accept = Boolean(payload.accept);
    const m = await getRowOrNull(tablesDB, databaseId, tables.marriages, marriageId);
    if (!m) throw new HttpError(404, 'طلب الزواج غير موجود.');
    if (m.partnerId !== callerUid || m.status !== 'pending') {
      throw new HttpError(403, 'لا يمكنك الرد على هذا الطلب.');
    }

    const proposer = await getRowOrNull(tablesDB, databaseId, tables.users, String(m.proposerId));
    if (!proposer) throw new HttpError(404, 'تعذر العثور على صاحب العرض.');

    if (accept) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.marriages,
        rowId: m.$id,
        data: { status: 'accepted', updatedAt: nowIso },
      });
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: {
          coins: Number(caller.coins ?? 0) + Number(m.wifeShare),
          maritalStatus: 'married',
          partnerUid: String(m.proposerId),
          partnerName: String(m.proposerName),
          lastSeen: nowIso,
        },
      });
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: proposer.$id,
        data: {
          maritalStatus: 'married',
          partnerUid: callerUid,
          partnerName: String(m.partnerName),
        },
      });
      await logCoinTx(ctx, {
        type: 'marriage',
        senderId: String(m.proposerId),
        recipientId: callerUid,
        amount: Number(m.dowry),
        recipientAmount: Number(m.wifeShare),
        note: `مهر زواج من ${m.proposerName}`,
      });
    } else {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.marriages,
        rowId: m.$id,
        data: { status: 'rejected', updatedAt: nowIso },
      });
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: proposer.$id,
        data: { coins: Number(proposer.coins ?? 0) + Number(m.dowry) },
      });
    }

    await createNotification(ctx, {
      recipientId: String(m.proposerId),
      senderId: callerUid,
      type: 'marriage',
      title: accept ? 'مبارك! تم قبول الزواج' : 'تم رفض عرض الزواج',
      body: accept
        ? `قبل ${m.partnerName} عرض الزواج وأصبحتم مرتبطين الآن!`
        : `رفض ${m.partnerName} العرض وتم رد المهر (${m.dowry} عملة).`,
    });

    return { ok: true, accepted: accept };
  }

  if (action === 'divorceMarriage') {
    const marriageId = String(payload.marriageId || '');
    const m = await getRowOrNull(tablesDB, databaseId, tables.marriages, marriageId);
    if (!m) throw new HttpError(404, 'عقد الزواج غير موجود.');
    const participants = Array.isArray(m.participantIds) ? m.participantIds : [];
    if (!participants.includes(callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بإنهاء هذا العقد.');
    }

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.marriages,
      rowId: m.$id,
      data: { status: 'divorced', updatedAt: nowIso },
    });
    await Promise.all([
      tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: String(m.proposerId),
        data: { maritalStatus: 'single', partnerUid: '', partnerName: '' },
      }),
      tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: String(m.partnerId),
        data: { maritalStatus: 'single', partnerUid: '', partnerName: '' },
      }),
    ]);

    const peerId = m.proposerId === callerUid ? String(m.partnerId) : String(m.proposerId);
    await createNotification(ctx, {
      recipientId: peerId,
      senderId: callerUid,
      type: 'marriage',
      title: 'تم الانفصال',
      body: 'تم إنهاء عقد الزواج.',
    });

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // 5. Community Polls, Secrets Empathy, Topup/Reports/Support, Notifications
  // -------------------------------------------------------------------------
  if (action === 'voteOnWallPoll') {
    const postId = String(payload.postId || '');
    const optionId = String(payload.optionId || '');
    const post = await getRowOrNull(tablesDB, databaseId, tables.wallPosts, postId);
    if (!post) throw new HttpError(404, 'المنشور غير موجود.');
    const voters = parseJson(post.pollVotersJson, {});
    if (voters[callerUid]) {
      throw new HttpError(409, 'لقد قمت بالتصويت بالفعل في هذا الاستطلاع.');
    }
    const options = parseJson(post.pollOptionsJson, []);
    if (!options.some((o) => o.id === optionId)) {
      throw new HttpError(400, 'خيار التصويت غير صالح.');
    }
    const nextOptions = options.map((o) =>
      o.id === optionId ? { ...o, votes: Number(o.votes ?? 0) + 1 } : o
    );
    voters[callerUid] = optionId;
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.wallPosts,
      rowId: postId,
      data: {
        pollOptionsJson: JSON.stringify(nextOptions),
        pollVotersJson: JSON.stringify(voters),
      },
    });
  }

  if (action === 'reactEmpathyToSecret') {
    const secretId = String(payload.secretId || '');
    const kind = payload.kind;
    if (!['feel', 'pray', 'strength'].includes(kind)) {
      throw new HttpError(400, 'نوع التفاعل غير صالح.');
    }
    const secret = await getRowOrNull(tablesDB, databaseId, tables.secrets, secretId);
    if (!secret) throw new HttpError(404, 'الاعتراف غير موجود.');
    const usersList = Array.isArray(secret.empathyUsers) ? [...secret.empathyUsers] : [];
    const key = `${callerUid}_${kind}`;
    if (usersList.includes(key)) return secret;

    const counts = parseJson(secret.empathyCountsJson, { feel: 0, pray: 0, strength: 0 });
    counts[kind] = Number(counts[kind] ?? 0) + 1;
    usersList.push(key);
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.secrets,
      rowId: secretId,
      data: {
        empathyCountsJson: JSON.stringify(counts),
        empathyUsers: usersList,
      },
    });
  }

  if (action === 'submitTopupRequest') {
    assertNotGuest(caller);
    const amount = Math.floor(Number(payload.amount ?? 0));
    const coinsRequested = Math.floor(Number(payload.coinsRequested ?? 0));
    const method = String(payload.method || '').trim().slice(0, 80);
    const reference = String(payload.reference || '').trim().slice(0, 120);
    if (!method || !reference || amount <= 0 || coinsRequested <= 0) {
      throw new HttpError(400, 'يرجى إدخال بيانات طلب الشحن كاملة وصحيحة.');
    }
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.topupRequests,
      rowId: ID.unique(),
      data: {
        userId: callerUid,
        userName: String(caller.displayName || 'عضو'),
        method,
        amount,
        coinsRequested,
        reference,
        status: 'pending',
        adminNote: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid)), Permission.read(Role.label('staff'))],
    });
  }

  if (action === 'submitReport') {
    const targetUid = String(payload.targetUid || '');
    const targetName = String(payload.targetName || '').slice(0, 80);
    const reason = String(payload.reason || '').trim().slice(0, 100);
    const details = String(payload.details || '').trim().slice(0, 1000);
    if (!targetUid || !reason) throw new HttpError(400, 'بيانات البلاغ غير مكتملة.');
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.reports,
      rowId: ID.unique(),
      data: {
        reporterId: callerUid,
        targetUid,
        targetName,
        reason,
        details,
        status: 'open',
        adminNote: '',
        createdAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid)), Permission.read(Role.label('staff'))],
    });
  }

  if (action === 'createSupportTicket') {
    const subject = String(payload.subject || '').trim().slice(0, 120);
    const message = String(payload.message || '').trim().slice(0, 1500);
    if (!subject || !message) throw new HttpError(400, 'يرجى إدخال عنوان وتفاصيل المشكلة.');
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.supportTickets,
      rowId: ID.unique(),
      data: {
        userId: callerUid,
        userName: String(caller.displayName || 'عضو'),
        subject,
        message,
        adminReply: '',
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.user(callerUid)), Permission.read(Role.label('staff'))],
    });
  }

  if (action === 'markNotificationsRead') {
    const unread = await tablesDB.listRows({
      databaseId,
      tableId: tables.notifications,
      queries: [
        Query.equal('recipientId', callerUid),
        Query.equal('isRead', false),
        Query.limit(100),
      ],
    });
    await Promise.all(
      unread.rows.map((n) =>
        tablesDB.updateRow({
          databaseId,
          tableId: tables.notifications,
          rowId: n.$id,
          data: { isRead: true },
        })
      )
    );
    return { updated: unread.rows.length };
  }

  if (action === 'pushNotification') {
    const recipientId = String(payload.recipientId || '');
    if (!recipientId) throw new HttpError(400, 'المستلم مطلوب.');
    await createNotification(ctx, {
      recipientId,
      senderId: callerUid,
      type: String(payload.type || 'announcement'),
      title: String(payload.title || 'إشعار جديد'),
      body: String(payload.body || ''),
    });
    return { ok: true };
  }

  if (action === 'sendPrivateMessage') {
    if (caller.isBanned) {
      throw new HttpError(403, 'حسابك محظور حاليًا ولا يمكنك إرسال الرسائل.');
    }
    const recipientId = String(payload.recipientId || '').trim();
    if (!recipientId || recipientId === callerUid) {
      throw new HttpError(400, 'لا يمكنك إرسال رسالة لنفسك.');
    }
    const recipient = await getRowOrNull(tablesDB, databaseId, tables.users, recipientId);
    if (!recipient) {
      throw new HttpError(404, 'المستخدم المستلم غير موجود.');
    }

    const callerLabels = Array.isArray(caller.permissions) ? caller.permissions : [];
    const isStaff = caller.role === 'owner' || caller.role === 'admin' || caller.role === 'moderator' || callerLabels.includes('*');
    if (!isStaff) {
      const privacy = parseJson(recipient.privacyJson, {});
      const msgPerm = String(privacy.messagePermission || 'everyone');
      if (msgPerm === 'nobody') {
        throw new HttpError(403, 'أغلق هذا العضو استقبال الرسائل الخاصة في إعدادات الخصوصية.');
      }
      if (msgPerm === 'friends') {
        const [p1, p2] = getSortedParticipants(callerUid, recipientId);
        const relId = deterministicRowId('r', `${p1}_${p2}`);
        const rel = await getRowOrNull(tablesDB, databaseId, tables.relationships, relId);
        if (!rel || rel.status !== 'accepted') {
          throw new HttpError(403, 'يسمح هذا العضو باستقبال الرسائل الخاصة من الأصدقاء فقط.');
        }
      }
    }

    if (caller.role === 'guest') {
      const settings = await getSiteSettings(tablesDB, databaseId, tables);
      const todayKey = new Date().toISOString().slice(0, 10);
      const prevDate = String(caller.lastMessageDate || '');
      const usedToday = prevDate === todayKey ? Number(caller.dailyMessagesSent ?? 0) : 0;
      if (usedToday >= settings.guestDailyMessageLimit) {
        throw new HttpError(403, `وصلت للحد اليومي للزوار (${settings.guestDailyMessageLimit} رسالة). حوّل حسابك إلى عضو دائم للمراسلة بلا حدود.`);
      }
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: {
          dailyMessagesSent: usedToday + 1,
          lastMessageDate: todayKey,
        },
      });
    }

    const rawText = String(payload.text || '').trim();
    if (rawText.length < 1 || rawText.length > 1500) {
      throw new HttpError(400, 'نص الرسالة يجب أن يكون بين 1 و1500 حرفًا.');
    }

    const allowedTypes = new Set(['text', 'image', 'video', 'voice', 'gif', 'whisper', 'gift', 'contact', 'screenshot_alert']);
    const isWhisper = Boolean(payload.isWhisper);
    const reqType = String(payload.type || 'text');
    const msgType = isWhisper ? 'whisper' : allowedTypes.has(reqType) ? reqType : 'text';
    const cleanMediaUrl = safeMediaUrl(payload.mediaUrl);
    const voiceDurationSec = msgType === 'voice'
      ? Math.min(600, Math.max(0, Math.floor(Number(payload.voiceDurationSec ?? 0))))
      : 0;
    const isViewOnce = (msgType === 'image' || msgType === 'video') && Boolean(payload.isViewOnce);

    const previewText = isWhisper
      ? 'رسالة همس سرية'
      : isViewOnce
      ? msgType === 'video'
        ? 'فيديو للمشاهدة مرة واحدة'
        : 'صورة للمشاهدة مرة واحدة'
      : msgType === 'image'
      ? 'صورة'
      : msgType === 'video'
      ? 'مقطع فيديو'
      : msgType === 'voice'
      ? 'رسالة صوتية'
      : msgType === 'gif'
      ? 'ملصق متحرك'
      : msgType === 'screenshot_alert'
      ? 'تنبيه لقطة شاشة'
      : rawText;

    const disappearSec = Number(payload.disappearSeconds || 0);
    const expiresAt = disappearSec > 0 ? Date.now() + Math.min(disappearSec, 86400 * 30) * 1000 : 0;

    const [partA, partB] = getSortedParticipants(callerUid, recipientId);
    const pairKey = `${partA}_${partB}`;
    const convRowId = deterministicRowId('c', pairKey);
    const isSenderA = callerUid === partA;
    const convPerms = [
      Permission.read(Role.user(partA)),
      Permission.read(Role.user(partB)),
      Permission.update(Role.user(partA)),
      Permission.update(Role.user(partB)),
    ];

    const existingConv = await getRowOrNull(tablesDB, databaseId, tables.conversations, convRowId);
    if (!existingConv) {
      await tablesDB.createRow({
        databaseId,
        tableId: tables.conversations,
        rowId: convRowId,
        data: {
          pairKey,
          participantA: partA,
          participantB: partB,
          participantIds: [partA, partB],
          lastMessageText: previewText.slice(0, 200),
          lastMessageSenderId: callerUid,
          lastMessageStatus: 'sent',
          lastMessageAt: nowIso,
          unreadCountA: isSenderA ? 0 : 1,
          unreadCountB: isSenderA ? 1 : 0,
          theme: 'emerald',
          pinnedMessageId: '',
          pinnedMessageText: '',
          archivedBy: [],
          clearedAtA: 0,
          clearedAtB: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        permissions: convPerms,
      });
    } else {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.conversations,
        rowId: convRowId,
        data: {
          lastMessageText: previewText.slice(0, 200),
          lastMessageSenderId: callerUid,
          lastMessageStatus: 'sent',
          lastMessageAt: nowIso,
          unreadCountA: isSenderA ? Number(existingConv.unreadCountA ?? 0) : Number(existingConv.unreadCountA ?? 0) + 1,
          unreadCountB: isSenderA ? Number(existingConv.unreadCountB ?? 0) + 1 : Number(existingConv.unreadCountB ?? 0),
          updatedAt: nowIso,
        },
      });
    }

    const messageRow = await tablesDB.createRow({
      databaseId,
      tableId: tables.messages,
      rowId: ID.unique(),
      data: {
        conversationId: convRowId,
        senderId: callerUid,
        recipientId,
        participantIds: [partA, partB],
        type: msgType,
        text: rawText,
        mediaUrl: cleanMediaUrl,
        replyToId: String(payload.replyToId || '').slice(0, 128),
        replyToText: String(payload.replyToText || '').slice(0, 300),
        reactionsJson: '{}',
        isWhisper,
        whisperRevealed: false,
        expiresAt,
        isDeleted: false,
        editedAt: '',
        voiceDurationSec,
        isViewOnce,
        viewOnceConsumed: false,
        status: 'sent',
        createdAt: nowIso,
        seenAt: '',
      },
      permissions: convPerms,
    });

    return { messageId: messageRow.$id, conversationId: convRowId };
  }

  if (action === 'editPrivateMessage') {
    const messageId = String(payload.messageId || '').trim();
    const newText = String(payload.text || '').trim();
    if (!messageId || !newText || newText.length > 1500) {
      throw new HttpError(400, 'نص الرسالة المعدّلة غير صالح.');
    }
    const msg = await getRowOrNull(tablesDB, databaseId, tables.messages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    if (msg.senderId !== callerUid) {
      throw new HttpError(403, 'لا يمكنك تعديل رسالة عضو آخر.');
    }
    if (msg.isDeleted) {
      throw new HttpError(400, 'لا يمكن تعديل رسالة محذوفة.');
    }
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.messages,
      rowId: messageId,
      data: { text: newText, editedAt: nowIso },
    });
  }

  if (action === 'deletePrivateMessage') {
    const messageId = String(payload.messageId || '').trim();
    if (!messageId) throw new HttpError(400, 'معرف الرسالة مطلوب.');
    const msg = await getRowOrNull(tablesDB, databaseId, tables.messages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    const isStaff = caller.role === 'owner' || caller.role === 'moderator';
    if (msg.senderId !== callerUid && !isStaff) {
      throw new HttpError(403, 'غير مصرح لك بحذف هذه الرسالة.');
    }
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.messages,
      rowId: messageId,
      data: {
        isDeleted: true,
        text: 'تم حذف هذه الرسالة',
        mediaUrl: '',
        isViewOnce: false,
      },
    });
  }

  if (action === 'consumeViewOnceMessage') {
    const messageId = String(payload.messageId || '').trim();
    if (!messageId) throw new HttpError(400, 'معرف الرسالة مطلوب.');
    const msg = await getRowOrNull(tablesDB, databaseId, tables.messages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    if (!msg.isViewOnce) throw new HttpError(400, 'هذه الرسالة ليست للمشاهدة مرة واحدة.');
    if (msg.recipientId !== callerUid && msg.senderId !== callerUid) {
      throw new HttpError(403, 'غير مصرح لك بعرض هذه الوسائط.');
    }
    if (msg.senderId === callerUid) {
      throw new HttpError(403, 'الوسائط ذات المشاهدة الواحدة تفتح لدى المستلم فقط.');
    }
    if (msg.viewOnceConsumed || !msg.mediaUrl) {
      throw new HttpError(410, 'تم فتحها — اختفت بعد المشاهدة.');
    }
    const revealedMediaUrl = String(msg.mediaUrl);
    await tablesDB.updateRow({
      databaseId,
      tableId: tables.messages,
      rowId: messageId,
      data: {
        viewOnceConsumed: true,
        mediaUrl: '',
        text: msg.type === 'video' ? 'تم فتح الفيديو — اختفى بعد المشاهدة' : 'تم فتح الصورة — اختفت بعد المشاهدة',
      },
    });
    return { ok: true, mediaUrl: revealedMediaUrl, type: msg.type, viewOnceConsumed: true };
  }

  if (action === 'sendRoomMessage') {
    const roomId = String(payload.roomId || '').trim();
    const rawText = String(payload.text || '').trim();
    if (!roomId || !rawText || rawText.length > 1200) {
      throw new HttpError(400, 'بيانات رسالة الغرفة غير صالحة.');
    }
    const room = await getRowOrNull(tablesDB, databaseId, tables.rooms, roomId);
    if (!room) throw new HttpError(404, 'الغرفة غير موجودة.');
    const isStaff = caller.role === 'owner' || caller.role === 'moderator';
    const members = Array.isArray(room.memberIds) ? room.memberIds.map(String) : [];
    if (!members.includes(callerUid) && !isStaff) {
      throw new HttpError(403, 'يجب الانضمام إلى الغرفة أولاً لإرسال الرسائل.');
    }
    if (caller.role === 'guest') {
      const settings = await getSiteSettings(tablesDB, databaseId, tables);
      const todayKey = nowIso.slice(0, 10);
      const usedToday = caller.lastMessageDate === todayKey ? Number(caller.dailyMessagesSent ?? 0) : 0;
      if (usedToday >= settings.guestDailyMessageLimit) {
        throw new HttpError(403, `وصلت للحد اليومي للزوار (${settings.guestDailyMessageLimit} رسالة).`);
      }
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: callerUid,
        data: { dailyMessagesSent: usedToday + 1, lastMessageDate: todayKey, lastSeen: nowIso },
      });
    }

    const allowedRoomTypes = new Set(['text', 'image', 'video', 'voice', 'gif']);
    const msgType = allowedRoomTypes.has(String(payload.type || 'text')) ? String(payload.type) : 'text';
    const cleanMediaUrl = safeMediaUrl(payload.mediaUrl);
    const voiceDurationSec = msgType === 'voice'
      ? Math.min(600, Math.max(0, Math.floor(Number(payload.voiceDurationSec ?? 0))))
      : 0;
    const isViewOnce = (msgType === 'image' || msgType === 'video') && Boolean(payload.isViewOnce);

    return await tablesDB.createRow({
      databaseId,
      tableId: tables.roomMessages,
      rowId: ID.unique(),
      data: {
        roomId,
        senderId: callerUid,
        senderName: String(caller.displayName || 'عضو'),
        senderAvatar: String(caller.avatar || ''),
        senderVip: String(caller.vipTier || 'none'),
        type: msgType,
        text: rawText,
        mediaUrl: cleanMediaUrl,
        replyToId: String(payload.replyToId || '').slice(0, 128),
        replyToText: String(payload.replyToText || '').slice(0, 300),
        reactionsJson: '{}',
        editedAt: '',
        isDeleted: false,
        voiceDurationSec,
        isViewOnce,
        viewOnceViewedBy: [],
        createdAt: nowIso,
      },
      permissions: [
        Permission.read(Role.users()),
        Permission.update(Role.user(callerUid)),
        Permission.delete(Role.user(callerUid)),
      ],
    });
  }

  if (action === 'editRoomMessage') {
    const messageId = String(payload.messageId || '').trim();
    const newText = String(payload.text || '').trim();
    if (!messageId || !newText || newText.length > 1200) {
      throw new HttpError(400, 'نص الرسالة المعدّلة غير صالح.');
    }
    const msg = await getRowOrNull(tablesDB, databaseId, tables.roomMessages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    if (msg.senderId !== callerUid) {
      throw new HttpError(403, 'لا يمكنك تعديل رسالة عضو آخر.');
    }
    if (msg.isDeleted) {
      throw new HttpError(400, 'لا يمكن تعديل رسالة محذوفة.');
    }
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.roomMessages,
      rowId: messageId,
      data: { text: newText, editedAt: nowIso },
    });
  }

  if (action === 'deleteRoomMessage') {
    const messageId = String(payload.messageId || '').trim();
    if (!messageId) throw new HttpError(400, 'معرف الرسالة مطلوب.');
    const msg = await getRowOrNull(tablesDB, databaseId, tables.roomMessages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    const isStaff = caller.role === 'owner' || caller.role === 'moderator';
    if (msg.senderId !== callerUid && !isStaff) {
      throw new HttpError(403, 'غير مصرح لك بحذف هذه الرسالة.');
    }
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.roomMessages,
      rowId: messageId,
      data: {
        isDeleted: true,
        text: 'تم حذف هذه الرسالة',
        mediaUrl: '',
        isViewOnce: false,
      },
    });
  }

  if (action === 'toggleRoomMessageReaction') {
    const messageId = String(payload.messageId || '').trim();
    const emoji = String(payload.emoji || '').trim().slice(0, 16);
    if (!messageId || !emoji) throw new HttpError(400, 'بيانات التفاعل غير مكتملة.');
    const msg = await getRowOrNull(tablesDB, databaseId, tables.roomMessages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    const reactions = parseJson(msg.reactionsJson, {});
    const current = Array.isArray(reactions[emoji]) ? reactions[emoji].map(String) : [];
    const nextUsers = current.includes(callerUid)
      ? current.filter((id) => id !== callerUid)
      : [...current, callerUid];
    if (nextUsers.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = nextUsers;
    }
    return await tablesDB.updateRow({
      databaseId,
      tableId: tables.roomMessages,
      rowId: messageId,
      data: { reactionsJson: JSON.stringify(reactions) },
    });
  }

  if (action === 'consumeRoomViewOnce') {
    const messageId = String(payload.messageId || '').trim();
    if (!messageId) throw new HttpError(400, 'معرف الرسالة مطلوب.');
    const msg = await getRowOrNull(tablesDB, databaseId, tables.roomMessages, messageId);
    if (!msg) throw new HttpError(404, 'الرسالة غير موجودة.');
    if (!msg.isViewOnce || !msg.mediaUrl) {
      throw new HttpError(410, 'هذه الوسائط لم تعد متاحة.');
    }
    const viewedBy = Array.isArray(msg.viewOnceViewedBy) ? msg.viewOnceViewedBy.map(String) : [];
    if (msg.senderId !== callerUid && viewedBy.includes(callerUid)) {
      throw new HttpError(410, 'تمت مشاهدة هذه الوسائط بالفعل.');
    }
    const nextViewed = msg.senderId === callerUid || viewedBy.includes(callerUid)
      ? viewedBy
      : [...viewedBy, callerUid];
    if (nextViewed !== viewedBy) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.roomMessages,
        rowId: messageId,
        data: { viewOnceViewedBy: nextViewed },
      });
    }
    return { ok: true, mediaUrl: String(msg.mediaUrl), type: msg.type, viewOnceViewedBy: nextViewed };
  }

  if (action === 'sendMatchMessage') {
    const sessionId = String(payload.sessionId || '').trim();
    const text = String(payload.text || '').trim().slice(0, 1000);
    if (!sessionId || !text) {
      throw new HttpError(400, 'بيانات رسالة المطابقة غير مكتملة.');
    }
    const session = await getRowOrNull(tablesDB, databaseId, tables.matchSessions, sessionId);
    if (!session || !Array.isArray(session.participantIds) || !session.participantIds.includes(callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بالإرسال في هذه الجلسة.');
    }
    const perms = Array.from(new Set(session.participantIds.map(String))).map((uid) => Permission.read(Role.user(uid)));
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.matchMessages,
      rowId: ID.unique(),
      data: {
        sessionId,
        senderId: callerUid,
        senderName: String(caller.displayName || 'مشارك'),
        text,
        createdAt: nowIso,
      },
      permissions: perms,
    });
  }

  if (action === 'addIceCandidate') {
    const sessionId = String(payload.sessionId || '').trim();
    const candidate = String(payload.candidate || '');
    if (!sessionId || !candidate) {
      throw new HttpError(400, 'بيانات ICE غير مكتملة.');
    }
    const session = await getRowOrNull(tablesDB, databaseId, tables.matchSessions, sessionId);
    if (!session || !Array.isArray(session.participantIds) || !session.participantIds.includes(callerUid)) {
      throw new HttpError(403, 'غير مصرح لك بإرسال إشارات الاتصال لهذه الجلسة.');
    }
    const perms = Array.from(new Set(session.participantIds.map(String))).map((uid) => Permission.read(Role.user(uid)));
    return await tablesDB.createRow({
      databaseId,
      tableId: tables.matchCandidates,
      rowId: ID.unique(),
      data: {
        sessionId,
        senderId: callerUid,
        candidate,
        sdpMid: String(payload.sdpMid || ''),
        sdpMLineIndex: Number(payload.sdpMLineIndex ?? 0),
      },
      permissions: perms,
    });
  }

  throw new HttpError(400, `إجراء غير معروف: ${action}`);
}
