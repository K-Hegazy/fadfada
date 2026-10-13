export type Gender = 'female' | 'male';
export type UserRole = 'user' | 'moderator' | 'admin' | 'owner' | 'creator';
export type VipLevel = 'none' | 'bronze' | 'silver' | 'gold' | 'royal';

export interface User {
  id: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  role: UserRole;
  gender: Gender;
  country: string;
  countryCode?: string;
  detectedCountry?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  displayName?: string;
  dateOfBirth?: string;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  vipLevel: VipLevel;
  vipExpiresAt?: string | null;
  isGuest: boolean;
  guestMessagesRemaining?: number;
  referralCode?: string;
  isOnline?: boolean;
  activityStatus?: string;
  lastActiveAt?: string;
  isPinned?: boolean;
  pinExpiresAt?: string;
  equippedBadge?: string;
  equippedFrame?: string;
  hasCreatorBadge?: boolean;
  isPaidVerified?: boolean;
  paidVerifiedUntil?: string | null;
  unreadNotifications?: number;
  unreadMessages?: number;
  pendingFriendRequests?: number;
  notificationSound?: string;
  soundEnabled?: boolean;
  interests?: string[];
  privacy?: {
    messages: string;
    friendRequests: string;
    storyVisibility: string;
    profileVisibility?: string;
    onlineStatus?: string;
    lastSeen?: string;
  };
  media?: {
    autoDownloadImages?: boolean;
    autoDownloadVideo?: boolean;
    quality?: 'high' | 'normal' | 'data_saver';
    autoplayVideo?: boolean;
    defaultViewOnce?: boolean;
  };
}

export interface FriendUser {
  id: string;
  username: string;
  gender: Gender;
  country: string;
  avatarUrl?: string;
  bio?: string;
  level: number;
  vipLevel: VipLevel;
  isOnline: boolean;
  friendshipDate?: string;
}

export interface OnlineUserItem {
  id: string;
  username: string;
  role?: UserRole;
  gender: 'female' | 'male';
  country: string;
  bio?: string;
  avatarUrl?: string;
  level: number;
  vipLevel: string;
  isOnline: boolean;
  activityStatus?: string;
  lastActiveAt?: string;
  interests?: string[];
  isPinned?: boolean;
  equippedBadge?: string | null;
  equippedFrame?: string | null;
  hasCreatorBadge?: boolean;
  isPaidVerified?: boolean;
  paidVerifiedUntil?: string | null;
  isGuest?: boolean;
}

export interface FriendRequestItem {
  id: string;
  userId: string;
  username: string;
  gender: Gender;
  country: string;
  avatarUrl?: string;
  bio?: string;
  level: number;
  vipLevel: VipLevel;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'received' | 'sent';
  isOnline?: boolean;
}

export interface ConversationItem {
  id: string;
  recipient: {
    id: string;
    username: string;
    gender: Gender;
    country: string;
    avatarUrl?: string;
    vipLevel: VipLevel;
    isOnline: boolean;
  };
  lastMessage?: {
    content: string;
    type: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted?: boolean;
  users?: string[];
}

export interface MessageReplyInfo {
  id: string;
  senderId: string;
  senderUsername: string;
  content: string;
  type: string;
  mediaUrl?: string;
}

export interface PrivateMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'gift';
  mediaUrl?: string;
  isRead: boolean;
  isSelfDestruct: boolean;
  selfDestructDuration?: number;
  isDestroyed?: boolean;
  isViewOnce?: boolean;
  isViewed?: boolean;
  viewedAt?: string;
  status?: 'sending' | 'sent' | 'failed';
  createdAt: string;
  replyToId?: string | null;
  replyTo?: MessageReplyInfo | null;
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedForAll?: boolean;
  reactions?: MessageReaction[];
}

export type ShopItemType = 'badge' | 'pin_profile' | 'card_frame' | 'special_feature';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  priceCoins: number;
  type: ShopItemType;
  category: 'distinctive' | 'rare' | 'seasonal' | 'special' | 'features';
  durationHours?: number | null; // null = permanent
  isActive: boolean;
  displayOrder: number;
  isOwned?: boolean;
  isEquipped?: boolean;
  expiresAt?: string | null;
  metadata?: {
    badgeTag?: string;
    badgeColor?: string;
    frameStyle?: string;
    gradient?: string;
    [key: string]: any;
  };
  createdAt?: string;
}

export interface UserInventoryItem {
  id: string;
  userId: string;
  itemId: string;
  isEquipped: boolean;
  purchasedAt: string;
  expiresAt?: string | null;
  item: ShopItem;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  category: string;
  room_type?: 'audio' | 'video';
  roomType?: 'audio' | 'video';
  cost_per_minute?: number;
  costPerMinute?: number;
  is_private: number;
  rules?: string;
  image_url?: string;
  created_by: string;
  creator_username?: string;
  member_count?: number;
  active_participants_count?: number;
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  username?: string;
  sender_gender: Gender;
  gender?: Gender | string;
  sender_avatar?: string;
  sender_vip?: VipLevel;
  role?: string;
  content: string;
  type: string;
  media_url?: string;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  gender: Gender;
  content: string;
  media_url?: string;
  type: 'text' | 'image' | 'video';
  view_count: number;
  created_at: string;
  expires_at: string;
}

export interface SiteSuggestion {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'new' | 'under_review' | 'accepted' | 'implemented' | 'rejected';
  admin_reply?: string;
  admin_reply_at?: string;
  created_at: string;
  updated_at?: string;
  author_username?: string;
  author_email?: string;
  author_avatar?: string;
  author_gender?: string;
  author_role?: string;
  has_creator_badge?: number | boolean;
}

export interface LoginNotice {
  id?: string;
  enabled: boolean;
  title: string;
  content: string;
  frequency: 'always' | 'once_per_version';
  version: string;
  updated_at?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  coinsReward: number;
  targetCount: number;
  currentCount: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  coins_reward: number;
  isUnlocked?: boolean;
  unlockedAt?: string | null;
}

export interface Gift {
  id: string;
  name: string;
  arabic_name: string;
  icon: string;
  price_coins: number;
  category: string;
  animation: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  is_read: number;
  created_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime?: string | null;
  createdAt: string;
  createdBy: string;
  creatorName: string;
  creatorRole: string;
  maxParticipants: number;
  imageUrl?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  location?: string;
  timeDisplay?: string;
  dateDisplay?: string;
  participantsCount: number;
  isJoined?: boolean;
  participants?: Array<{
    id: string;
    username: string;
    avatarUrl?: string;
    role?: string;
    gender?: string;
    joinedAt: string;
  }>;
}

export interface PlatformPost {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  category: string;
  isPinned: boolean;
  viewsCount: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonusCoins: number;
  priceAmount: number;
  currency: string;
  icon: string;
  badge?: string;
  color?: string;
  popular?: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
}

