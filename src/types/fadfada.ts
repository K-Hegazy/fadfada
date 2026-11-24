export type AppTimestamp = string | number | null;

export const SCHEMA_LIMITS = {
  UID_MAX_LENGTH: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  USERNAME_PATTERN: /^[a-zA-Z0-9_.]+$/,
  DISPLAY_NAME_MIN_LENGTH: 1,
  DISPLAY_NAME_MAX_LENGTH: 60,
  AVATAR_MAX_LENGTH: 500,
  BIO_MAX_LENGTH: 240,
  MESSAGE_MIN_LENGTH: 1,
  MESSAGE_MAX_LENGTH: 2000,
} as const;

export type UserRole = 'guest' | 'member' | 'moderator' | 'owner';
export type GenderType = 'unspecified' | 'male' | 'female';
export type MaritalStatusType = 'single' | 'engaged' | 'married' | 'complicated';
export type VipTier = 'none' | 'silver' | 'gold' | 'royal';
export type MessagePermission = 'everyone' | 'friends' | 'nobody';

export interface UserBadge {
  id: string;
  name: string;
  color: string;
  imageUrl?: string;
  expiresAt: number | null;
}

export interface UserPrivacySettings {
  messagePermission: MessagePermission;
  showOnline: boolean;
  soundNotifications: boolean;
  visualNotifications: boolean;
}

export interface UserProfile {
  uid: string;
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
  partnerUid: string;
  partnerName: string;
  affiliation: string;
  role: UserRole;
  permissions: string[];
  isBanned: boolean;
  banReason: string;
  level: number;
  xp: number;
  coins: number;
  lastClaimKey: string;
  giftsSentCount: number;
  giftsReceivedCount: number;
  likesCount: number;
  visitsCount: number;
  friendsCount: number;
  vipTier: VipTier;
  vipExpiresAt: number | null;
  frameId: string;
  nameColor: string;
  isNamePinned: boolean;
  unlockedFeatures: string[];
  badges: UserBadge[];
  ghostMode: boolean;
  hideLastSeen: boolean;
  privacy: UserPrivacySettings;
  isOnline: boolean;
  isAnonymous: boolean;
  acceptedTerms?: boolean;
  isPublic: boolean;
  freeMatchesUsedToday: number;
  lastMatchDate: string;
  dailyMessagesSent: number;
  lastMessageDate: string;
  createdAt: AppTimestamp;
  lastSeen: AppTimestamp;
}

export interface GuestEntryInput {
  displayName: string;
  age: number;
  gender: 'male' | 'female';
  acceptedTerms: boolean;
}

export type MessageStatus = 'sent' | 'delivered' | 'seen';
export type ConversationLastStatus = 'none' | MessageStatus;
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'gif'
  | 'gift'
  | 'contact'
  | 'screenshot_alert'
  | 'whisper';

export interface Conversation {
  id: string;
  participantA: string;
  participantB: string;
  participantIds: [string, string];
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageStatus: ConversationLastStatus;
  lastMessageAt: AppTimestamp;
  unreadCountA: number;
  unreadCountB: number;
  theme: string;
  pinnedMessageId: string;
  pinnedMessageText: string;
  archivedBy: string[];
  clearedAtA: number;
  clearedAtB: number;
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  participantIds: [string, string];
  type: MessageType;
  text: string;
  mediaUrl: string;
  replyToId: string;
  replyToText: string;
  reactions: Record<string, string[]>;
  isWhisper: boolean;
  whisperRevealed: boolean;
  expiresAt: number | null;
  isDeleted: boolean;
  editedAt: AppTimestamp;
  voiceDurationSec?: number;
  isViewOnce?: boolean;
  viewOnceConsumed?: boolean;
  status: MessageStatus;
  createdAt: AppTimestamp;
  seenAt: AppTimestamp;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  category: string;
  isOfficial: boolean;
  ownerId: string;
  ownerName: string;
  theme: string;
  pinnedMessage: string;
  memberIds: string[];
  activeCount: number;
  createdAt: AppTimestamp;
}

export interface SimpleMessage {
  id: string;
  roomId?: string;
  postId?: string;
  proposalId?: string;
  secretId?: string;
  sessionId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderVip?: VipTier | string;
  type?: MessageType;
  text: string;
  mediaUrl?: string;
  replyToId?: string;
  replyToText?: string;
  reactions?: Record<string, string[]>;
  editedAt?: AppTimestamp;
  isDeleted?: boolean;
  voiceDurationSec?: number;
  isViewOnce?: boolean;
  viewOnceViewedBy?: string[];
  createdAt: AppTimestamp;
}

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  type: 'text' | 'image' | 'video';
  text: string;
  mediaUrl: string;
  bgColor: string;
  viewerIds: string[];
  expiresAt: number;
  createdAt: AppTimestamp;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface WallPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorVip: string;
  text: string;
  imageUrl: string;
  pollQuestion: string;
  pollOptions: PollOption[];
  pollVoters: Record<string, string>;
  likedBy: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: AppTimestamp;
}

