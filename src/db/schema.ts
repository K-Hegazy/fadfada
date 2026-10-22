import { pgTable, text, integer, bigint, timestamp, real } from 'drizzle-orm/pg-core';

// Users
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').notNull().default('user'),
  gender: text('gender').notNull(),
  country: text('country').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  bio: text('bio').default(''),
  avatarUrl: text('avatar_url').default(''),
  isBanned: integer('is_banned').default(0),
  banReason: text('ban_reason').default(''),
  isMuted: integer('is_muted').default(0),
  muteUntil: timestamp('mute_until'),
  vipLevel: text('vip_level').default('none'),
  vipExpiresAt: timestamp('vip_expires_at'),
  coins: bigint('coins', { mode: 'number' }).default(100),
  xp: integer('xp').default(0),
  level: integer('level').default(1),
  streak: integer('streak').default(1),
  lastLoginDate: text('last_login_date').default(''),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  isGuest: integer('is_guest').default(0),
  guestMessagesRemaining: integer('guest_messages_remaining').default(500),
  privacyMessages: text('privacy_messages').default('everyone'),
  privacyFriendRequests: text('privacy_friend_requests').default('everyone'),
  privacyStoryVisibility: text('privacy_story_visibility').default('everyone'),
  countryCode: text('country_code').default(''),
  detectedCountry: text('detected_country').default(''),
  displayName: text('display_name').default(''),
  coverUrl: text('cover_url').default(''),
  birthDate: text('birth_date').default(''),
  privacyProfileVisibility: text('privacy_profile_visibility').default('everyone'),
  privacyOnlineStatus: text('privacy_online_status').default('everyone'),
  privacyLastSeen: text('privacy_last_seen').default('everyone'),
  activityStatus: text('activity_status').default(''),
  email: text('email').default(''),
  emailVerified: integer('email_verified').default(0),
  emailVerifiedAt: timestamp('email_verified_at'),
  notificationSound: text('notification_sound').default('chime'),
  soundEnabled: integer('sound_enabled').default(1),
  termsAgreed: integer('terms_agreed').default(0),
  termsAgreedAt: timestamp('terms_agreed_at'),
  termsVersion: text('terms_version').default('1.0'),
  randomFreeUsed: integer('random_free_used').default(0),
  isPaidVerified: integer('is_paid_verified').default(0),
  paidVerifiedUntil: timestamp('paid_verified_until'),
  createdAt: timestamp('created_at').defaultNow()
});

// Sessions
export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  isOnline: integer('is_online').default(1),
  deviceInfo: text('device_info').default('متصفح الويب'),
  ipAddress: text('ip_address').default('')
});

// Rooms
export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  category: text('category').notNull(),
  isPrivate: integer('is_private').default(0),
  passwordHash: text('password_hash').default(''),
  rules: text('rules').default(''),
  imageUrl: text('image_url').default(''),
  createdBy: text('created_by').notNull(),
  isLocked: integer('is_locked').default(0),
  roomType: text('room_type').default('audio'),
  costPerMinute: integer('cost_per_minute').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Room Members
export const roomMembers = pgTable('room_members', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').default('member'),
  joinedAt: timestamp('joined_at').defaultNow(),
  isMuted: integer('is_muted').default(0),
  isBanned: integer('is_banned').default(0)
});

// Room Messages
export const roomMessages = pgTable('room_messages', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  senderId: text('sender_id').notNull(),
  content: text('content').notNull(),
  type: text('type').default('text'),
  replyToId: text('reply_to_id'),
  mediaUrl: text('media_url').default(''),
  giftId: text('gift_id'),
  createdAt: timestamp('created_at').defaultNow()
});

// Private Conversations
export const privateConversations = pgTable('private_conversations', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id').notNull(),
  user2Id: text('user2_id').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  unreadCountUser1: integer('unread_count_user1').default(0),
  unreadCountUser2: integer('unread_count_user2').default(0),
  isBlocked: integer('is_blocked').default(0),
  blockedBy: text('blocked_by'),
  createdAt: timestamp('created_at').defaultNow()
});

// Private Messages
export const privateMessages = pgTable('private_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  senderId: text('sender_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  content: text('content').notNull(),
  type: text('type').default('text'),
  mediaUrl: text('media_url').default(''),
  isRead: integer('is_read').default(0),
  isSelfDestruct: integer('is_self_destruct').default(0),
  destructDuration: integer('destruct_duration').default(0),
  readAt: timestamp('read_at'),
  expiresAt: timestamp('expires_at'),
  isViewOnce: integer('is_view_once').default(0),
  isViewed: integer('is_viewed').default(0),
  viewedAt: timestamp('viewed_at'),
  viewOnceToken: text('view_once_token').default(''),
  isEdited: integer('is_edited').default(0),
  editedAt: timestamp('edited_at'),
  isDeleted: integer('is_deleted').default(0),
  deletedForAll: integer('deleted_for_all').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Wallet Transactions
export const walletTransactions = pgTable('wallet_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  relatedUserId: text('related_user_id'),
  balanceBefore: bigint('balance_before', { mode: 'number' }).default(0),
  balanceAfter: bigint('balance_after', { mode: 'number' }).default(0),
  idempotencyKey: text('idempotency_key'),
  createdAt: timestamp('created_at').defaultNow()
});

