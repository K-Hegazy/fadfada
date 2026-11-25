export const BOOTSTRAPPED_OWNER_EMAIL = 'owner@fadfada.app';
export const BOOTSTRAPPED_OWNER_EMAILS = ['owner@fadfada.app', 'hegazymr6@gmail.com'];

export const DEFAULT_SITE_SETTINGS_ROW = {
  guestDailyMessageLimit: 25,
  roomCreationCost: 150,
  randomMatchFreeDaily: 3,
  randomMatchCost: 30,
  randomMatchDurationSec: 300,
  shoutoutCost: 80,
  marriageSiteFeePercent: 20,
  welcomePopupEnabled: false,
  welcomePopupTitle: 'مرحباً بك في فضفضة',
  welcomePopupBody: 'تواصل بأمان واحترام مع أعضاء المجتمع في الغرف والمحادثات الخاصة.',
  paymentMethodsJson: JSON.stringify([
    { id: 'instapay', name: 'InstaPay (إنستاباي)', accountInfo: 'fadfada@instapay', rateCoinsPerUnit: 10, currency: 'ج.م', enabled: true },
    { id: 'vodafone_cash', name: 'Vodafone Cash (فودافون كاش)', accountInfo: '01000000000', rateCoinsPerUnit: 10, currency: 'ج.م', enabled: true },
  ]),
  adsJson: JSON.stringify({
    header_banner: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
    sidebar_card: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
    feed_inline: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
  }),
  siteLogoUrl: '',
};

export const DEFAULT_STORE_SEED = [
  { id: 'vip_silver', section: 'vip', name: 'عضوية VIP فضية', description: 'شارة فضية وتمييز في الغرف والبحث لمدة 30 يومًا', priceCoins: 300, durationDays: 30, code: 'silver', color: '#64748B', imageUrl: '', isActive: true },
  { id: 'vip_gold', section: 'vip', name: 'عضوية VIP ذهبية', description: 'شارة ذهبية وأولوية في المطابقة والظهور لمدة 30 يومًا', priceCoins: 650, durationDays: 30, code: 'gold', color: '#D97706', imageUrl: '', isActive: true },
  { id: 'vip_royal', section: 'vip', name: 'عضوية VIP ملكية', description: 'الباقة الملكية الكاملة مع كل مزايا التمييز لمدة 30 يومًا', priceCoins: 1200, durationDays: 30, code: 'royal', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'feat_ghost', section: 'feature', name: 'وضع الشبح (Ghost Mode)', description: 'تصفح وزُر الملفات بدون الظهور في المتواجدين الآن', priceCoins: 200, durationDays: 30, code: 'ghostMode', color: '#475569', imageUrl: '', isActive: true },
  { id: 'feat_pin', section: 'feature', name: 'تثبيت الاسم (Pin Name)', description: 'ثبّت اسمك في أعلى قائمة المتصلين', priceCoins: 250, durationDays: 30, code: 'pinName', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'feat_color', section: 'feature', name: 'تلوين الاسم', description: 'اختر لونًا مميزًا لاسمك في جميع الأقسام', priceCoins: 120, durationDays: 30, code: 'nameColor', color: '#0369A1', imageUrl: '', isActive: true },
  { id: 'feat_hidelast', section: 'feature', name: 'إخفاء آخر ظهور', description: 'إخفاء وقت آخر ظهور عن الآخرين', priceCoins: 150, durationDays: 30, code: 'hideLastSeen', color: '#334155', imageUrl: '', isActive: true },
  { id: 'feat_themes', section: 'feature', name: 'ثيمات المحادثة', description: 'افتح جميع ثيمات الدردشة الخاصة المخصصة', priceCoins: 100, durationDays: 365, code: 'chatThemes', color: '#B45309', imageUrl: '', isActive: true },
  { id: 'frame_emerald', section: 'frame', name: 'إطار الزمرد', description: 'إطار متوهج هادئ حول صورتك الشخصية', priceCoins: 140, durationDays: 90, code: 'emerald_glow', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'frame_gold', section: 'frame', name: 'إطار الذهب الملكي', description: 'إطار ذهبي أنيق حول صورتك', priceCoins: 240, durationDays: 90, code: 'gold_crown', color: '#D97706', imageUrl: '', isActive: true },
  { id: 'frame_sapphire', section: 'frame', name: 'إطار الياقوت', description: 'إطار أزرق ياقوتي للصورة', priceCoins: 220, durationDays: 90, code: 'royal_sapphire', color: '#0284C7', imageUrl: '', isActive: true },
  { id: 'badge_supporter', section: 'badge', name: 'شارة داعم فضفضة', description: 'شارة دائمة تظهر في ملفك الشخصي', priceCoins: 350, durationDays: 365, code: 'supporter', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'badge_star', section: 'badge', name: 'شارة نجم الحوار', description: 'شارة تميز للمتحاورين الدائمين', priceCoins: 280, durationDays: 180, code: 'dialogue_star', color: '#B45309', imageUrl: '', isActive: true },
  { id: 'gift_coffee', section: 'gift', name: 'فنجان قهوة', description: 'هدية دافئة لصديقك في المحادثة أو الملف', priceCoins: 25, durationDays: 0, code: 'coffee', color: '#92400E', imageUrl: '', isActive: true },
  { id: 'gift_rose', section: 'gift', name: 'باقة ورد', description: 'تعبير أنيق عن التقدير والمودة', priceCoins: 60, durationDays: 0, code: 'rose', color: '#BE123C', imageUrl: '', isActive: true },
  { id: 'gift_crown', section: 'gift', name: 'تاج الفخامة', description: 'أرقى هدية داخل منصة فضفضة', priceCoins: 250, durationDays: 0, code: 'crown', color: '#D97706', imageUrl: '', isActive: true },
];

