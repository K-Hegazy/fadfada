import { APPWRITE_CONFIG, isAppwriteConfigured, Query } from '../appwrite/config';
import { subscribeToSingleRow, subscribeToTableRows } from '../appwrite/realtime';
import {
  executeAppwriteFunction,
  getTableRow,
  normalizeAppDate,
  parseJsonField,
  type AppwriteRow,
} from '../appwrite/tables';
import type {
  AppealItem,
  AppNotification,
  CoinTransaction,
  CoinTransactionType,
  CreatorProposal,
  DailyTask,
  Marriage,
  NotificationType,
  PaymentMethodConfig,
  Relationship,
  ReportItem,
  Shoutout,
  SiteSettings,
  StoreItem,
  StoreSection,
  SupportTicket,
  TopupRequest,
  UserBadge,
  UserProfile,
  UserRole,
  VipTier,
} from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';
import {
  DEFAULT_DAILY_TASKS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_STORE_ITEMS,
} from '../utils/progression';

// ============================================================================
// 1. Notifications Helper & Listener
// ============================================================================
export async function pushNotification(
  recipientId: string,
  _senderId: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<void> {
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'pushNotification', {
      recipientId,
      type,
      title,
      body,
    });
  } catch {
    // Non-blocking notification delivery
  }
}

export function subscribeToNotifications(
  uid: string,
  onUpdate: (list: AppNotification[]) => void
): () => void {
  return subscribeToTableRows<AppNotification>({
    tableId: APPWRITE_CONFIG.tables.notifications,
    queries: [Query.equal('recipientId', uid), Query.orderDesc('$createdAt'), Query.limit(60)],
    mapRow: (row) => ({
      id: String(row.$id),
      recipientId: String(row.recipientId || ''),
      senderId: String(row.senderId || ''),
      type: (row.type as NotificationType) || 'announcement',
      title: String(row.title || ''),
      body: String(row.body || ''),
      isRead: Boolean(row.isRead),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (n) => n.recipientId === uid,
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function markAllNotificationsRead(list: AppNotification[]): Promise<void> {
  if (!list.some((n) => !n.isRead)) return;
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'markNotificationsRead');
}

// ============================================================================
// 2. Site Settings & Bootstrap Seed (Owner)
// ============================================================================
function mapSiteSettingsRow(row: AppwriteRow): SiteSettings {
  const paymentMethods = parseJsonField<PaymentMethodConfig[]>(
    row.paymentMethodsJson ?? row.paymentMethods,
    DEFAULT_SITE_SETTINGS.paymentMethods
  );
  const rawAds = parseJsonField<Partial<SiteSettings['ads']>>(row.adsJson ?? row.ads, {});
  return {
    id: String(row.$id || 'global'),
    guestDailyMessageLimit: Number(
      row.guestDailyMessageLimit ?? DEFAULT_SITE_SETTINGS.guestDailyMessageLimit
    ),
    roomCreationCost: Number(row.roomCreationCost ?? DEFAULT_SITE_SETTINGS.roomCreationCost),
    randomMatchFreeDaily: Number(
      row.randomMatchFreeDaily ?? DEFAULT_SITE_SETTINGS.randomMatchFreeDaily
    ),
    randomMatchCost: Number(row.randomMatchCost ?? DEFAULT_SITE_SETTINGS.randomMatchCost),
    randomMatchDurationSec: Number(
      row.randomMatchDurationSec ?? DEFAULT_SITE_SETTINGS.randomMatchDurationSec
    ),
    shoutoutCost: Number(row.shoutoutCost ?? DEFAULT_SITE_SETTINGS.shoutoutCost),
    marriageSiteFeePercent: Number(
      row.marriageSiteFeePercent ?? DEFAULT_SITE_SETTINGS.marriageSiteFeePercent
    ),
    welcomePopupEnabled: Boolean(row.welcomePopupEnabled),
    welcomePopupTitle: String(row.welcomePopupTitle ?? DEFAULT_SITE_SETTINGS.welcomePopupTitle),
    welcomePopupBody: String(row.welcomePopupBody ?? DEFAULT_SITE_SETTINGS.welcomePopupBody),
    paymentMethods:
      Array.isArray(paymentMethods) && paymentMethods.length > 0
        ? paymentMethods
        : DEFAULT_SITE_SETTINGS.paymentMethods,
    ads: {
      ...DEFAULT_SITE_SETTINGS.ads,
      ...rawAds,
    },
    siteLogoUrl: String(row.siteLogoUrl || ''),
    updatedAt: normalizeAppDate(row, 'updatedAt'),
  };
}

export function subscribeToSiteSettings(
  onUpdate: (settings: SiteSettings) => void
): () => void {
  return subscribeToSingleRow<SiteSettings>({
    tableId: APPWRITE_CONFIG.tables.siteSettings,
    rowId: 'global',
    fetchRow: async () => {
      const row = await getTableRow(APPWRITE_CONFIG.tables.siteSettings, 'global');
      return row ? mapSiteSettingsRow(row) : { ...DEFAULT_SITE_SETTINGS, updatedAt: null };
    },
    mapRow: mapSiteSettingsRow,
    onData: (settings) => onUpdate(settings ?? { ...DEFAULT_SITE_SETTINGS, updatedAt: null }),
  });
}

export async function ensureStaffDefaults(): Promise<void> {
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'ensureStaffDefaults');
  } catch {
    // Non-blocking if non-staff
  }
}

export async function updateSiteSettings(settings: Omit<SiteSettings, 'updatedAt'>): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'updateSiteSettings', {
    settings,
  });
}