// System Settings
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Cluster Events
export const clusterEvents = pgTable('cluster_events', {
  id: text('id').primaryKey(),
  channel: text('channel').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Coin Packages
export const coinPackages = pgTable('coin_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  coins: bigint('coins', { mode: 'number' }).notNull(),
  priceAmount: real('price_amount').notNull(),
  bonusCoins: integer('bonus_coins').default(0),
  currency: text('currency').default('EGP'),
  icon: text('icon').default('🪙'),
  badge: text('badge').default(''),
  color: text('color').default('from-neutral-800 to-neutral-900'),
  popular: integer('popular').default(0),
  isActive: integer('is_active').default(1),
  displayOrder: integer('display_order').default(0),
  imageUrl: text('image_url').default(''),
  createdAt: timestamp('created_at').defaultNow()
});

// VIP Plans
export const vipPlans = pgTable('vip_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  badge: text('badge').notNull(),
  color: text('color').notNull(),
  border: text('border').notNull(),
  textColor: text('text_color').notNull(),
  priceCoins: integer('price_coins').notNull(),
  days: integer('days').default(30),
  popular: integer('popular').default(0),
  isActive: integer('is_active').default(1),
  perksJson: text('perks_json').default('[]'),
  displayOrder: integer('display_order').default(0),
  imageUrl: text('image_url').default(''),
  createdAt: timestamp('created_at').defaultNow()
});

// Shop Items
export const shopItems = pgTable('shop_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  icon: text('icon').notNull(),
  priceCoins: integer('price_coins').notNull(),
  type: text('type').notNull(),
  category: text('category').default('distinctive'),
  durationHours: integer('duration_hours'),
  isActive: integer('is_active').default(1),
  displayOrder: integer('display_order').default(0),
  metadataJson: text('metadata_json').default('{}'),
  imageUrl: text('image_url').default(''),
  createdAt: timestamp('created_at').defaultNow()
});

// Gifts
export const gifts = pgTable('gifts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  priceCoins: integer('price_coins').notNull(),
  category: text('category').default('general'),
  soundEffect: text('sound_effect').default(''),
  animationType: text('animation_type').default('pop'),
  isActive: integer('is_active').default(1),
  displayOrder: integer('display_order').default(0),
  description: text('description').default(''),
  imageUrl: text('image_url').default(''),
  createdAt: timestamp('created_at').defaultNow()
});

// Gift Transactions
export const giftTransactions = pgTable('gift_transactions', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull(),
  recipientId: text('recipient_id'),
  giftId: text('gift_id').notNull(),
  roomId: text('room_id'),
  conversationId: text('conversation_id'),
  coinsPaid: integer('coins_paid').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Stories
export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  content: text('content').default(''),
  mediaUrl: text('media_url').default(''),
  type: text('type').default('text'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull()
});

// Story Views
export const storyViews = pgTable('story_views', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  viewerId: text('viewer_id').notNull(),
  viewedAt: timestamp('viewed_at').defaultNow()
});

// Story Ads
export const storyAds = pgTable('story_ads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').default(''),
  imageUrl: text('image_url').notNull(),
  linkUrl: text('link_url').default(''),
  isActive: integer('is_active').default(1),
  displayInterval: integer('display_interval').default(3),
  viewsCount: integer('views_count').default(0),
  clicksCount: integer('clicks_count').default(0),
  priority: integer('priority').default(1),
  createdAt: timestamp('created_at').defaultNow()
});

// Friendships & Requests
export const friendRequests = pgTable('friend_requests', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  respondedAt: timestamp('responded_at')
});

export const friendships = pgTable('friendships', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id').notNull(),
  user2Id: text('user2_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Blocks & Mutes
export const blocks = pgTable('blocks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  blockedUserId: text('blocked_user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const mutes = pgTable('mutes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  mutedUserId: text('muted_user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Reports
export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('pending'),
  adminNotes: text('admin_notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at')
});

// Notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link').default(''),
  isRead: integer('is_read').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Events & Participants
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  createdBy: text('created_by').notNull(),
  maxParticipants: integer('max_participants').default(100),
  imageUrl: text('image_url').default(''),
  status: text('status').default('upcoming'),
  location: text('location').default(''),
  timeDisplay: text('time_display').default(''),
  dateDisplay: text('date_display').default(''),
  createdAt: timestamp('created_at').defaultNow()
});

export const eventParticipants = pgTable('event_participants', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  userId: text('user_id').notNull(),
  joinedAt: timestamp('joined_at').defaultNow()
});

// Missions & Progress
export const missions = pgTable('missions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  actionType: text('action_type').notNull(),
  targetCount: integer('target_count').notNull(),
  xpReward: integer('xp_reward').notNull(),
  coinsReward: integer('coins_reward').notNull(),
  isActive: integer('is_active').default(1)
});

