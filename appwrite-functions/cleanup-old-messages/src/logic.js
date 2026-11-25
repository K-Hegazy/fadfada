export const BOOTSTRAPPED_OWNER_EMAILS = ['owner@fadfada.app', 'hegazymr6@gmail.com'];

export const DEFAULT_RETENTION_DAYS = 7;
export const DEFAULT_GUEST_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_BATCH_SIZE = 100;

export class CleanupHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function extractStorageFileId(rawUrl, expectedBucketId = '') {
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

async function getRowOrNull(tablesDB, databaseId, tableId, rowId) {
  try {
    return await tablesDB.getRow({ databaseId, tableId, rowId });
  } catch (err) {
    if (err?.code === 404) return null;
    throw err;
  }
}

async function listAllRowsPaginated(tablesDB, databaseId, tableId, queries = [], Query, maxPages = 50) {
  const results = [];
  let cursor = null;

  for (let page = 0; page < maxPages; page += 1) {
    const pageQueries = [...queries, Query.limit(100)];
    if (cursor && typeof Query.cursorAfter === 'function') {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const res = await tablesDB.listRows({
      databaseId,
      tableId,
      queries: pageQueries,
    });
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    results.push(...rows);
    if (rows.length < 100 || typeof Query.cursorAfter !== 'function') {
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
      // Fallback to paginated scan when column query isn't supported
    }

    try {
      const allRows = await listAllRowsPaginated(tablesDB, databaseId, tableId, [], Query, 25);
      for (const row of allRows) {
        const val = row?.[col];
        if (typeof val === 'string' && val.includes(fileId)) {
          return true;
        }
      }
    } catch {
      // If table cannot be scanned safely, avoid risking accidental deletion of referenced file
      return true;
    }
  }

  return false;
}

export async function isStorageFileStillReferenced({
  tablesDB,
  databaseId,
  tables,
  fileId,
  Query,
}) {
  const checks = [
    { tableId: tables.messages, columns: ['mediaUrl'] },
    { tableId: tables.roomMessages, columns: ['mediaUrl'] },
    { tableId: tables.wallPosts, columns: ['imageUrl'] },
    { tableId: tables.stories, columns: ['mediaUrl'] },
    { tableId: tables.users, columns: ['avatar', 'cover'] },
    { tableId: tables.storeItems, columns: ['imageUrl'] },
    { tableId: tables.siteSettings, columns: ['siteLogoUrl'] },
  ];

  for (const check of checks) {
    if (!check.tableId) continue;
    const referenced = await isFileReferencedInTable(
      tablesDB,
      databaseId,
      check.tableId,
      check.columns,
      fileId,
      Query
    );
    if (referenced) return true;
  }

  return false;
}

export async function cleanupOrphanStorageFiles({
  tablesDB,
  storageApi,
  databaseId,
  bucketId,
  tables,
  candidateFileIds,
  Query,
}) {
  let deletedFiles = 0;
  let skippedReferencedFiles = 0;

  if (!storageApi || !bucketId || !candidateFileIds || candidateFileIds.size === 0) {
    return { deletedFiles, skippedReferencedFiles };
  }

  for (const fileId of candidateFileIds) {
    if (!fileId) continue;
    const referenced = await isStorageFileStillReferenced({
      tablesDB,
      databaseId,
      tables,
      fileId,
      Query,
    });
    if (referenced) {
      skippedReferencedFiles += 1;
      continue;
    }
    try {
      await storageApi.deleteFile({ bucketId, fileId });
      deletedFiles += 1;
    } catch (err) {
      if (err?.code !== 404) {
        // Non-blocking: ignore transient storage errors so cleanup keeps progressing
      }
    }
  }

  return { deletedFiles, skippedReferencedFiles };
}

async function deleteMessageRowsOlderThan({
  tablesDB,
  databaseId,
  tableId,
  cutoffIso,
  bucketId,
  Query,
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  if (!tableId) return { deletedCount: 0, candidateFileIds: new Set() };

  let deletedCount = 0;
  const candidateFileIds = new Set();
  const seenFailedIds = new Set();

  for (let round = 0; round < 100; round += 1) {
    let batchRows = [];
    if (typeof Query.lessThan === 'function') {
      const res = await tablesDB.listRows({
        databaseId,
        tableId,
        queries: [Query.lessThan('createdAt', cutoffIso), Query.limit(batchSize)],
      });
      batchRows = (res?.rows || []).filter((r) => !seenFailedIds.has(r.$id));
    } else {
      const all = await listAllRowsPaginated(tablesDB, databaseId, tableId, [], Query, 50);
      batchRows = all
        .filter((r) => {
          const ts = String(r.createdAt || r.$createdAt || '');
          return Boolean(ts) && ts < cutoffIso && !seenFailedIds.has(r.$id);
        })
        .slice(0, batchSize);
    }

    if (batchRows.length === 0) break;

    let deletedInRound = 0;
    for (const row of batchRows) {
      const createdVal = String(row.createdAt || row.$createdAt || '');
      if (!createdVal || createdVal >= cutoffIso) {
        seenFailedIds.add(row.$id);
        continue;
      }
      const fileId = extractStorageFileId(row.mediaUrl, bucketId);
      if (fileId) candidateFileIds.add(fileId);

      try {
        await tablesDB.deleteRow({ databaseId, tableId, rowId: row.$id });
        deletedCount += 1;
        deletedInRound += 1;
      } catch (err) {
        if (err?.code === 404) {
          deletedInRound += 1;
        } else {
          seenFailedIds.add(row.$id);
        }
      }
    }

    if (deletedInRound === 0) break;
  }

  return { deletedCount, candidateFileIds };
}

/**
 * @param {{
 *   tablesDB: any;
 *   storageApi?: any;
 *   databaseId: string;
 *   bucketId?: string;
 *   tables: Record<string, string>;
 *   Query: any;
 *   nowMs?: number;
 *   retentionDays?: number;
 *   batchSize?: number;
 * }} params
 */
export async function deleteOldChatMessages({
  tablesDB,
  storageApi = undefined,
  databaseId,
  bucketId = '',
  tables,
  Query,
  nowMs = Date.now(),
  retentionDays = DEFAULT_RETENTION_DAYS,
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  const cutoffIso = new Date(nowMs - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const dmRes = await deleteMessageRowsOlderThan({
    tablesDB,
    databaseId,
    tableId: tables.messages,
    cutoffIso,
    bucketId,
    Query,
    batchSize,
  });

  const roomRes = await deleteMessageRowsOlderThan({
    tablesDB,
    databaseId,
    tableId: tables.roomMessages,
    cutoffIso,
    bucketId,
    Query,
    batchSize,
  });

  const allCandidates = new Set([...dmRes.candidateFileIds, ...roomRes.candidateFileIds]);
  const storageRes = await cleanupOrphanStorageFiles({
    tablesDB,
    storageApi,
    databaseId,
    bucketId,
    tables,
    candidateFileIds: allCandidates,
    Query,
  });

  return {
    cutoffIso,
    deletedMessages: dmRes.deletedCount,
    deletedRoomMessages: roomRes.deletedCount,
    deletedFiles: storageRes.deletedFiles,
    skippedReferencedFiles: storageRes.skippedReferencedFiles,
  };
}

export async function purgeGuestAccountData({
  uid,
  tablesDB,
  usersApi,
  databaseId,
  tables,
  Query,
}) {
  if (!uid) return;

  // 1. Remove guest from any rooms' memberIds and update activeCount
  if (tables.rooms) {
    try {
      const roomsRes = await tablesDB.listRows({
        databaseId,
        tableId: tables.rooms,
        queries: [Query.contains('memberIds', uid), Query.limit(100)],
      });
      for (const room of roomsRes.rows || []) {
        const members = Array.isArray(room.memberIds) ? room.memberIds.map(String) : [];
        if (members.includes(uid)) {
          const nextMembers = members.filter((id) => id !== uid);
          await tablesDB.updateRow({
            databaseId,
            tableId: tables.rooms,
            rowId: room.$id,
            data: { memberIds: nextMembers, activeCount: nextMembers.length },
          }).catch(() => {});
        }
      }
    } catch {
      // Non-blocking
    }
  }

  // 2. Delete match queue entry
  if (tables.matchQueue) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.matchQueue, rowId: uid }).catch(() => {});
  }

  // 3. Delete daily_claims, notifications, profile_visits belonging to guest
  const cleanups = [
    tables.dailyClaims ? { tableId: tables.dailyClaims, field: 'uid' } : null,
    tables.notifications ? { tableId: tables.notifications, field: 'recipientId' } : null,
    tables.notifications ? { tableId: tables.notifications, field: 'senderId' } : null,
    tables.profileVisits ? { tableId: tables.profileVisits, field: 'visitorUid' } : null,
    tables.profileVisits ? { tableId: tables.profileVisits, field: 'profileUid' } : null,
  ].filter(Boolean);

  for (const target of cleanups) {
    try {
      const rows = await listAllRowsPaginated(
        tablesDB,
        databaseId,
        target.tableId,
        [Query.equal(target.field, uid)],
        Query,
        10
      );
      for (const r of rows) {
        await tablesDB.deleteRow({ databaseId, tableId: target.tableId, rowId: r.$id }).catch(() => {});
      }
    } catch {
      // Non-blocking
    }
  }

  // 4. Delete user_private & users profile rows
  if (tables.userPrivate) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.userPrivate, rowId: uid }).catch(() => {});
  }
  if (tables.users) {
    await tablesDB.deleteRow({ databaseId, tableId: tables.users, rowId: uid }).catch(() => {});
  }

  // 5. Delete Appwrite Auth user (strictly only if anonymous with no email/phone/staff)
  if (usersApi && typeof usersApi.delete === 'function') {
    const authUser = typeof usersApi.get === 'function'
      ? await usersApi.get({ userId: uid }).catch(() => null)
      : null;
    const hasEmailOrPhone = Boolean(authUser?.email) || Boolean(authUser?.phone);
    const hasStaff = Array.isArray(authUser?.labels) && authUser.labels.includes('staff');
    if (authUser && !hasEmailOrPhone && !hasStaff) {
      await usersApi.delete({ userId: uid }).catch(() => {});
    }
  }
}

