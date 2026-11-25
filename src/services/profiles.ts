import { APPWRITE_CONFIG, Query } from '../appwrite/config';
import { subscribeToSingleRow, subscribeToTableRows } from '../appwrite/realtime';
import {
  executeAppwriteFunction,
  getTableRow,
  normalizeAppDate,
  parseJsonField,
  type AppwriteRow,
} from '../appwrite/tables';
import {
  SCHEMA_LIMITS,
  type GenderType,
  type GuestEntryInput,
  type MaritalStatusType,
  type ProfileVisit,
  type UserBadge,
  type UserPrivacySettings,
  type UserProfile,
  type UserRole,
  type VipTier,
} from '../types/fadfada';
import type { AuthUser } from './auth';

const DEFAULT_PRIVACY: UserPrivacySettings = {
  messagePermission: 'everyone',
  showOnline: true,
  soundNotifications: true,
  visualNotifications: true,
};

export function mapUserRow(row: AppwriteRow): UserProfile {
  const uid = String(row.uid || row.$id);
  const badges = parseJsonField<UserBadge[]>(row.badgesJson ?? row.badges, []);
  const privacy = parseJsonField<Partial<UserPrivacySettings>>(row.privacyJson ?? row.privacy, {});
  const rawVipExpires = Number(row.vipExpiresAt ?? 0);

  return normalizeUserProfile({
    uid,
    username: String(row.username || `user_${uid.slice(0, 6)}`),
    displayName: String(row.displayName || 'عضو فضفضة'),
    avatar: String(row.avatar || ''),
    cover: String(row.cover || ''),
    bio: String(row.bio || ''),
    gender: (row.gender as GenderType) || 'unspecified',
    age: Number(row.age ?? 0),
    country: String(row.country ?? ''),
    countryFlag: String(row.countryFlag ?? ''),
    maritalStatus: (row.maritalStatus as MaritalStatusType) || 'single',
    partnerUid: String(row.partnerUid || ''),
    partnerName: String(row.partnerName || ''),
    affiliation: String(row.affiliation || ''),
    role: (row.role as UserRole) || 'member',
    permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
    isBanned: Boolean(row.isBanned),
    banReason: String(row.banReason || ''),
    level: Number(row.level ?? 1),
    xp: Number(row.xp ?? 0),
    coins: Number(row.coins ?? 0),
    lastClaimKey: String(row.lastClaimKey || ''),
    giftsSentCount: Number(row.giftsSentCount ?? 0),
    giftsReceivedCount: Number(row.giftsReceivedCount ?? 0),
    likesCount: Number(row.likesCount ?? 0),
    visitsCount: Number(row.visitsCount ?? 0),
    friendsCount: Number(row.friendsCount ?? 0),
    vipTier: (row.vipTier as VipTier) || 'none',
    vipExpiresAt: rawVipExpires > 0 ? rawVipExpires : null,
    frameId: String(row.frameId || 'none'),
    nameColor: String(row.nameColor || ''),
    isNamePinned: Boolean(row.isNamePinned),
    unlockedFeatures: Array.isArray(row.unlockedFeatures)
      ? (row.unlockedFeatures as string[])
      : [],
    badges: Array.isArray(badges) ? badges : [],
    ghostMode: Boolean(row.ghostMode),
    hideLastSeen: Boolean(row.hideLastSeen),
    privacy: {
      messagePermission: privacy.messagePermission ?? DEFAULT_PRIVACY.messagePermission,
      showOnline: privacy.showOnline ?? DEFAULT_PRIVACY.showOnline,
      soundNotifications: privacy.soundNotifications ?? DEFAULT_PRIVACY.soundNotifications,
      visualNotifications: privacy.visualNotifications ?? DEFAULT_PRIVACY.visualNotifications,
    },
    isOnline: Boolean(row.isOnline),
    isAnonymous: Boolean(row.isAnonymous),
    isPublic: row.isPublic !== false,
    freeMatchesUsedToday: Number(row.freeMatchesUsedToday ?? 0),
    lastMatchDate: String(row.lastMatchDate || ''),
    dailyMessagesSent: Number(row.dailyMessagesSent ?? 0),
    lastMessageDate: String(row.lastMessageDate || ''),
    createdAt: normalizeAppDate(row, 'createdAt'),
    lastSeen: normalizeAppDate(row, 'lastSeen'),
  });
}