export const DEFAULT_TASKS_SEED = [
  { id: 'task_checkin', key: 'checkin', title: 'تسجيل الحضور اليومي', description: 'سجّل دخولك اليومي للحصول على مكافأة فورية', rewardCoins: 35, rewardXp: 40, isActive: true },
  { id: 'task_engage', key: 'engage', title: 'التفاعل برسالة أو مشاركة', description: 'أرسل رسالة في الخاص أو الغرف أو شارك بتعليق اليوم', rewardCoins: 45, rewardXp: 60, isActive: true },
  { id: 'task_send_image', key: 'send_image', title: 'مشاركة صورة أو وسائط', description: 'أرسل صورة أو فيديو اليوم في الخاص أو الغرف', rewardCoins: 40, rewardXp: 45, isActive: true },
  { id: 'task_join_room', key: 'join_room', title: 'الانضمام إلى غرفة', description: 'انضم إلى إحدى غرف الدردشة النشطة', rewardCoins: 35, rewardXp: 40, isActive: true },
  { id: 'task_use_microphone', key: 'use_microphone', title: 'استخدام الميكروفون العام', description: 'انشر نداءً في الميكروفون العلوي اليوم', rewardCoins: 50, rewardXp: 60, isActive: true },
  { id: 'task_share', key: 'share', title: 'مشاركة فضفضة', description: 'شارك رابط دعوتك الفعلي مع أصدقائك', rewardCoins: 40, rewardXp: 50, isActive: true },
  { id: 'task_ad', key: 'ad_watch', title: 'مشاهدة رسالة الراعي', description: 'شاهد البطاقة الإعلانية اليومية بالكامل واحصل على مكافأة', rewardCoins: 30, rewardXp: 35, isActive: true },
  { id: 'task_referral', key: 'referral', title: 'مكافأة دعوة صديق', description: 'تفعيل كود إحالة صحيح من صديق مسجل', rewardCoins: 75, rewardXp: 80, isActive: true },
];

export const OFFICIAL_ROOMS_SEED = [
  { id: 'official_cafe', name: 'قهوة فضفضة', description: 'مجلس عام للحديث الودي وتبادل الأحاديث اليومية', category: 'عام', theme: 'emerald', pinnedMessage: 'أهلاً بكم في قهوة فضفضة — يرجى الالتزام بالاحترام المتبادل.' },
  { id: 'official_night', name: 'سهرة منتصف الليل', description: 'مساحة هادئة للفضفضة والأفكار المسائية', category: 'فضفضة', theme: 'midnight', pinnedMessage: 'شارك أفكارك بهدوء ولطف.' },
  { id: 'official_culture', name: 'ركن الكتب والثقافة', description: 'مناقشات الكتب والأفلام والاهتمامات الفكرية', category: 'ثقافة', theme: 'sand', pinnedMessage: 'ما الكتاب الذي تقرأه هذا الأسبوع؟' },
];