// ============================================================================
// 3. Store, VIP, Features, Frames, Badges, Gifts & Transfers
// ============================================================================
export function subscribeToStoreItems(onUpdate: (items: StoreItem[]) => void): () => void {
  return subscribeToTableRows<StoreItem>({
    tableId: APPWRITE_CONFIG.tables.storeItems,
    queries: [Query.limit(100)],
    mapRow: (row) => ({
      id: String(row.id || row.$id),
      section: (row.section as StoreSection) || 'badge',
      name: String(row.name || ''),
      description: String(row.description || ''),
      priceCoins: Number(row.priceCoins ?? 0),
      durationDays: Number(row.durationDays ?? 0),
      code: String(row.code || ''),
      color: String(row.color || '#0D7A5F'),
      imageUrl: String(row.imageUrl || ''),
      isActive: row.isActive !== false,
    }),
    onData: (items) => onUpdate(items.length > 0 ? items : DEFAULT_STORE_ITEMS),
  });
}

export async function purchaseStoreItem(
  _user: UserProfile,
  item: StoreItem
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'purchaseStoreItem', {
    itemId: item.id,
  });
}

export async function sendGiftToUser(
  _sender: UserProfile,
  recipient: UserProfile,
  gift: StoreItem,
  alsoInChat = true
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'sendGift', {
    recipientId: recipient.uid,
    giftId: gift.id,
    alsoInChat,
  });
}

export async function transferCoinsToUser(
  _sender: UserProfile,
  recipient: UserProfile,
  amount: number
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'transferCoins', {
    recipientId: recipient.uid,
    amount,
  });
}

export function subscribeToCoinTransactions(
  uid: string,
  onUpdate: (list: CoinTransaction[]) => void
): () => void {
  if (!isAppwriteConfigured) {
    onUpdate([]);
    return () => {};
  }

  let sentList: CoinTransaction[] = [];
  let receivedList: CoinTransaction[] = [];

  const mapTx = (row: AppwriteRow): CoinTransaction => ({
    id: String(row.$id),
    type: (row.type as CoinTransactionType) || 'transfer',
    senderId: String(row.senderId || ''),
    recipientId: String(row.recipientId || ''),
    amount: Number(row.amount ?? 0),
    recipientAmount: Number(row.recipientAmount ?? 0),
    note: String(row.note || ''),
    createdAt: normalizeAppDate(row, 'createdAt'),
  });

  const emit = () => {
    const merged = new Map<string, CoinTransaction>();
    for (const item of [...sentList, ...receivedList]) {
      merged.set(item.id, item);
    }
    const sorted = Array.from(merged.values()).sort(
      (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
    );
    onUpdate(sorted.slice(0, 60));
  };

  const u1 = subscribeToTableRows<CoinTransaction>({
    tableId: APPWRITE_CONFIG.tables.coinTransactions,
    queries: [Query.equal('senderId', uid), Query.limit(40)],
    mapRow: mapTx,
    matchesRow: (t) => t.senderId === uid,
    onData: (list) => {
      sentList = list;
      emit();
    },
  });

  const u2 = subscribeToTableRows<CoinTransaction>({
    tableId: APPWRITE_CONFIG.tables.coinTransactions,
    queries: [Query.equal('recipientId', uid), Query.limit(40)],
    mapRow: mapTx,
    matchesRow: (t) => t.recipientId === uid,
    onData: (list) => {
      receivedList = list;
      emit();
    },
  });

  return () => {
    u1();
    u2();
  };
}

// ============================================================================
// 4. Daily Tasks, Claims & Daily Wheel
// ============================================================================
export function subscribeToDailyTasks(onUpdate: (tasks: DailyTask[]) => void): () => void {
  return subscribeToTableRows<DailyTask>({
    tableId: APPWRITE_CONFIG.tables.dailyTasks,
    queries: [Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.id || row.$id),
      key: String(row.key || ''),
      title: String(row.title || ''),
      description: String(row.description || ''),
      rewardCoins: Number(row.rewardCoins ?? 0),
      rewardXp: Number(row.rewardXp ?? 0),
      isActive: row.isActive !== false,
    }),
    onData: (list) => onUpdate(list.length > 0 ? list : DEFAULT_DAILY_TASKS),
  });
}