export async function cleanupAbandonedGuests({
  tablesDB,
  usersApi,
  databaseId,
  tables,
  Query,
  nowMs = Date.now(),
  guestTtlMs = DEFAULT_GUEST_TTL_MS,
}) {
  const guests = await listAllRowsPaginated(
    tablesDB,
    databaseId,
    tables.users,
    [Query.equal('role', 'guest'), Query.equal('isAnonymous', true)],
    Query,
    25
  );

  let scannedGuests = 0;
  let deletedGuests = 0;
  const deletedGuestIds = [];

  for (const row of guests) {
    scannedGuests += 1;
    // Strict guard: never touch permanent members, moderators, or owner
    if (row.role !== 'guest' || row.isAnonymous !== true) {
      continue;
    }

    const uid = String(row.uid || row.$id);
    const lastSeenRaw = row.lastSeen || row.$updatedAt || row.createdAt || '';
    const lastSeenMs = Date.parse(String(lastSeenRaw));

    if (!Number.isFinite(lastSeenMs) || nowMs - lastSeenMs < guestTtlMs) {
      continue;
    }

    // Verify Appwrite Auth user is truly anonymous before purging
    if (usersApi && typeof usersApi.get === 'function') {
      const authUser = await usersApi.get({ userId: uid }).catch(() => null);
      if (authUser) {
        const hasEmailOrPhone = Boolean(authUser.email) || Boolean(authUser.phone);
        const hasStaff = Array.isArray(authUser.labels) && authUser.labels.includes('staff');
        if (hasEmailOrPhone || hasStaff) {
          continue;
        }
      }
    }

    await purgeGuestAccountData({
      uid,
      tablesDB,
      usersApi,
      databaseId,
      tables,
      Query,
    });
    deletedGuests += 1;
    deletedGuestIds.push(uid);
  }

  return {
    scannedGuests,
    deletedGuests,
    deletedGuestIds,
  };
}