export class AdminHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function getRowOrNull(tablesDB, databaseId, tableId, rowId) {
  try {
    return await tablesDB.getRow({ databaseId, tableId, rowId });
  } catch (err) {
    if (err?.code === 404) return null;
    throw err;
  }
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

async function notify(ctx, { recipientId, senderId, type, title, body }) {
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
    // Non-blocking
  }
}

function extractStorageFileId(rawUrl, expectedBucketId = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || !trimmed.includes('/files/')) return null;
  if (expectedBucketId && trimmed.includes('/buckets/')) {
    const bucketMatch = /\/buckets\/([^/]+)\/files\//.exec(trimmed);
    if (bucketMatch && bucketMatch[1] !== expectedBucketId) {
      return null;
    }
  }
  const fileMatch = /\/files\/([^/?#]+)\/(?:view|download|preview)/.exec(trimmed);
  return fileMatch?.[1] ?? null;
}

async function listAllRowsPaginated(tablesDB, databaseId, tableId, queries = [], Query, maxPages = 50) {
  const results = [];
  let cursor = null;

  for (let page = 0; page < maxPages; page += 1) {
    const pageQueries = [...queries, ...(Query?.limit ? [Query.limit(100)] : [])];
    if (cursor && Query && typeof Query.cursorAfter === 'function') {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const res = await tablesDB.listRows({
      databaseId,
      tableId,
      queries: pageQueries,
    });
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    results.push(...rows);
    if (rows.length < 100 || !Query || typeof Query.cursorAfter !== 'function') {
      break;
    }
    const lastId = rows[rows.length - 1]?.$id;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }

  return results;
}

async function isFileReferencedInTable(tablesDB, databaseId, tableId, columns, fileId, Query) {
  if (!tableId || !fileId) return false;
  for (const col of columns) {
    if (Query && typeof Query.contains === 'function') {
      try {
        const res = await tablesDB.listRows({
          databaseId,
          tableId,
          queries: [Query.contains(col, fileId), Query.limit(1)],
        });
        if (Array.isArray(res?.rows) && res.rows.length > 0) {
          return true;
        }
        continue;
      } catch {
        // Fallback to scan
      }
    }
    try {
      const rows = await listAllRowsPaginated(tablesDB, databaseId, tableId, [], Query, 25);
      for (const row of rows) {
        const val = row?.[col];
        if (typeof val === 'string' && val.includes(fileId)) {
          return true;
        }
      }
    } catch {
      return true;
    }
  }
  return false;
}

async function cleanupOrphanStorageFiles({
  tablesDB,
  storageApi,
  databaseId,
  bucketId,
  tables,
  candidateFileIds,
  Query,
}) {
  let deletedFiles = 0;
  if (!storageApi || !bucketId || !candidateFileIds || candidateFileIds.size === 0) {
    return deletedFiles;
  }
  const refChecks = [
    { tableId: tables.messages, columns: ['mediaUrl'] },
    { tableId: tables.roomMessages, columns: ['mediaUrl'] },
    { tableId: tables.wallPosts, columns: ['imageUrl'] },
    { tableId: tables.stories, columns: ['mediaUrl'] },
    { tableId: tables.users, columns: ['avatar', 'cover'] },
    { tableId: tables.storeItems, columns: ['imageUrl'] },
    { tableId: tables.siteSettings, columns: ['siteLogoUrl'] },
  ];

  for (const fileId of candidateFileIds) {
    let stillUsed = false;
    for (const check of refChecks) {
      if (!check.tableId) continue;
      if (await isFileReferencedInTable(tablesDB, databaseId, check.tableId, check.columns, fileId, Query)) {
        stillUsed = true;
        break;
      }
    }
    if (stillUsed) continue;
    try {
      await storageApi.deleteFile({ bucketId, fileId });
      deletedFiles += 1;
    } catch {
      // Non-blocking
    }
  }

  return deletedFiles;
}

async function deleteRoomWithMessagesCascade({
  roomId,
  tablesDB,
  storageApi,
  databaseId,
  bucketId,
  tables,
  Query,
}) {
  const room = await getRowOrNull(tablesDB, databaseId, tables.rooms, roomId);
  if (!room) {
    throw new AdminHttpError(404, 'الجروب غير موجود.');
  }

  const candidateFileIds = new Set();
  let deletedMessagesCount = 0;

  if (tables.roomMessages) {
    const seenFailed = new Set();
    for (let round = 0; round < 100; round += 1) {
      const queries = Query?.equal
        ? [Query.equal('roomId', roomId), ...(Query.limit ? [Query.limit(100)] : [])]
        : [];
      const res = await tablesDB.listRows({
        databaseId,
        tableId: tables.roomMessages,
        queries,
      });
      const rows = (res?.rows || []).filter(
        (r) => String(r.roomId || '') === roomId && !seenFailed.has(r.$id)
      );
      if (rows.length === 0) break;

      let deletedInRound = 0;
      for (const msg of rows) {
        const fileId = extractStorageFileId(msg.mediaUrl, bucketId);
        if (fileId) candidateFileIds.add(fileId);
        try {
          await tablesDB.deleteRow({
            databaseId,
            tableId: tables.roomMessages,
            rowId: msg.$id,
          });
          deletedMessagesCount += 1;
          deletedInRound += 1;
        } catch (err) {
          if (err?.code === 404) {
            deletedInRound += 1;
          } else {
            seenFailed.add(msg.$id);
          }
        }
      }
      if (deletedInRound === 0) break;
    }
  }

  await tablesDB.deleteRow({
    databaseId,
    tableId: tables.rooms,
    rowId: roomId,
  });

  const deletedFilesCount = await cleanupOrphanStorageFiles({
    tablesDB,
    storageApi,
    databaseId,
    bucketId,
    tables,
    candidateFileIds,
    Query,
  });

  return {
    ok: true,
    deletedRoomId: roomId,
    deletedMessagesCount,
    deletedFilesCount,
  };
}

export async function handleAdminAction(ctx) {
  const {
    callerUid,
    action,
    payload = {},
    tablesDB,
    usersApi,
    storageApi = null,
    databaseId,
    bucketId = '',
    tables,
    Permission,
    Role,
    ID,
    Query,
  } = ctx;

  if (!callerUid) {
    throw new AdminHttpError(401, 'يجب تسجيل الدخول أولاً.');
  }

  const [callerProfile, authUser] = await Promise.all([
    getRowOrNull(tablesDB, databaseId, tables.users, callerUid),
    usersApi.get({ userId: callerUid }).catch(() => null),
  ]);

  const isBootstrappedOwner =
    BOOTSTRAPPED_OWNER_EMAILS.includes(String(authUser?.email || '').toLowerCase()) &&
    Boolean(authUser?.emailVerification);

  const callerRole = isBootstrappedOwner ? 'owner' : callerProfile?.role;
  const isOwner = callerRole === 'owner';
  const isStaff = isOwner || callerRole === 'moderator';

  if (!isStaff) {
    throw new AdminHttpError(403, 'صلاحيات الإدارة مطلوبة.');
  }

  const nowIso = new Date().toISOString();

  if (action === 'ensureStaffDefaults') {
    const existingSettings = await getRowOrNull(tablesDB, databaseId, tables.siteSettings, 'global');
    if (!existingSettings) {
      await tablesDB.createRow({
        databaseId,
        tableId: tables.siteSettings,
        rowId: 'global',
        data: { ...DEFAULT_SITE_SETTINGS_ROW, updatedAt: nowIso },
        permissions: [Permission.read(Role.users())],
      });
    }
    for (const item of DEFAULT_STORE_SEED) {
      const existing = await getRowOrNull(tablesDB, databaseId, tables.storeItems, item.id);
      if (!existing) {
        await tablesDB.createRow({
          databaseId,
          tableId: tables.storeItems,
          rowId: item.id,
          data: item,
          permissions: [Permission.read(Role.users())],
        });
      }
    }
    for (const task of DEFAULT_TASKS_SEED) {
      const existing = await getRowOrNull(tablesDB, databaseId, tables.dailyTasks, task.id);
      if (!existing) {
        await tablesDB.createRow({
          databaseId,
          tableId: tables.dailyTasks,
          rowId: task.id,
          data: task,
          permissions: [Permission.read(Role.users())],
        });
      }
    }
    return { seeded: true };
  }

  if (action === 'ensureOfficialRooms') {
    for (const seed of OFFICIAL_ROOMS_SEED) {
      const existing = await getRowOrNull(tablesDB, databaseId, tables.rooms, seed.id);
      if (!existing) {
        await tablesDB.createRow({
          databaseId,
          tableId: tables.rooms,
          rowId: seed.id,
          data: {
            name: seed.name,
            description: seed.description,
            category: seed.category,
            isOfficial: true,
            ownerId: callerUid,
            ownerName: String(callerProfile?.displayName || 'إدارة فضفضة'),
            theme: seed.theme,
            pinnedMessage: seed.pinnedMessage,
            memberIds: [],
            activeCount: 0,
            createdAt: nowIso,
          },
          permissions: [Permission.read(Role.users()), Permission.update(Role.users())],
        });
      }
    }
    return { ok: true };
  }

  if (action === 'adminUpdateUser') {
    const targetUid = String(payload.targetUid || '');
    const updates = payload.updates || {};
    if (!targetUid) throw new AdminHttpError(400, 'معرف العضو مطلوب.');

    const target = await getRowOrNull(tablesDB, databaseId, tables.users, targetUid);
    if (!target) throw new AdminHttpError(404, 'العضو غير موجود.');

    if (!isOwner && target.role === 'owner') {
      throw new AdminHttpError(403, 'لا يملك المشرف صلاحية تعديل حساب المالك.');
    }

    const sanitized = {};
    if (!isOwner) {
      const forbiddenKeys = ['role', 'coins', 'vipTier', 'username', 'permissions'];
      for (const k of forbiddenKeys) {
        if (k in updates) {
          throw new AdminHttpError(403, 'تعديل الأدوار والعملات وVIP متاح للمالك فقط.');
        }
      }
      if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
        sanitized.displayName = updates.displayName.trim().slice(0, 60);
      }
      if (typeof updates.isBanned === 'boolean') {
        sanitized.isBanned = updates.isBanned;
        sanitized.banReason = updates.isBanned
          ? String(updates.banReason || 'مخالفة قوانين المنصة').slice(0, 240)
          : '';
      }
      if (Array.isArray(updates.badges)) {
        sanitized.badgesJson = JSON.stringify(updates.badges);
      }
    } else {
      if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
        sanitized.displayName = updates.displayName.trim().slice(0, 60);
      }
      if (typeof updates.username === 'string') {
        const cleanU = updates.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
        if (cleanU.length >= 3) sanitized.username = cleanU.slice(0, 30);
      }
      if (['guest', 'member', 'moderator', 'owner'].includes(updates.role)) {
        sanitized.role = updates.role;
      }
      if (typeof updates.coins === 'number' && Number.isFinite(updates.coins)) {
        sanitized.coins = Math.max(0, Math.floor(updates.coins));
      }
      if (['none', 'silver', 'gold', 'royal'].includes(updates.vipTier)) {
        sanitized.vipTier = updates.vipTier;
      }
      if (Array.isArray(updates.permissions)) {
        sanitized.permissions = updates.permissions.map((p) => String(p).trim()).filter(Boolean);
      }
      if (typeof updates.isBanned === 'boolean') {
        sanitized.isBanned = updates.isBanned;
        sanitized.banReason = updates.isBanned
          ? String(updates.banReason || 'مخالفة قوانين المنصة').slice(0, 240)
          : '';
      }
      if (Array.isArray(updates.badges)) {
        sanitized.badgesJson = JSON.stringify(updates.badges);
      }
    }

    const updated = await tablesDB.updateRow({
      databaseId,
      tableId: tables.users,
      rowId: targetUid,
      data: sanitized,
    });

    // Keep Appwrite user label 'staff' synced on role promotion/demotion
    if (sanitized.role && typeof usersApi.get === 'function' && typeof usersApi.updateLabels === 'function') {
      try {
        const targetAuth = await usersApi.get({ userId: targetUid });
        const labels = Array.isArray(targetAuth.labels) ? targetAuth.labels : [];
        const nextStaff = sanitized.role === 'owner' || sanitized.role === 'moderator';
        const nextLabels = nextStaff
          ? Array.from(new Set([...labels, 'staff']))
          : labels.filter((l) => l !== 'staff');
        await usersApi.updateLabels({ userId: targetUid, labels: nextLabels });
      } catch {
        // Non-blocking
      }
    }

    return updated;
  }

  if (action === 'reviewTopupRequest') {
    if (!isOwner) throw new AdminHttpError(403, 'مراجعة طلبات الشحن المالية متاحة للمالك فقط.');
    const requestId = String(payload.requestId || '');
    const approve = Boolean(payload.approve);
    const adminNote = String(payload.adminNote || '').trim().slice(0, 400);

    const reqRow = await getRowOrNull(tablesDB, databaseId, tables.topupRequests, requestId);
    if (!reqRow) throw new AdminHttpError(404, 'طلب الشحن غير موجود.');
    if (reqRow.status !== 'pending') throw new AdminHttpError(409, 'تمت معالجة الطلب مسبقًا.');

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.topupRequests,
      rowId: requestId,
      data: {
        status: approve ? 'approved' : 'rejected',
        adminNote,
        updatedAt: nowIso,
      },
    });

    if (approve) {
      const target = await getRowOrNull(tablesDB, databaseId, tables.users, String(reqRow.userId));
      if (target) {
        const coinsAdd = Math.max(0, Math.floor(Number(reqRow.coinsRequested ?? 0)));
        await tablesDB.updateRow({
          databaseId,
          tableId: tables.users,
          rowId: target.$id,
          data: { coins: Number(target.coins ?? 0) + coinsAdd },
        });
        await tablesDB.createRow({
          databaseId,
          tableId: tables.coinTransactions,
          rowId: ID.unique(),
          data: {
            type: 'topup',
            senderId: callerUid,
            recipientId: target.$id,
            amount: coinsAdd,
            recipientAmount: coinsAdd,
            note: `اعتماد شحن رصيد (${reqRow.method})`,
            createdAt: nowIso,
          },
          permissions: [Permission.read(Role.user(target.$id)), Permission.read(Role.label('staff'))],
        });
      }
    }

    await notify(ctx, {
      recipientId: String(reqRow.userId),
      senderId: callerUid,
      type: 'coins',
      title: approve ? 'تم اعتماد شحن العملات' : 'تم رفض طلب الشحن',
      body: approve
        ? `تم إضافة ${reqRow.coinsRequested} عملة إلى رصيدك.`
        : `تم رفض طلب الشحن: ${adminNote || 'يرجى مراجعة البيانات'}`,
    });

    return { ok: true };
  }

  if (action === 'adminSaveStoreItem') {
    if (!isOwner) throw new AdminHttpError(403, 'تعديل المتجر متاح للمالك فقط.');
    const item = payload.item || {};
    const id = String(item.id || `item_${Date.now()}`).slice(0, 36);
    return await tablesDB.upsertRow({
      databaseId,
      tableId: tables.storeItems,
      rowId: id,
      data: {
        id,
        section: ['vip', 'feature', 'frame', 'badge', 'gift'].includes(item.section) ? item.section : 'badge',
        name: String(item.name || '').trim().slice(0, 80),
        description: String(item.description || '').trim().slice(0, 300),
        priceCoins: Math.max(1, Math.floor(Number(item.priceCoins ?? 100))),
        durationDays: Math.max(0, Math.floor(Number(item.durationDays ?? 0))),
        code: String(item.code || '').trim().slice(0, 50),
        color: String(item.color || '#0D7A5F').slice(0, 20),
        imageUrl: String(item.imageUrl || '').slice(0, 500),
        isActive: item.isActive !== false,
      },
      permissions: [Permission.read(Role.users())],
    });
  }

  if (action === 'adminSaveDailyTask') {
    if (!isOwner) throw new AdminHttpError(403, 'تعديل المهام اليومية متاح للمالك فقط.');
    const task = payload.task || {};
    const key = String(task.key || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const id = String(task.id || `task_${key}`).slice(0, 36);
    return await tablesDB.upsertRow({
      databaseId,
      tableId: tables.dailyTasks,
      rowId: id,
      data: {
        id,
        key,
        title: String(task.title || '').trim().slice(0, 100),
        description: String(task.description || '').trim().slice(0, 240),
        rewardCoins: Math.min(250, Math.max(0, Math.floor(Number(task.rewardCoins ?? 0)))),
        rewardXp: Math.min(300, Math.max(0, Math.floor(Number(task.rewardXp ?? 0)))),
        isActive: task.isActive !== false,
      },
      permissions: [Permission.read(Role.users())],
    });
  }

  if (action === 'updateSiteSettings') {
    if (!isOwner) throw new AdminHttpError(403, 'تعديل إعدادات المنصة متاح للمالك فقط.');
    const s = payload.settings || {};
    return await tablesDB.upsertRow({
      databaseId,
      tableId: tables.siteSettings,
      rowId: 'global',
      data: {
        guestDailyMessageLimit: Math.max(0, Math.floor(Number(s.guestDailyMessageLimit ?? 25))),
        roomCreationCost: Math.max(0, Math.floor(Number(s.roomCreationCost ?? 150))),
        randomMatchFreeDaily: Math.max(0, Math.floor(Number(s.randomMatchFreeDaily ?? 3))),
        randomMatchCost: Math.max(0, Math.floor(Number(s.randomMatchCost ?? 30))),
        randomMatchDurationSec: Math.max(30, Math.floor(Number(s.randomMatchDurationSec ?? 300))),
        shoutoutCost: Math.max(0, Math.floor(Number(s.shoutoutCost ?? 80))),
        marriageSiteFeePercent: Math.min(50, Math.max(0, Math.floor(Number(s.marriageSiteFeePercent ?? 20)))),
        welcomePopupEnabled: Boolean(s.welcomePopupEnabled),
        welcomePopupTitle: String(s.welcomePopupTitle || '').slice(0, 120),
        welcomePopupBody: String(s.welcomePopupBody || '').slice(0, 600),
        paymentMethodsJson: JSON.stringify(Array.isArray(s.paymentMethods) ? s.paymentMethods : []),
        adsJson: JSON.stringify(s.ads || {}),
        siteLogoUrl: typeof s.siteLogoUrl === 'string' && /^(https?:\/\/|\/)/.test(s.siteLogoUrl.trim())
          ? s.siteLogoUrl.trim().slice(0, 500)
          : '',
        updatedAt: nowIso,
      },
      permissions: [Permission.read(Role.users())],
    });
  }

  if (action === 'adminReviewProposal') {
    const proposalId = String(payload.proposalId || '');
    const approve = Boolean(payload.approve);
    const adminReply = String(payload.adminReply || '').trim().slice(0, 500);
    const badgeDurationDays = approve ? Math.max(1, Math.floor(Number(payload.badgeDurationDays ?? 30))) : 0;

    const proposal = await getRowOrNull(tablesDB, databaseId, tables.creatorProposals, proposalId);
    if (!proposal) throw new AdminHttpError(404, 'المقترح غير موجود.');

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.creatorProposals,
      rowId: proposalId,
      data: {
        status: approve ? 'approved' : 'rejected',
        adminReply,
        badgeDurationDays,
      },
    });

    if (approve) {
      const author = await getRowOrNull(tablesDB, databaseId, tables.users, String(proposal.authorId));
      if (author) {
        const existingBadges = parseJson(author.badgesJson, []);
        const creatorBadge = {
          id: 'creator_hub',
          name: 'مبدع معتمد',
          color: '#0D7A5F',
          expiresAt: Date.now() + badgeDurationDays * 24 * 60 * 60 * 1000,
        };
        await tablesDB.updateRow({
          databaseId,
          tableId: tables.users,
          rowId: author.$id,
          data: {
            badgesJson: JSON.stringify([
              ...existingBadges.filter((b) => b.id !== 'creator_hub'),
              creatorBadge,
            ]),
          },
        });
      }
    }

    await notify(ctx, {
      recipientId: String(proposal.authorId),
      senderId: callerUid,
      type: 'creator',
      title: approve ? 'تمت الموافقة على مقترح الإبداع!' : 'تحديث مقترح الإبداع',
      body: approve
        ? `مبارك! حصلت على شارة مبدع معتمد لمدة ${badgeDurationDays} يومًا.`
        : adminReply || 'تم رفض المقترح حاليًا.',
    });

    return { ok: true };
  }

  if (action === 'reviewReport') {
    const reportId = String(payload.reportId || '');
    const status = payload.status === 'resolved' ? 'resolved' : 'dismissed';
    const adminNote = String(payload.adminNote || '').trim().slice(0, 400);
    const report = await getRowOrNull(tablesDB, databaseId, tables.reports, reportId);
    if (!report) throw new AdminHttpError(404, 'البلاغ غير موجود.');

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.reports,
      rowId: reportId,
      data: { status, adminNote },
    });

    await notify(ctx, {
      recipientId: String(report.reporterId),
      senderId: callerUid,
      type: 'report',
      title: 'تحديث البلاغ',
      body: `تمت مراجعة بلاغك بحق ${report.targetName}: ${status === 'resolved' ? 'تم اتخاذ إجراء' : 'تم الإغلاق'}`,
    });
    return { ok: true };
  }

  if (action === 'reviewAppeal') {
    const appealId = String(payload.appealId || '');
    const accept = Boolean(payload.accept);
    const adminNote = String(payload.adminNote || '').trim().slice(0, 400);
    const appeal = await getRowOrNull(tablesDB, databaseId, tables.appeals, appealId);
    if (!appeal) throw new AdminHttpError(404, 'الالتماس غير موجود.');

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.appeals,
      rowId: appealId,
      data: { status: accept ? 'accepted' : 'rejected', adminNote },
    });

    if (accept) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tables.users,
        rowId: String(appeal.userId),
        data: { isBanned: false, banReason: '' },
      });
    }

    await notify(ctx, {
      recipientId: String(appeal.userId),
      senderId: callerUid,
      type: 'appeal',
      title: accept ? 'تم قبول التماس فك الحظر' : 'تم رفض الالتماس',
      body: adminNote || (accept ? 'تم رفع الحظر عن حسابك.' : 'تم الإبقاء على الحظر.'),
    });
    return { ok: true };
  }

  if (action === 'replySupportTicket') {
    const ticketId = String(payload.ticketId || '');
    const reply = String(payload.reply || '').trim().slice(0, 1500);
    const status = payload.status === 'closed' ? 'closed' : 'answered';
    const ticket = await getRowOrNull(tablesDB, databaseId, tables.supportTickets, ticketId);
    if (!ticket) throw new AdminHttpError(404, 'التذكرة غير موجودة.');

    await tablesDB.updateRow({
      databaseId,
      tableId: tables.supportTickets,
      rowId: ticketId,
      data: { adminReply: reply, status, updatedAt: nowIso },
    });

    await notify(ctx, {
      recipientId: String(ticket.userId),
      senderId: callerUid,
      type: 'support',
      title: 'رد جديد من الدعم الفني',
      body: `بخصوص تذكرتك "${ticket.subject}": ${reply.slice(0, 120)}`,
    });
    return { ok: true };
  }

  if (action === 'deleteRoomAsOwner') {
    if (!isOwner) {
      throw new AdminHttpError(403, 'حذف الجروب متاح للمالك فقط.');
    }
    const roomId = String(payload.roomId || '').trim();
    if (!roomId) {
      throw new AdminHttpError(400, 'معرف الجروب مطلوب.');
    }
    return await deleteRoomWithMessagesCascade({
      roomId,
      tablesDB,
      storageApi,
      databaseId,
      bucketId,
      tables,
      Query,
    });
  }

  if (action === 'deleteContentAsStaff') {
    const tableKey = String(payload.tableKey || '');
    const rowId = String(payload.rowId || '');
    const allowedTables = ['wallPosts', 'stories', 'rooms'];
    if (!allowedTables.includes(tableKey) || !rowId) {
      throw new AdminHttpError(400, 'بيانات الحذف غير صالحة.');
    }
    if (tableKey === 'rooms') {
      if (!isOwner) {
        throw new AdminHttpError(403, 'حذف الجروب متاح للمالك فقط.');
      }
      return await deleteRoomWithMessagesCascade({
        roomId: rowId,
        tablesDB,
        storageApi,
        databaseId,
        bucketId,
        tables,
        Query,
      });
    }
    await tablesDB.deleteRow({ databaseId, tableId: tables[tableKey], rowId });
    return { ok: true };
  }

  throw new AdminHttpError(400, `إجراء إداري غير معروف: ${action}`);
}