export function normalizeUserProfile(raw: Partial<UserProfile> & { uid: string }): UserProfile {
  return {
    uid: raw.uid,
    username: raw.username ?? `user_${raw.uid.slice(0, 6)}`,
    displayName: raw.displayName ?? 'عضو فضفضة',
    avatar: raw.avatar ?? '',
    cover: raw.cover ?? '',
    bio: raw.bio ?? '',
    gender: raw.gender ?? 'unspecified',
    age: raw.age ?? 0,
    country: raw.country ?? '',
    countryFlag: raw.countryFlag ?? '',
    maritalStatus: raw.maritalStatus ?? 'single',
    partnerUid: raw.partnerUid ?? '',
    partnerName: raw.partnerName ?? '',
    affiliation: raw.affiliation ?? '',
    role: raw.role ?? 'member',
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    isBanned: Boolean(raw.isBanned),
    banReason: raw.banReason ?? '',
    level: raw.level ?? 1,
    xp: raw.xp ?? 0,
    coins: raw.coins ?? 0,
    lastClaimKey: raw.lastClaimKey ?? '',
    giftsSentCount: raw.giftsSentCount ?? 0,
    giftsReceivedCount: raw.giftsReceivedCount ?? 0,
    likesCount: raw.likesCount ?? 0,
    visitsCount: raw.visitsCount ?? 0,
    friendsCount: raw.friendsCount ?? 0,
    vipTier: raw.vipTier ?? 'none',
    vipExpiresAt: raw.vipExpiresAt ?? null,
    frameId: raw.frameId ?? 'none',
    nameColor: raw.nameColor ?? '',
    isNamePinned: Boolean(raw.isNamePinned),
    unlockedFeatures: Array.isArray(raw.unlockedFeatures) ? raw.unlockedFeatures : [],
    badges: Array.isArray(raw.badges) ? raw.badges : [],
    ghostMode: Boolean(raw.ghostMode),
    hideLastSeen: Boolean(raw.hideLastSeen),
    privacy: {
      messagePermission: raw.privacy?.messagePermission ?? 'everyone',
      showOnline: raw.privacy?.showOnline ?? true,
      soundNotifications: raw.privacy?.soundNotifications ?? true,
      visualNotifications: raw.privacy?.visualNotifications ?? true,
    },
    isOnline: Boolean(raw.isOnline),
    isAnonymous: Boolean(raw.isAnonymous),
    acceptedTerms: Boolean(raw.acceptedTerms),
    isPublic: raw.isPublic ?? true,
    freeMatchesUsedToday: raw.freeMatchesUsedToday ?? 0,
    lastMatchDate: raw.lastMatchDate ?? '',
    dailyMessagesSent: raw.dailyMessagesSent ?? 0,
    lastMessageDate: raw.lastMessageDate ?? '',
    createdAt: raw.createdAt ?? null,
    lastSeen: raw.lastSeen ?? null,
  };
}

export async function ensureUserProfile(
  _user?: AuthUser,
  options?: { guestProfile?: GuestEntryInput; acceptedTerms?: boolean }
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'ensureProfile', {
    ...(options?.guestProfile ? { guestProfile: options.guestProfile } : {}),
    ...(options?.acceptedTerms !== undefined ? { acceptedTerms: options.acceptedTerms } : {}),
  });
}

export interface ProfileUpdateInput {
  username: string;
  displayName: string;
  avatar: string;
  cover: string;
  bio: string;
  gender: GenderType;
  age: number;
  country: string;
  countryFlag: string;
  maritalStatus: MaritalStatusType;
  affiliation: string;
}

export function validateProfileInput(input: ProfileUpdateInput): string | null {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();

  if (
    username.length < SCHEMA_LIMITS.USERNAME_MIN_LENGTH ||
    username.length > SCHEMA_LIMITS.USERNAME_MAX_LENGTH ||
    !SCHEMA_LIMITS.USERNAME_PATTERN.test(username)
  ) {
    return 'اسم المستخدم يجب أن يكون بين 3 و30 حرفًا (أحرف إنجليزية، أرقام، _ أو . فقط).';
  }
  if (
    displayName.length < SCHEMA_LIMITS.DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > SCHEMA_LIMITS.DISPLAY_NAME_MAX_LENGTH
  ) {
    return 'الاسم الظاهر يجب أن يكون بين 1 و60 حرفًا.';
  }
  if (bio.length > SCHEMA_LIMITS.BIO_MAX_LENGTH) {
    return `النبذة التعريفية لا يجب أن تتجاوز ${SCHEMA_LIMITS.BIO_MAX_LENGTH} حرفًا.`;
  }
  if (input.age < 0 || input.age > 120) {
    return 'العمر غير صالح.';
  }
  return null;
}