export function subscribeToMyDailyClaims(
  uid: string,
  onUpdate: (claimedKeys: string[]) => void
): () => void {
  const today = new Date().toISOString().slice(0, 10);
  return subscribeToTableRows<{ id: string; uid: string; dateKey: string; taskKey: string }>({
    tableId: APPWRITE_CONFIG.tables.dailyClaims,
    queries: [Query.equal('uid', uid), Query.limit(60)],
    mapRow: (row) => ({
      id: String(row.$id),
      uid: String(row.uid || ''),
      dateKey: String(row.dateKey || ''),
      taskKey: String(row.taskKey || ''),
    }),
    matchesRow: (c) => c.uid === uid && c.dateKey === today,
    onData: (claims) => onUpdate(claims.map((c) => c.taskKey)),
  });
}

export async function getDailyTaskProgress(): Promise<{
  dateKey: string;
  completedByKey: Record<string, boolean>;
  claimedByKey: Record<string, boolean>;
}> {
  return await executeAppwriteFunction<{
    dateKey: string;
    completedByKey: Record<string, boolean>;
    claimedByKey: Record<string, boolean>;
  }>(APPWRITE_CONFIG.economyFunctionId, 'getDailyTaskProgress');
}

export async function recordDailyTaskActivity(kind: 'share' | 'ad_watch'): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'recordDailyTaskActivity', {
    kind,
  });
}

export async function claimDailyReward(
  _user: UserProfile,
  taskKey: string,
  _rewardCoins: number,
  _rewardXp: number,
  extra?: { referralCode?: string }
): Promise<{ rewardCoins: number; rewardXp: number; wheelIndex?: number }> {
  return await executeAppwriteFunction<{ rewardCoins: number; rewardXp: number; wheelIndex?: number }>(
    APPWRITE_CONFIG.economyFunctionId,
    'claimDailyReward',
    {
      taskKey,
      ...(extra?.referralCode ? { referralCode: extra.referralCode } : {}),
    }
  );
}