export interface CreatorProposal {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  category: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  adminReply: string;
  badgeDurationDays: number;
  likedBy: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: AppTimestamp;
}

export interface Secret {
  id: string;
  authorHash: string;
  alias: string;
  category: string;
  isLongStory: boolean;
  text: string;
  empathyCounts: { feel: number; pray: number; strength: number };
  empathyUsers: string[];
  commentsCount: number;
  createdAt: AppTimestamp;
}

export type StoreSection = 'vip' | 'feature' | 'frame' | 'badge' | 'gift';

export interface StoreItem {
  id: string;
  section: StoreSection;
  name: string;
  description: string;
  priceCoins: number;
  durationDays: number;
  code: string;
  color: string;
  imageUrl: string;
  isActive: boolean;
}

export interface DailyTask {
  id: string;
  key: string;
  title: string;
  description: string;
  rewardCoins: number;
  rewardXp: number;
  isActive: boolean;
}

export interface Shoutout {
  id: string;
  authorId: string;
  authorName: string;
  kind: 'user' | 'admin' | 'urgent';
  text: string;
  expiresAt: number;
  createdAt: AppTimestamp;
}

export interface Relationship {
  id: string;
  requesterId: string;
  recipientId: string;
  participantIds: [string, string];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface Marriage {
  id: string;
  proposerId: string;
  proposerName: string;
  partnerId: string;
  partnerName: string;
  participantIds: [string, string];
  dowry: number;
  wifeShare: number;
  siteFee: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'divorced';
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface ProfileVisit {
  id: string;
  profileUid: string;
  visitorUid: string;
  visitorName: string;
  visitorAvatar: string;
  visitedAt: AppTimestamp;
}

export type NotificationType =
  | 'message'
  | 'friend_request'
  | 'marriage'
  | 'gift'
  | 'support'
  | 'report'
  | 'appeal'
  | 'creator'
  | 'coins'
  | 'reward'
  | 'announcement';

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: AppTimestamp;
}

export type CoinTransactionType =
  | 'gift'
  | 'transfer'
  | 'purchase'
  | 'marriage'
  | 'reward'
  | 'topup'
  | 'room'
  | 'match'
  | 'megaphone'
  | 'admin';

export interface CoinTransaction {
  id: string;
  type: CoinTransactionType;
  senderId: string;
  recipientId: string;
  amount: number;
  recipientAmount: number;
  note: string;
  createdAt: AppTimestamp;
}

export interface TopupRequest {
  id: string;
  userId: string;
  userName: string;
  method: string;
  amount: number;
  coinsRequested: number;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetUid: string;
  targetName: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  adminNote: string;
  createdAt: AppTimestamp;
}

export interface AppealItem {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  adminNote: string;
  createdAt: AppTimestamp;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  message: string;
  adminReply: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface AdSlotConfig {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  targetUrl: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  accountInfo: string;
  rateCoinsPerUnit: number;
  currency: string;
  enabled: boolean;
}

export interface SiteSettings {
  id: string;
  guestDailyMessageLimit: number;
  roomCreationCost: number;
  randomMatchFreeDaily: number;
  randomMatchCost: number;
  randomMatchDurationSec: number;
  shoutoutCost: number;
  marriageSiteFeePercent: number;
  welcomePopupEnabled: boolean;
  welcomePopupTitle: string;
  welcomePopupBody: string;
  paymentMethods: PaymentMethodConfig[];
  ads: {
    header_banner: AdSlotConfig;
    sidebar_card: AdSlotConfig;
    feed_inline: AdSlotConfig;
  };
  siteLogoUrl?: string;
  updatedAt: AppTimestamp;
}

export interface MatchQueueEntry {
  uid: string;
  displayName: string;
  gender: GenderType;
  country: string;
  mode: 'text' | 'voice' | 'video';
  preferredGender: 'all' | 'male' | 'female';
  preferredCountry: string;
  status: 'waiting' | 'matched';
  sessionId: string;
  createdAt: AppTimestamp;
}

export interface MatchSession {
  id: string;
  participantIds: [string, string];
  mode: 'text' | 'voice' | 'video';
  status: 'active' | 'ended';
  endsAt: number;
  offer?: { type: string; sdp: string } | null;
  answer?: { type: string; sdp: string } | null;
  createdAt: AppTimestamp;
}

export const PRESENCE_TTL_MS = 150_000;
export type PresenceConnectionState = 'connecting' | 'connected' | 'offline';

export type ActiveNavSection =
  | 'chats'
  | 'online'
  | 'rooms'
  | 'wall'
  | 'random_match'
  | 'secrets'
  | 'creators'
  | 'store'
  | 'tasks'
  | 'leaderboards'
  | 'social'
  | 'settings'
  | 'admin';

export type ThemeMode = 'light' | 'dark';