export const userMissionProgress = pgTable('user_mission_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  missionId: text('mission_id').notNull(),
  currentCount: integer('current_count').default(0),
  isCompleted: integer('is_completed').default(0),
  isClaimed: integer('is_claimed').default(0),
  dateKey: text('date_key').notNull()
});

// Truth or Dare & Games
export const truthOrDareItems = pgTable('truth_or_dare_items', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  question: text('question').notNull(),
  difficulty: text('difficulty').default('normal'),
  rewardXp: integer('reward_xp').default(15),
  rewardCoins: integer('reward_coins').default(10)
});

export const userGameRecords = pgTable('user_game_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  gameType: text('game_type').notNull(),
  resultSummary: text('result_summary').notNull(),
  rewardCoins: integer('reward_coins').default(0),
  rewardXp: integer('reward_xp').default(0),
  playedAt: timestamp('played_at').defaultNow()
});

// Terms Agreements
export const termsAgreements = pgTable('terms_agreements', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  guestSessionId: text('guest_session_id').default(''),
  isGuest: integer('is_guest').default(0),
  agreedAt: timestamp('agreed_at').defaultNow(),
  termsVersion: text('terms_version').default('1.0'),
  ipAddress: text('ip_address').default(''),
  userAgent: text('user_agent').default('')
});

// Platform Posts & Likes
export const platformPosts = pgTable('platform_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  imageUrl: text('image_url').default(''),
  authorId: text('author_id').notNull(),
  category: text('category').default('update'),
  isPinned: integer('is_pinned').default(0),
  viewsCount: integer('views_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const postLikes = pgTable('post_likes', {
  postId: text('post_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Site Suggestions
export const siteSuggestions = pgTable('site_suggestions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').default('new'),
  adminReply: text('admin_reply').default(''),
  adminReplyAt: timestamp('admin_reply_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// User Badges
export const userBadges = pgTable('user_badges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  badgeKey: text('badge_key').notNull(),
  badgeName: text('badge_name').notNull(),
  badgeIcon: text('badge_icon').notNull(),
  badgeDescription: text('badge_description').default(''),
  awardedBy: text('awarded_by').default(''),
  awardedAt: timestamp('awarded_at').defaultNow()
});

// User Inventory
export const userInventory = pgTable('user_inventory', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  itemId: text('item_id').notNull(),
  isEquipped: integer('is_equipped').default(0),
  purchasedAt: timestamp('purchased_at').defaultNow(),
  expiresAt: timestamp('expires_at')
});

// User Interests
export const userInterests = pgTable('user_interests', {
  userId: text('user_id').notNull(),
  interest: text('interest').notNull()
});

// Payment Orders
export const paymentOrders = pgTable('payment_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  packageId: text('package_id').notNull(),
  packageName: text('package_name').notNull(),
  coinsAmount: integer('coins_amount').notNull(),
  priceAmount: integer('price_amount').notNull(),
  currency: text('currency').default('EGP'),
  transferMethod: text('transfer_method').default('instapay'),
  senderName: text('sender_name').default(''),
  senderPhoneOrHandle: text('sender_phone_or_handle').default(''),
  transactionReference: text('transaction_reference').default(''),
  receiptNote: text('receipt_note').default(''),
  receiptImageUrl: text('receipt_image_url').default(''),
  status: text('status').default('pending'),
  adminNotes: text('admin_notes').default(''),
  reviewedBy: text('reviewed_by').default(''),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// Achievements & User Achievements
export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  xpReward: integer('xp_reward').notNull(),
  coinsReward: integer('coins_reward').notNull(),
  targetValue: integer('target_value').notNull()
});

export const userAchievements = pgTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  achievementId: text('achievement_id').notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow()
});

// Random Sessions & Settings
export const randomSessions = pgTable('random_sessions', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id').notNull(),
  user2Id: text('user2_id').notNull(),
  type: text('type').notNull(),
  isFree: integer('is_free').default(1),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds').default(0),
  coinsCharged: integer('coins_charged').default(0),
  status: text('status').default('active')
});

export const randomSettings = pgTable('random_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

// Reactions
export const roomReactions = pgTable('room_reactions', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const privateReactions = pgTable('private_reactions', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const privateMessageDeletions = pgTable('private_message_deletions', {
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Audio Speakers & Active Room Sessions
export const activeAudioSpeakers = pgTable('active_audio_speakers', {
  roomId: text('room_id').notNull(),
  userId: text('user_id').notNull(),
  isSpeaking: integer('is_speaking').default(0),
  isMuted: integer('is_muted').default(0),
  joinedAt: timestamp('joined_at').defaultNow()
});

export const roomActiveSessions = pgTable('room_active_sessions', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  userId: text('user_id').notNull(),
  roomType: text('room_type').default('audio'),
  costPerMinute: integer('cost_per_minute').default(0),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastBilledAt: timestamp('last_billed_at').defaultNow(),
  totalMinutes: integer('total_minutes').default(0),
  totalCoinsSpent: integer('total_coins_spent').default(0),
  status: text('status').default('active')
});

export const gameTransactions = pgTable('game_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  game: text('game').notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const emailVerifications = pgTable('email_verifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at')
});

export const passwordResets = pgTable('password_resets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at')
});