export async function updateUserProfile(_uid: string, input: ProfileUpdateInput): Promise<void> {
  const validationError = validateProfileInput(input);
  if (validationError) throw new Error(validationError);

  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'updateProfile', {
    username: input.username.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    avatar: input.avatar.trim().slice(0, 500),
    cover: input.cover.trim().slice(0, 500),
    bio: input.bio.trim(),
    gender: input.gender,
    age: Math.floor(input.age),
    country: input.country.trim().slice(0, 60),
    countryFlag: input.countryFlag.trim().slice(0, 16),
    maritalStatus: input.maritalStatus,
    affiliation: input.affiliation.trim().slice(0, 60),
  });
}

export async function updateUserPrivacy(
  _uid: string,
  updates: {
    ghostMode: boolean;
    hideLastSeen: boolean;
    privacy: UserPrivacySettings;
    isPublic: boolean;
  }
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'updatePrivacy', {
    ghostMode: updates.ghostMode,
    hideLastSeen: updates.hideLastSeen,
    privacy: updates.privacy,
    isPublic: updates.isPublic,
  });
}

export async function awardActivityXp(
  _uid: string,
  _currentXp: number,
  deltaXp: number
): Promise<void> {
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'awardActivityXp', {
      deltaXp,
    });
  } catch {
    // Non-blocking XP progression
  }
}

export async function consumeGuestMessageQuota(
  user: UserProfile,
  dailyLimit: number
): Promise<void> {
  if ((user.role !== 'guest' && !user.isAnonymous) || dailyLimit <= 0) return;
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'consumeGuestQuota');
}

export async function syncAppwritePresence(_uid: string, isOnline: boolean): Promise<void> {
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'syncPresence', {
      isOnline,
    });
  } catch {
    // Ignore initial race before profile creation
  }
}

export async function deleteGuestAccount(): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'deleteGuestAccount');
}

export async function likeUserProfile(targetUid: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'likeProfile', {
    targetUid,
  });
}

export async function recordProfileVisit(
  profileUid: string,
  visitor: UserProfile
): Promise<void> {
  if (!visitor.uid || visitor.uid === profileUid || visitor.ghostMode) return;
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'recordProfileVisit', {
      profileUid,
    });
  } catch {
    // Non-blocking visit logging
  }
}

export function subscribeToProfileVisits(
  profileUid: string,
  onData: (visits: ProfileVisit[]) => void
): () => void {
  return subscribeToTableRows<ProfileVisit>({
    tableId: APPWRITE_CONFIG.tables.profileVisits,
    queries: [Query.equal('profileUid', profileUid), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      profileUid: String(row.profileUid || ''),
      visitorUid: String(row.visitorUid || ''),
      visitorName: String(row.visitorName || ''),
      visitorAvatar: String(row.visitorAvatar || ''),
      visitedAt: normalizeAppDate(row, 'visitedAt'),
    }),
    matchesRow: (item) => item.profileUid === profileUid,
    onData,
  });
}

export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToSingleRow<UserProfile>({
    tableId: APPWRITE_CONFIG.tables.users,
    rowId: uid,
    fetchRow: async () => {
      const row = await getTableRow(APPWRITE_CONFIG.tables.users, uid);
      return row ? mapUserRow(row) : null;
    },
    mapRow: mapUserRow,
    onData,
    onError,
  });
}

export function subscribeToPublicUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (error: Error) => void,
  includeAllForAdmin = false
): () => void {
  return subscribeToTableRows<UserProfile>({
    tableId: APPWRITE_CONFIG.tables.users,
    queries: includeAllForAdmin
      ? [Query.orderDesc('$updatedAt'), Query.limit(250)]
      : [Query.equal('isPublic', true), Query.orderDesc('$updatedAt'), Query.limit(200)],
    mapRow: mapUserRow,
    getKey: (u) => u.uid,
    matchesRow: (u) => (includeAllForAdmin ? true : u.isPublic),
    onData,
    onError,
  });
}