// ============================================================================
// 5. Megaphone Shoutouts
// ============================================================================
export function subscribeToShoutouts(onUpdate: (list: Shoutout[]) => void): () => void {
  return subscribeToTableRows<Shoutout>({
    tableId: APPWRITE_CONFIG.tables.shoutouts,
    queries: [Query.limit(25)],
    mapRow: (row) => ({
      id: String(row.$id),
      authorId: String(row.authorId || ''),
      authorName: String(row.authorName || ''),
      kind: (row.kind as Shoutout['kind']) || 'user',
      text: String(row.text || ''),
      expiresAt: Number(row.expiresAt ?? 0),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (s) => s.expiresAt > Date.now(),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function postShoutout(
  _author: UserProfile,
  text: string,
  kind: 'user' | 'admin' | 'urgent',
  _cost: number
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'postShoutout', {
    text,
    kind,
  });
}

// ============================================================================
// 6. Friends & Marriage
// ============================================================================
export function subscribeToRelationships(
  uid: string,
  onUpdate: (list: Relationship[]) => void
): () => void {
  return subscribeToTableRows<Relationship>({
    tableId: APPWRITE_CONFIG.tables.relationships,
    queries: [
      Query.or([Query.equal('requesterId', uid), Query.equal('recipientId', uid)]),
      Query.limit(100),
    ],
    mapRow: (row) => {
      const p = Array.isArray(row.participantIds) ? (row.participantIds as string[]) : [];
      return {
        id: String(row.$id),
        requesterId: String(row.requesterId || ''),
        recipientId: String(row.recipientId || ''),
        participantIds: [p[0] ?? '', p[1] ?? ''] as [string, string],
        status: (row.status as Relationship['status']) || 'pending',
        createdAt: normalizeAppDate(row, 'createdAt'),
        updatedAt: normalizeAppDate(row, 'updatedAt'),
      };
    },
    matchesRow: (r) => r.participantIds.includes(uid),
    onData: onUpdate,
  });
}

export async function sendFriendRequest(
  _sender: UserProfile,
  target: UserProfile
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'sendFriendRequest', {
    targetUid: target.uid,
  });
}

export async function respondFriendRequest(
  rel: Relationship,
  _currentUid: string,
  accept: boolean
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'respondFriendRequest', {
    relationshipId: rel.id,
    accept,
  });
}

export async function removeFriend(rel: Relationship, _currentUid: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'removeFriend', {
    relationshipId: rel.id,
  });
}

export function subscribeToMarriages(
  uid: string,
  onUpdate: (list: Marriage[]) => void
): () => void {
  return subscribeToTableRows<Marriage>({
    tableId: APPWRITE_CONFIG.tables.marriages,
    queries: [
      Query.or([Query.equal('proposerId', uid), Query.equal('partnerId', uid)]),
      Query.limit(50),
    ],
    mapRow: (row) => {
      const p = Array.isArray(row.participantIds) ? (row.participantIds as string[]) : [];
      return {
        id: String(row.$id),
        proposerId: String(row.proposerId || ''),
        proposerName: String(row.proposerName || ''),
        partnerId: String(row.partnerId || ''),
        partnerName: String(row.partnerName || ''),
        participantIds: [p[0] ?? '', p[1] ?? ''] as [string, string],
        dowry: Number(row.dowry ?? 0),
        wifeShare: Number(row.wifeShare ?? 0),
        siteFee: Number(row.siteFee ?? 0),
        message: String(row.message || ''),
        status: (row.status as Marriage['status']) || 'pending',
        createdAt: normalizeAppDate(row, 'createdAt'),
        updatedAt: normalizeAppDate(row, 'updatedAt'),
      };
    },
    matchesRow: (m) => m.participantIds.includes(uid),
    onData: onUpdate,
  });
}

export async function proposeMarriage(
  _proposer: UserProfile,
  partner: UserProfile,
  dowry: number,
  _siteFeePercent: number,
  message: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'proposeMarriage', {
    partnerId: partner.uid,
    dowry,
    message,
  });
}

export async function respondMarriage(
  marriage: Marriage,
  _currentUid: string,
  accept: boolean
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'respondMarriage', {
    marriageId: marriage.id,
    accept,
  });
}

export async function divorceMarriage(
  marriage: Marriage,
  _currentUid: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'divorceMarriage', {
    marriageId: marriage.id,
  });
}