export async function runScheduledMaintenance(ctx) {
  const {
    callerUid = '',
    isScheduledTrigger = false,
    payload = {},
    tablesDB,
    usersApi,
    storageApi,
    databaseId,
    bucketId,
    tables,
    Query,
    nowMs = Date.now(),
  } = ctx;

  if (!isScheduledTrigger) {
    if (!callerUid) {
      throw new CleanupHttpError(401, 'التشغيل اليدوي يتطلب تسجيل الدخول بحساب المالك.');
    }
    const [callerProfile, authUser] = await Promise.all([
      getRowOrNull(tablesDB, databaseId, tables.users, callerUid),
      usersApi?.get ? usersApi.get({ userId: callerUid }).catch(() => null) : Promise.resolve(null),
    ]);
    const isBootstrappedOwner =
      BOOTSTRAPPED_OWNER_EMAILS.includes(String(authUser?.email || '').toLowerCase()) &&
      Boolean(authUser?.emailVerification);
    const isOwner = isBootstrappedOwner || callerProfile?.role === 'owner';
    if (!isOwner) {
      throw new CleanupHttpError(403, 'تشغيل التنظيف اليدوي متاح للمالك فقط.');
    }
  }

  const mode = String(payload.mode || 'all');
  const retentionDays = Math.max(1, Number(payload.retentionDays ?? DEFAULT_RETENTION_DAYS));
  const guestTtlMs = Math.max(60_000, Number(payload.guestTtlMs ?? DEFAULT_GUEST_TTL_MS));

  const messagesResult =
    mode === 'all' || mode === 'messages'
      ? await deleteOldChatMessages({
          tablesDB,
          storageApi,
          databaseId,
          bucketId,
          tables,
          Query,
          nowMs,
          retentionDays,
        })
      : null;

  const guestsResult =
    mode === 'all' || mode === 'guests'
      ? await cleanupAbandonedGuests({
          tablesDB,
          usersApi,
          databaseId,
          tables,
          Query,
          nowMs,
          guestTtlMs,
        })
      : null;

  return {
    ok: true,
    messages: messagesResult,
    guests: guestsResult,
  };
}