// ============================================================================
// 7. Topups, Reports, Appeals, Support Tickets & Admin Actions
// ============================================================================
export function subscribeToTopups(
  uid: string,
  isStaffUser: boolean,
  onUpdate: (list: TopupRequest[]) => void
): () => void {
  return subscribeToTableRows<TopupRequest>({
    tableId: APPWRITE_CONFIG.tables.topupRequests,
    queries: isStaffUser
      ? [Query.orderDesc('$createdAt'), Query.limit(100)]
      : [Query.equal('userId', uid), Query.orderDesc('$createdAt'), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      userId: String(row.userId || ''),
      userName: String(row.userName || ''),
      method: String(row.method || ''),
      amount: Number(row.amount ?? 0),
      coinsRequested: Number(row.coinsRequested ?? 0),
      reference: String(row.reference || ''),
      status: (row.status as TopupRequest['status']) || 'pending',
      adminNote: String(row.adminNote || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
      updatedAt: normalizeAppDate(row, 'updatedAt'),
    }),
    matchesRow: (item) => (isStaffUser ? true : item.userId === uid),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function submitTopupRequest(
  _user: UserProfile,
  input: { method: string; amount: number; coinsRequested: number; reference: string }
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'submitTopupRequest', input);
}

export async function reviewTopupRequest(
  reqItem: TopupRequest,
  approve: boolean,
  adminNote: string,
  _adminUid?: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'reviewTopupRequest', {
    requestId: reqItem.id,
    approve,
    adminNote,
  });
}

export function subscribeToSupportTickets(
  uid: string,
  isStaffUser: boolean,
  onUpdate: (list: SupportTicket[]) => void
): () => void {
  return subscribeToTableRows<SupportTicket>({
    tableId: APPWRITE_CONFIG.tables.supportTickets,
    queries: isStaffUser
      ? [Query.orderDesc('$createdAt'), Query.limit(100)]
      : [Query.equal('userId', uid), Query.orderDesc('$createdAt'), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      userId: String(row.userId || ''),
      userName: String(row.userName || ''),
      subject: String(row.subject || ''),
      message: String(row.message || ''),
      adminReply: String(row.adminReply || ''),
      status: (row.status as SupportTicket['status']) || 'open',
      createdAt: normalizeAppDate(row, 'createdAt'),
      updatedAt: normalizeAppDate(row, 'updatedAt'),
    }),
    matchesRow: (item) => (isStaffUser ? true : item.userId === uid),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function createSupportTicket(
  _user: UserProfile,
  subject: string,
  message: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'createSupportTicket', {
    subject,
    message,
  });
}

export async function replySupportTicket(
  ticket: SupportTicket,
  reply: string,
  status: 'answered' | 'closed'
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'replySupportTicket', {
    ticketId: ticket.id,
    reply,
    status,
  });
}

export function subscribeToReports(
  uid: string,
  isStaffUser: boolean,
  onUpdate: (list: ReportItem[]) => void
): () => void {
  return subscribeToTableRows<ReportItem>({
    tableId: APPWRITE_CONFIG.tables.reports,
    queries: isStaffUser
      ? [Query.orderDesc('$createdAt'), Query.limit(100)]
      : [Query.equal('reporterId', uid), Query.orderDesc('$createdAt'), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      reporterId: String(row.reporterId || ''),
      targetUid: String(row.targetUid || ''),
      targetName: String(row.targetName || ''),
      reason: String(row.reason || ''),
      details: String(row.details || ''),
      status: (row.status as ReportItem['status']) || 'open',
      adminNote: String(row.adminNote || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (item) => (isStaffUser ? true : item.reporterId === uid),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function submitReport(
  _reporterId: string,
  targetUid: string,
  targetName: string,
  reason: string,
  details: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'submitReport', {
    targetUid,
    targetName,
    reason,
    details,
  });
}

export async function reviewReport(
  report: ReportItem,
  status: 'resolved' | 'dismissed',
  adminNote: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'reviewReport', {
    reportId: report.id,
    status,
    adminNote,
  });
}

export function subscribeToAppeals(
  uid: string,
  isStaffUser: boolean,
  onUpdate: (list: AppealItem[]) => void
): () => void {
  return subscribeToTableRows<AppealItem>({
    tableId: APPWRITE_CONFIG.tables.appeals,
    queries: isStaffUser
      ? [Query.orderDesc('$createdAt'), Query.limit(100)]
      : [Query.equal('userId', uid), Query.orderDesc('$createdAt'), Query.limit(30)],
    mapRow: (row) => ({
      id: String(row.$id),
      userId: String(row.userId || ''),
      userName: String(row.userName || ''),
      reason: String(row.reason || ''),
      status: (row.status as AppealItem['status']) || 'pending',
      adminNote: String(row.adminNote || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (item) => (isStaffUser ? true : item.userId === uid),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function submitAppeal(_user: UserProfile, reason: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'submitAppeal', {
    reason,
  });
}

export async function reviewAppeal(
  appeal: AppealItem,
  accept: boolean,
  adminNote: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'reviewAppeal', {
    appealId: appeal.id,
    accept,
    adminNote,
  });
}

// ============================================================================
// 8. Admin Moderation & Store/Task Management
// ============================================================================
export async function adminUpdateUser(
  targetUid: string,
  updates: Partial<{
    role: UserRole;
    permissions: string[];
    isBanned: boolean;
    banReason: string;
    coins: number;
    badges: UserBadge[];
    vipTier: VipTier;
    displayName: string;
    username: string;
  }>
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'adminUpdateUser', {
    targetUid,
    updates,
  });
}

export async function adminReviewProposal(
  proposal: CreatorProposal,
  approve: boolean,
  adminReply: string,
  badgeDurationDays: number
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'adminReviewProposal', {
    proposalId: proposal.id,
    approve,
    adminReply,
    badgeDurationDays,
  });
}

export async function adminSaveStoreItem(item: StoreItem): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'adminSaveStoreItem', {
    item,
  });
}

export async function adminSaveDailyTask(task: DailyTask): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'adminSaveDailyTask', {
    task,
  });
}
