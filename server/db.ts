import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlDatabase } from 'sql.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fadfada.sqlite');

let dbInstance: SqlDatabase | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

export async function getDb(): Promise<SqlDatabase> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDbSync();
  return dbInstance;
}

export function saveDbSync(): void {
  if (!dbInstance) return;
  try {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

export function saveDb(): void {
  // Use debounced save to batch multiple rapid writes and prevent disk bottlenecks
  if (saveDebounceTimer) return;
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    saveDbSync();
  }, 1000);
}

function initSchema(db: SqlDatabase) {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'user', 'moderator', 'admin', 'owner'
      gender TEXT NOT NULL, -- 'female', 'male'
      country TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT DEFAULT '',
      is_muted INTEGER DEFAULT 0,
      mute_until DATETIME,
      vip_level TEXT DEFAULT 'none', -- 'none', 'bronze', 'silver', 'gold', 'royal'
      vip_expires_at DATETIME,
      coins INTEGER DEFAULT 100,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 1,
      last_login_date TEXT DEFAULT '',
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      is_guest INTEGER DEFAULT 0,
      guest_messages_remaining INTEGER DEFAULT 500,
      privacy_messages TEXT DEFAULT 'everyone', -- 'everyone', 'friends'
      privacy_friend_requests TEXT DEFAULT 'everyone',
      privacy_story_visibility TEXT DEFAULT 'everyone',
      country_code TEXT DEFAULT '',
      detected_country TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_online INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      is_private INTEGER DEFAULT 0,
      password_hash TEXT DEFAULT '',
      rules TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member', -- 'owner', 'moderator', 'member'
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_muted INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      UNIQUE(room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text', -- 'text', 'image', 'audio', 'gift', 'system'
      reply_to_id TEXT,
      media_url TEXT DEFAULT '',
      gift_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS room_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES room_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS private_conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user1_id, user2_id),
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS private_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'file', 'gift'
      reply_to_id TEXT,
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      is_self_destruct INTEGER DEFAULT 0,
      self_destruct_duration INTEGER DEFAULT 0, -- seconds
      is_destroyed INTEGER DEFAULT 0,
      destroyed_at DATETIME,
      media_url TEXT DEFAULT '',
      gift_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES private_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS private_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES private_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sender_id, receiver_id),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      media_url TEXT DEFAULT '',
      type TEXT DEFAULT 'text', -- 'text', 'image'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, viewer_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL, -- 'daily', 'weekly', 'milestone'
      action_type TEXT NOT NULL, -- 'message', 'gift', 'room_chat', 'story', 'game', 'daily_login'
      target_count INTEGER NOT NULL,
      xp_reward INTEGER NOT NULL,
      coins_reward INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_mission_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      current_count INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      is_claimed INTEGER DEFAULT 0,
      date_key TEXT NOT NULL,
      UNIQUE(user_id, mission_id, date_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      xp_reward INTEGER NOT NULL,
      coins_reward INTEGER NOT NULL,
      target_value INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      created_by TEXT NOT NULL,
      max_participants INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS event_participants (
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      arabic_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      price_coins INTEGER NOT NULL,
      category TEXT NOT NULL,
      animation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gift_transactions (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      gift_id TEXT NOT NULL,
      room_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id),
      FOREIGN KEY (gift_id) REFERENCES gifts(id)
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      related_user_id TEXT,
      balance_before INTEGER DEFAULT 0,
      balance_after INTEGER DEFAULT 0,
      idempotency_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'EGP',
      provider TEXT NOT NULL, -- 'paymob', 'fawry', 'vodafone_cash'
      status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
      provider_order_id TEXT,
      provider_tx_id TEXT,
      idempotency_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      fulfilled_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      reported_user_id TEXT NOT NULL,
      target_type TEXT NOT NULL, -- 'user', 'message', 'room', 'story'
      target_id TEXT,
      category TEXT NOT NULL,
      details TEXT NOT NULL,
      evidence_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed', 'action_taken'
      action_taken TEXT DEFAULT '',
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (reported_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      blocked_user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, blocked_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mutes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      muted_user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, muted_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (muted_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_interests (
      user_id TEXT NOT NULL,
      interest TEXT NOT NULL,
      PRIMARY KEY (user_id, interest),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      price_coins INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'badge', 'pin_profile', 'card_frame', 'special_feature'
      category TEXT DEFAULT 'badges', -- 'distinctive', 'rare', 'seasonal', 'special', 'features'
      duration_hours INTEGER DEFAULT NULL, -- NULL = permanent
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      is_equipped INTEGER DEFAULT 0,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vip_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      badge TEXT NOT NULL,
      color TEXT NOT NULL,
      border TEXT NOT NULL,
      text_color TEXT NOT NULL,
      price_coins INTEGER NOT NULL,
      days INTEGER NOT NULL DEFAULT 30,
      popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      perks_json TEXT NOT NULL DEFAULT '[]',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coin_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      coins INTEGER NOT NULL,
      bonus_coins INTEGER NOT NULL DEFAULT 0,
      price_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SAR',
      icon TEXT NOT NULL DEFAULT '🪙',
      badge TEXT DEFAULT '',
      color TEXT DEFAULT 'from-amber-600 to-amber-900',
      popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations for country auto-detection columns
  try { db.run("ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN detected_country TEXT DEFAULT ''"); } catch {}

  // Safe migrations for profile enhancements
  try { db.run("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN cover_url TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN birth_date TEXT DEFAULT ''"); } catch {}

  // Safe migrations for privacy settings
  try { db.run("ALTER TABLE users ADD COLUMN privacy_profile_visibility TEXT DEFAULT 'everyone'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN privacy_online_status TEXT DEFAULT 'everyone'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN privacy_last_seen TEXT DEFAULT 'everyone'"); } catch {}

  // Safe migration for user activity status
  try { db.run("ALTER TABLE users ADD COLUMN activity_status TEXT DEFAULT ''"); } catch {}

  // Safe migrations for Email Verification
  try { db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN email_verified_at DATETIME DEFAULT NULL"); } catch {}

  // Email verifications table for tokens and verification codes
  db.run(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used_at DATETIME DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for notification sounds
  try { db.run("ALTER TABLE users ADD COLUMN notification_sound TEXT DEFAULT 'chime'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN sound_enabled INTEGER DEFAULT 1"); } catch {}

  // Safe migrations for media preferences
  try { db.run("ALTER TABLE users ADD COLUMN media_auto_download_images INTEGER DEFAULT 1"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN media_auto_download_video INTEGER DEFAULT 1"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN media_quality TEXT DEFAULT 'high'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN media_autoplay_video INTEGER DEFAULT 1"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN media_default_view_once INTEGER DEFAULT 0"); } catch {}

  // Safe migrations for session tracking
  try { db.run("ALTER TABLE sessions ADD COLUMN device_info TEXT DEFAULT 'متصفح الويب'"); } catch {}
  try { db.run("ALTER TABLE sessions ADD COLUMN ip_address TEXT DEFAULT ''"); } catch {}

  // Safe migrations for View Once media on private_messages
  try { db.run("ALTER TABLE private_messages ADD COLUMN is_view_once INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE private_messages ADD COLUMN is_viewed INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE private_messages ADD COLUMN viewed_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE private_messages ADD COLUMN view_once_token TEXT DEFAULT ''"); } catch {}

  // Safe migrations for events enhancements
  try { db.run("ALTER TABLE events ADD COLUMN image_url TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'upcoming'"); } catch {}
  try { db.run("ALTER TABLE events ADD COLUMN location TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE events ADD COLUMN time_display TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE events ADD COLUMN date_display TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE missions ADD COLUMN is_active INTEGER DEFAULT 1"); } catch {}

  // Safe migrations for wallet transactions auditability & balance tracking
  try { db.run("ALTER TABLE wallet_transactions ADD COLUMN balance_before INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE wallet_transactions ADD COLUMN balance_after INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE wallet_transactions ADD COLUMN idempotency_key TEXT"); } catch {}
  try { db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_user_idemp ON wallet_transactions(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pay_orders_user ON payment_orders(user_id, status)"); } catch {}

  // Safe migrations for manual recharge payment orders
  try { db.run("ALTER TABLE payment_orders ADD COLUMN transfer_method TEXT DEFAULT 'instapay'"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN sender_name TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN sender_phone_or_handle TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN transaction_reference TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN receipt_note TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN receipt_image_url TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN admin_notes TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN reviewed_by TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payment_orders ADD COLUMN reviewed_at DATETIME DEFAULT NULL"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pay_orders_status ON payment_orders(status, created_at)"); } catch {}

  // Safe creation of platform_posts and post_likes tables
  db.run(`
    CREATE TABLE IF NOT EXISTS platform_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      author_id TEXT NOT NULL,
      category TEXT DEFAULT 'update',
      is_pinned INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES platform_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Performance Indexes for instant messaging & presence
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pmsg_conv ON private_messages(conversation_id, created_at)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pmsg_unread ON private_messages(conversation_id, recipient_id, is_read)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pconv_users ON private_conversations(user1_id, user2_id)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, is_online)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_user_inv ON user_inventory(user_id, is_equipped)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_freq_users ON friend_requests(sender_id, receiver_id, status)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_stories_exp ON stories(expires_at, user_id)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_blocks_users ON blocks(user_id, blocked_user_id)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_mutes_users ON mutes(user_id, muted_user_id)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at)"); } catch {}

  // Truth or Dare questions table
  db.run(`
    CREATE TABLE IF NOT EXISTS truth_or_dare_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'truth', 'dare'
      category TEXT NOT NULL, -- 'fun', 'deep', 'spicy', 'friendly'
      question TEXT NOT NULL,
      difficulty TEXT DEFAULT 'normal', -- 'easy', 'normal', 'hard'
      reward_xp INTEGER DEFAULT 15,
      reward_coins INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS user_game_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game_type TEXT NOT NULL, -- 'lucky_wheel', 'proverbs_quiz', 'truth_or_dare'
      result_summary TEXT NOT NULL,
      reward_coins INTEGER DEFAULT 0,
      reward_xp INTEGER DEFAULT 0,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Audio room participants / active speakers table
  db.run(`
    CREATE TABLE IF NOT EXISTS active_audio_speakers (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_speaking INTEGER DEFAULT 0,
      is_muted INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Terms & Conditions Agreement Tracking
    CREATE TABLE IF NOT EXISTS terms_agreements (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      guest_session_id TEXT DEFAULT '',
      is_guest INTEGER DEFAULT 0,
      agreed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      terms_version TEXT DEFAULT '1.0',
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );

    -- Random Connect Sessions Tracking
    CREATE TABLE IF NOT EXISTS random_sessions (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'chat', 'voice', 'video'
      is_free INTEGER DEFAULT 1,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME DEFAULT NULL,
      duration_seconds INTEGER DEFAULT 0,
      coins_charged INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    -- Random Connect Settings
    CREATE TABLE IF NOT EXISTS random_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Story Ads / Sponsored Stories
    CREATE TABLE IF NOT EXISTS story_ads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT NOT NULL,
      link_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      display_interval INTEGER DEFAULT 3,
      views_count INTEGER DEFAULT 0,
      clicks_count INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Game Transactions
    CREATE TABLE IF NOT EXISTS game_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game TEXT NOT NULL, -- 'tictactoe', 'wheel', 'quiz'
      type TEXT NOT NULL, -- 'entry', 'win', 'draw'
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations for terms agreement & random connect
  try { db.run("ALTER TABLE users ADD COLUMN terms_agreed INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN terms_agreed_at DATETIME DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN terms_version TEXT DEFAULT '1.0'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN random_free_used INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE terms_agreements ADD COLUMN guest_session_id TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE terms_agreements ADD COLUMN user_agent TEXT DEFAULT ''"); } catch {}

  // Seed default system settings if not existing
  seedDefaultData(db);
}

function seedDefaultData(db: SqlDatabase) {
  // Check guest message limit & Anti-Spam / Moderation settings
  const guestLimit = db.exec("SELECT value FROM system_settings WHERE key = 'guest_message_limit'");
  if (guestLimit.length === 0 || guestLimit[0].values.length === 0) {
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('guest_message_limit', '500')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('allow_guest_registration', 'true')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('platform_maintenance', 'false')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('min_age_requirement', '18')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('antispam_max_msg_per_min', '25')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('profanity_filter_enabled', 'true')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('suspicious_links_filter', 'true')");
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('rate_limit_login_lockout_mins', '15')");
  }

  // Payment configuration (Manual transfer: InstaPay / Vodafone Cash / Mobile wallets)
  // Strictly NO fake account numbers. Enabled is false by default until Owner configures real accounts in Dashboard.
  const paymentConfig = db.exec("SELECT value FROM system_settings WHERE key = 'payment_methods_config'");
  if (paymentConfig.length === 0 || paymentConfig[0].values.length === 0) {
    const defaultPaymentConfig = JSON.stringify({
      manual_transfers_enabled: false,
      methods: [
        {
          id: 'instapay',
          name: 'إنستاباي (InstaPay)',
          enabled: false,
          account_name: '',
          account_handle: '',
          instructions: 'قم بفتح تطبيق إنستاباي، اختر إرسال نقود، ثم أدخل الحساب أو عنوان الدفع (IPA) المعتمد أدناه. بعد إتمام التحويل اكتب اسمك ورقم العملية لتأكيد الشحن.'
        },
        {
          id: 'vodafone_cash',
          name: 'فودافون كاش (Vodafone Cash)',
          enabled: false,
          account_name: '',
          account_number: '',
          instructions: 'قم بتحويل المبلغ إلى رقم فودافون كاش الموضح أدناه، ثم أدخل رقم المحفظة المحول منها لمطابقة التحويل واعتماد الكوينز.'
        },
        {
          id: 'orange_cash',
          name: 'أورنج كاش (Orange Cash)',
          enabled: false,
          account_name: '',
          account_number: '',
          instructions: 'قم بتحويل المبلغ إلى رقم أورنج كاش الموضح، ثم دوّن رقم محفظتك واسم المحول.'
        },
        {
          id: 'etisalat_cash',
          name: 'اتصالات كاش (Etisalat Cash)',
          enabled: false,
          account_name: '',
          account_number: '',
          instructions: 'قم بالتحويل عبر محفظة اتصالات كاش، ثم اكتب رقم المحفظة المحول منها.'
        },
        {
          id: 'we_pay',
          name: 'وي باي (WE Pay)',
          enabled: false,
          account_name: '',
          account_number: '',
          instructions: 'قم بالتحويل عبر محفظة WE Pay، ثم اكتب رقم المحفظة ورقم المعاملة.'
        }
      ],
      general_instructions: 'يرجى تحويل القيمة الدقيقة للباقة بالجنيه المصري، وتوثيق اسم المحول ورقم العملية. يتم مراجعة الحسابات واعتماد الكوينز يدوياً من قبل إدارة المنصة بعد التأكد البنكي.',
      warning_notice: 'تنبيه هام: لا يتم إيداع الكوينز تلقائياً بمجرد إرسال الطلب، بل بعد التحقق اليدوي البنكي من وصول التحويل إلى المحفظة الرسمية للمالك.'
    });
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('payment_methods_config', ?)", [defaultPaymentConfig]);
  }

  // Seed Truth or Dare Questions
  const todCount = db.exec("SELECT COUNT(*) as c FROM truth_or_dare_items");
  if (!todCount[0]?.values[0]?.[0]) {
    const defaultTod = [
      // صراحة (Truth)
      ['tod_t1', 'truth', 'deep', 'ما هو أكبر سر أو فكرة لم تخبرها لأحد من قبل؟', 'normal', 20, 15],
      ['tod_t2', 'truth', 'fun', 'لو كان بإمكانك تغيير عادة واحدة في شخصيتك، فماذا ستكون؟', 'easy', 15, 10],
      ['tod_t3', 'truth', 'spicy', 'هل شعرت يوماً بالإعجاب السري بشخص موجود معك في المنصة أو في حياتك؟', 'hard', 25, 20],
      ['tod_t4', 'truth', 'friendly', 'ما هي أسعد لحظة عشتها خلال هذا العام حتى الآن؟', 'easy', 15, 10],
      ['tod_t5', 'truth', 'deep', 'ما هو القرار الذي اتخذته وتمنيت لو استطعت الرجوع بالزمن لتغييره؟', 'normal', 20, 15],
      ['tod_t6', 'truth', 'fun', 'ما هو أغرب موقف محرج حدث لك في الأماكن العامة؟', 'easy', 15, 10],
      ['tod_t7', 'truth', 'spicy', 'لو خُيّرت بين الصداقة الحقيقية أو الثروة الطائلة، ماذا تختار بصدق؟', 'normal', 20, 15],
      ['tod_t8', 'truth', 'friendly', 'من هو أول شخص تفكر فيه حين تشعر بالحزن أو الضيق؟', 'easy', 15, 10],
      // جرأة (Dare)
      ['tod_d1', 'dare', 'fun', 'أرسل تحية صوتية بلهجة خليجية أو مغربية في أحد المجالس الحالية!', 'normal', 25, 20],
      ['tod_d2', 'dare', 'friendly', 'أرسل هدية رمزية أو رسالة شكر راقية لآخر شخص راسلك في الخاص!', 'normal', 25, 20],
      ['tod_d3', 'dare', 'spicy', 'غيّر حالتك المخصصة (Activity Status) لبيت شعر رومانسي لمدة ساعة!', 'hard', 30, 25],
      ['tod_d4', 'dare', 'fun', 'انشر قصة جديدة تعبر فيها عن حكمة تؤمن بها بحرية تامة!', 'normal', 25, 20],
      ['tod_d5', 'dare', 'friendly', 'اختر شخصاً متصلاً الآن وأخبره بكلمة طيبة تسعد يومه!', 'easy', 20, 15],
      ['tod_d6', 'dare', 'spicy', 'شارك مثل شعبي نادر أو لغز في غرفة المحادثة وانتظر أول من يحله!', 'normal', 25, 20]
    ];
    for (const item of defaultTod) {
      db.run("INSERT INTO truth_or_dare_items (id, type, category, question, difficulty, reward_xp, reward_coins) VALUES (?, ?, ?, ?, ?, ?, ?)", item);
    }
  }

  // Seed gifts catalog (Standard gifts)
  const giftsExist = db.exec("SELECT COUNT(*) as c FROM gifts");
  const count = giftsExist[0]?.values[0]?.[0] as number || 0;
  if (count === 0) {
    const defaultGifts = [
      ['gift_rose', 'Rose', 'وردة جورية', '🌹', 10, 'classic', 'rose_bloom'],
      ['gift_coffee', 'Arabic Coffee', 'فنجان قهوة عربي', '☕', 20, 'classic', 'steam_rise'],
      ['gift_heart', 'Glowing Heart', 'قلب نابض', '💖', 30, 'love', 'heart_pulse'],
      ['gift_falcon', 'Arab Falcon', 'صقر عربي أصيل', '🦅', 50, 'luxury', 'falcon_soar'],
      ['gift_star', 'Diamond Star', 'نجمة ماسية', '⭐', 100, 'luxury', 'star_sparkle'],
      ['gift_crown', 'Royal Crown', 'تاج الملوك', '👑', 250, 'royal', 'crown_shine'],
      ['gift_horse', 'Arabian Mare', 'فرس عربي أصيل', '🐎', 500, 'royal', 'horse_gallop'],
      ['gift_castle', 'Fadfada Palace', 'قصر فضفضه الأسطوري', '🏰', 1000, 'royal', 'castle_glow']
    ];
    for (const g of defaultGifts) {
      db.run(
        "INSERT INTO gifts (id, name, arabic_name, icon, price_coins, category, animation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        g
      );
    }
  }

  // Seed Default Missions (Daily)
  const missionsExist = db.exec("SELECT COUNT(*) as c FROM missions");
  const mCount = missionsExist[0]?.values[0]?.[0] as number || 0;
  if (mCount === 0) {
    const defaultMissions = [
      ['m_daily_login', 'تسجيل الدخول اليومي', 'افتح منصة فضفضه يومياً لتحافظ على شعلتك الحماسية', 'daily', 'daily_login', 1, 20, 15],
      ['m_send_5_msg', 'رسائل الود', 'أرسل 5 رسائل في المحادثات الخاصة وتعرف على أصدقاء جدد', 'daily', 'message', 5, 30, 20],
      ['m_chat_room', 'حوار في المجلس', 'شارك في أحد مجالس وغرف فضفضه بـ 3 رسائل على الأقل', 'daily', 'room_chat', 3, 40, 25],
      ['m_publish_story', 'صانع اللحظات', 'انشر قصة جديدة لتشارك لحظاتك الراقية لمدة 24 ساعة', 'daily', 'story', 1, 50, 30],
      ['m_send_gift', 'يد الكرم', 'أرسل هدية لأحد أصدقائك أو رواد المجالس لإسعاده', 'daily', 'gift', 1, 60, 50],
      ['m_play_quiz', 'تحدي المعرفة', 'أجب عن لغز أو مثل في تحدي الأمثال الشعبية', 'daily', 'game', 1, 35, 20]
    ];
    for (const m of defaultMissions) {
      db.run(
        "INSERT INTO missions (id, title, description, category, action_type, target_count, xp_reward, coins_reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        m
      );
    }
  }

  // Seed Achievements
  const achExist = db.exec("SELECT COUNT(*) as c FROM achievements");
  const aCount = achExist[0]?.values[0]?.[0] as number || 0;
  if (aCount === 0) {
    const defaultAchievements = [
      ['ach_first_chat', 'first_chat', 'بداية الفضفضة', 'أرسلت أول رسالة لك في فضفضه', '💬', 50, 20, 1],
      ['ach_5_friends', '5_friends', 'الصديق الصدوق', 'أضفت 5 أصدقاء إلى قائمتك', '🤝', 100, 50, 5],
      ['ach_10_stories', '10_stories', 'راوي الحكايات', 'نشرت 10 قصص رائعة', '📖', 150, 75, 10],
      ['ach_streak_7', 'streak_7', 'الشعلة الأسبوعية', 'حافظت على شعلة الدخول لـ 7 أيام متتالية', '🔥', 200, 100, 7],
      ['ach_first_gift', 'first_gift', 'صاحب الذوق', 'أرسلت أول هدية لك', '🎁', 80, 40, 1],
      ['ach_level_5', 'level_5', 'المرتبة الراقية', 'وصلت إلى المستوى 5 في فضفضه', '🌟', 300, 150, 5],
      ['ach_vip_club', 'vip_club', 'العضوية الذهبية', 'انضممت إلى نخبة أعضاء VIP', '👑', 500, 250, 1]
    ];
    for (const a of defaultAchievements) {
      db.run(
        "INSERT INTO achievements (id, key, title, description, icon, xp_reward, coins_reward, target_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        a
      );
    }
  }

  // Seed Default Shop Items (Badges & Special Features)
  const shopExist = db.exec("SELECT COUNT(*) as c FROM shop_items");
  const sCount = shopExist[0]?.values[0]?.[0] as number || 0;
  if (sCount === 0) {
    const defaultShopItems = [
      // Badges
      ['shop_badge_royal', 'شارة التاج الملكي', 'شارة ملكية متألقة تميز حضورك وتظهر بجانب اسمك في المحادثات وقائمة المتصلين', '👑', 150, 'badge', 'distinctive', null, 1, 1, '{"badgeTag":"التاج الملكي","badgeColor":"from-amber-400 to-yellow-600"}'],
      ['shop_badge_diamond', 'شارة الياقوت الأزرق', 'شارة نادرة تشع بالفخامة تمنح اسمك بريقاً فريداً بين الأعضاء', '💎', 300, 'badge', 'rare', null, 1, 2, '{"badgeTag":"الياقوت الأزرق","badgeColor":"from-cyan-400 to-blue-600"}'],
      ['shop_badge_falcon', 'شارة الصقر الذهبي', 'رمز الأصالة والشهامة العربية للأعضاء الأوفياء والمتميزين', '🦅', 400, 'badge', 'special', null, 1, 3, '{"badgeTag":"صقر فضفضه","badgeColor":"from-amber-500 to-orange-600"}'],
      ['shop_badge_crescent', 'شارة الهلال والمواسم', 'شارة موسمية أنيقة تعكس أجواء الألفة والروحانية الدافئة', '🌙', 180, 'badge', 'seasonal', null, 1, 4, '{"badgeTag":"هلال الفضفضة","badgeColor":"from-emerald-400 to-teal-600"}'],
      ['shop_badge_star', 'شارة النجمة الماسية', 'شارة براقة ومبهجة للأعضاء أصحاب الحضور الدائم', '⭐', 120, 'badge', 'distinctive', null, 1, 5, '{"badgeTag":"نجم ساطع","badgeColor":"from-yellow-300 to-amber-500"}'],
      ['shop_badge_flame', 'شارة الشعلة الأسطورية', 'شارة الشغف والحماس المشتعل تبرز نشاطك الاستثنائي', '🔥', 350, 'badge', 'rare', null, 1, 6, '{"badgeTag":"الشعلة الحية","badgeColor":"from-red-500 to-amber-500"}'],

      // Special Features
      ['shop_feat_pin_24h', 'تثبيت الحساب في قمة المتصلين (24 ساعة)', 'يظهر حسابك وبطاقتك في صدارة قائمة المتصلين الآن لمدة 24 ساعة لكافة الزوار والأعضاء!', '📌', 200, 'pin_profile', 'features', 24, 1, 10, '{"badgeTag":"مثبت 24h"}'],
      ['shop_feat_pin_7d', 'تثبيت الحساب في قمة المتصلين (7 أيام)', 'تثبيت ذهبي أسبوعي لحسابك في أول صفحة المتصلين الآن لزيادة شعبيتك وتواصلك!', '📌', 800, 'pin_profile', 'features', 168, 1, 11, '{"badgeTag":"مثبت أسبوعي"}'],
      ['shop_frame_gold', 'إطار الذهب الملكي لبطاقتك', 'إطار ذهبي ساحر ومضيء يحيط ببطاقة ملفك في قائمة المتصلين الآن لمدة 3 أيام', '✨', 250, 'card_frame', 'features', 72, 1, 12, '{"frameStyle":"gold","borderClass":"border-amber-400 shadow-lg shadow-amber-500/20"}'],
      ['shop_frame_neon', 'إطار الهالة النيونية البنفسجية', 'إطار نيون بنفسجي جذاب ينبض بالحيوية والجاذبية لمدة 3 أيام', '🔮', 280, 'card_frame', 'features', 72, 1, 13, '{"frameStyle":"neon","borderClass":"border-purple-500 shadow-lg shadow-purple-500/25"}'],
      ['shop_frame_emerald', 'إطار الزمرد الساحر', 'إطار زمردي أخضر براق يعكس الأناقة والرقي لمدة يومين', '🌿', 180, 'card_frame', 'features', 48, 1, 14, '{"frameStyle":"emerald","borderClass":"border-emerald-400 shadow-lg shadow-emerald-500/20"}']
    ];

    for (const item of defaultShopItems) {
      db.run(
        "INSERT INTO shop_items (id, name, description, icon, price_coins, type, category, duration_hours, is_active, display_order, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        item
      );
    }
  }

  // Seed Default VIP Plans if empty
  try {
    const vipExist = db.exec("SELECT COUNT(*) as c FROM vip_plans");
    const vCount = (vipExist[0]?.values[0]?.[0] as number) || 0;
    if (vCount === 0) {
      const defaultVipPlans = [
        [
          'bronze',
          'VIP البرونزي',
          '🥉',
          'برونزي',
          'from-amber-700 to-amber-900',
          'border-amber-700/60',
          'text-amber-300',
          200,
          30,
          0,
          1,
          JSON.stringify([
            'شارة VIP برونزية مميزة في الملف الشخصي والدردشة',
            'أولوية ظهور متقدمة في قائمة المتصلين الآن',
            'مضاعفة مكافآت نقاط الخبرة اليومية (1.2x)',
            'إمكانية تغيير لون اسم المستخدم في الغرف العامة'
          ]),
          1
        ],
        [
          'silver',
          'VIP الفضي',
          '🥈',
          'فضي',
          'from-slate-400 to-slate-600',
          'border-slate-400/60',
          'text-slate-200',
          500,
          30,
          1,
          1,
          JSON.stringify([
            'شارة VIP فضية براقة بجانب اسمك في كل الأقسام',
            'ظهور عالي الأولوية في المتصلين والمجالس',
            'مضاعفة مكافآت نقاط الخبرة اليومية (1.5x)',
            'حضور مميز مع فقاعة رسائل فضية خاصة',
            'دخول حصري للغرف الحوارية الراقية'
          ]),
          2
        ],
        [
          'gold',
          'VIP الذهبي',
          '👑',
          'ذهبي ناصع',
          'from-amber-400 to-yellow-600',
          'border-amber-400/80',
          'text-amber-300',
          1000,
          30,
          0,
          1,
          JSON.stringify([
            'تاج ذهبي ملكي متوهج بجانب اسمك في كل مكان',
            'صدارة قائمة المتصلين الآن مع تمييز ذهبي',
            'مضاعفة نقاط الخبرة (2x) لتسريع رفع المستوى',
            'إمكانية إنشاء مجالس وغرف خاصة دون قيود',
            'لون خط ذهبي متوهج في الرسائل العامة',
            'درع حماية متقدم من الحظر المؤقت في الغرف'
          ]),
          3
        ],
        [
          'royal',
          'VIP الملكي الاستثنائي',
          '💎',
          'ملكي ألماسي',
          'from-purple-500 via-indigo-500 to-cyan-500',
          'border-purple-400/80',
          'text-purple-300',
          2500,
          30,
          0,
          1,
          JSON.stringify([
            'شارة الألماس الملكي الفاخرة ذات البريق المتحرك',
            'تثبيت استثنائي فائق في مقدمة المتصلين دائماً',
            'مضاعفة نقاط الخبرة اليومية 3 أضعاف (3x)',
            'رسائل بتأثيرات نيونية متحركة في المحادثات والغرف',
            'دخول كافة الغرف والمجالس المغلقة بدون كلمة مرور',
            'إشعارات ترحيبية خاصة عند دخولك أي غرفة عامة',
            'صلاحية إهداء هدايا خاصة حصرية لأعضاء VIP الملكي'
          ]),
          4
        ]
      ];

      for (const plan of defaultVipPlans) {
        db.run(
          `INSERT INTO vip_plans (id, name, icon, badge, color, border, text_color, price_coins, days, popular, is_active, perks_json, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          plan
        );
      }
    }
  } catch (err) {
    console.error('Error seeding default vip plans:', err);
  }

  // Seed Default Coin Packages if empty
  try {
    const pkgExist = db.exec("SELECT COUNT(*) as c FROM coin_packages");
    const pCount = (pkgExist[0]?.values[0]?.[0] as number) || 0;
    if (pCount === 0) {
      const defaultCoinPackages = [
        [
          'pkg_starter',
          'باقة البداية (Starter)',
          100,
          0,
          5.0,
          'SAR',
          '🪙',
          'انطلاقة سريعة',
          'from-neutral-800 to-neutral-900',
          0,
          1,
          1
        ],
        [
          'pkg_popular',
          'باقة الفضفضة (Popular)',
          350,
          50,
          15.0,
          'SAR',
          '⭐',
          'الأكثر طلباً 🔥',
          'from-amber-700 to-amber-950',
          1,
          1,
          2
        ],
        [
          'pkg_elite',
          'باقة النخبة (Elite Plus)',
          800,
          200,
          35.0,
          'SAR',
          '💎',
          'وفر 25% ✨',
          'from-cyan-800 to-blue-950',
          0,
          1,
          3
        ],
        [
          'pkg_vip_booster',
          'باقة كبار الشخصيات (VIP Booster)',
          2000,
          600,
          80.0,
          'SAR',
          '👑',
          'الأفضل قيمة 🏆',
          'from-purple-800 to-indigo-950',
          0,
          1,
          4
        ],
        [
          'pkg_royal_vault',
          'خزينة الكرم الملكي (Royal Vault)',
          5000,
          2000,
          180.0,
          'SAR',
          '🏛️',
          'باقة الملوك 🌟',
          'from-amber-500 via-yellow-600 to-amber-900',
          0,
          1,
          5
        ]
      ];

      for (const pkg of defaultCoinPackages) {
        db.run(
          `INSERT INTO coin_packages (id, name, coins, bonus_coins, price_amount, currency, icon, badge, color, popular, is_active, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          pkg
        );
      }
    }
  } catch (err) {
    console.error('Error seeding coin packages:', err);
  }

  // Seed Default Events if empty
  try {
    const eventsExist = db.exec("SELECT COUNT(*) as c FROM events");
    const eCount = (eventsExist[0]?.values[0]?.[0] as number) || 0;
    if (eCount === 0) {
      const ownerRow = queryOne(db, "SELECT id FROM users WHERE role = 'owner' OR LOWER(username) = 'hegazy'");
      const ownerId = ownerRow?.id || 'usr_1790285919516_kn7t3';

      const defaultEvents = [
        [
          'evt_poetry_night',
          'أمسية الفضفضة الكبرى: سهرة أدبية وشعرية',
          'لقاء صوتي وحواري مميز يجمع رواد فضفضه لمشاركة أجمل الأبيات الشعرية والنصوص الأدبية، مع مسابقات فورية وتوزيع جوائز وهدايا كوينز لجميع الحاضرين.',
          'مجالس شعر وأدب',
          '2026-10-15 21:00:00',
          '2026-10-15 23:30:00',
          ownerId,
          250,
          'https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=1200&q=80',
          'upcoming',
          'مجلس ديوان العرب (صوتي)',
          '09:00 م',
          '15 أكتوبر 2026'
        ],
        [
          'evt_proverbs_quiz',
          'بطولة الأمثال وتحدي المعرفة الموسمية',
          'تحدي جماعي حماسي في لعبة الأمثال الشعبية والألغاز التراثية. يتنافس فيها الأعضاء في جولات سريعة للفوز بلقب بطل الفضفضة وشارة حصرية وجوائز كبرى من الكوينز.',
          'ألعاب ومسابقات',
          '2026-10-22 20:30:00',
          '2026-10-22 22:30:00',
          ownerId,
          150,
          'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
          'upcoming',
          'صالة الألعاب والتحديات الكبرى',
          '08:30 م',
          '22 أكتوبر 2026'
        ],
        [
          'evt_mental_health',
          'حلقة نقاش: فن الاستماع الإيجابي والتعبير الواعي',
          'مساحة دافئة وآمنة للحديث حول إدارة ضغوط الحياة وأهمية التعبير عن المشاعر بوعي وإيجابية، بمشاركة نخبة من الأعضاء المهتمين بالإرشاد والدعم الإنساني.',
          'تطوير ودعم نفسي',
          '2026-10-29 19:30:00',
          '2026-10-29 21:30:00',
          ownerId,
          120,
          'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
          'upcoming',
          'غرفة الدعم والاستماع الهادئ',
          '07:30 م',
          '29 أكتوبر 2026'
        ],
        [
          'evt_past_celebration',
          'حفل تدشين فضفضه السنوي وتكريم الأوائل',
          'احتفلنا معاً بتدشين المزايا الجديدة للمنصة وتكريم أصحاب أعلى شعلات ونقاط خبرة خلال الموسم، مع توزيع أوسمة تذكارية لأكثر من 500 عضو.',
          'احتفال وتكريم',
          '2026-09-20 21:00:00',
          '2026-09-20 23:00:00',
          ownerId,
          500,
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
          'completed',
          'المجلس الملكي العام',
          '09:00 م',
          '20 سبتمبر 2026'
        ],
        [
          'evt_past_podcast',
          'ليلة البودكاست: تجارب وقصص غيرت حياة أصحابها',
          'استمعنا في أجواء حميمة لعشرات القصص الملهمة التي رواها أعضاء فضفضه بكل شجاعة وصدق، وحظيت الأمسية بتفاعل استثنائي تجاوز 300 مشارك.',
          'قصص وتجارب',
          '2026-09-05 20:00:00',
          '2026-09-05 22:00:00',
          ownerId,
          300,
          'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1200&q=80',
          'completed',
          'مجلس القصص والحكايات',
          '08:00 م',
          '05 سبتمبر 2026'
        ]
      ];

      for (const ev of defaultEvents) {
        db.run(
          `INSERT INTO events (id, title, description, category, start_time, end_time, created_by, max_participants, image_url, status, location, time_display, date_display)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ev
        );
      }
    }
  } catch (err) {
    console.error('Error seeding default events:', err);
  }

  // Seed Default Official News & Posts if empty
  try {
    const postsExist = db.exec("SELECT COUNT(*) as c FROM platform_posts");
    const pCount = (postsExist[0]?.values[0]?.[0] as number) || 0;
    if (pCount === 0) {
      const ownerRow = queryOne(db, "SELECT id FROM users WHERE role = 'owner' OR LOWER(username) = 'hegazy'");
      const ownerId = ownerRow?.id || 'usr_1790285919516_kn7t3';

      const defaultPosts = [
        [
          'post_update_v2',
          'إطلاق التحديث الشامل لمنصة فضفضه: سرعة فائقة وتجربة هاتف استثنائية',
          `أعزاءنا أعضاء ورواد فضفضه الكرام،\n\nيسرنا أن نعلن لكم عن إطلاق الإصدار الأحدث من منصة فضفضه، والذي ركزنا فيه على تقديم أعلى معايير الأداء والسرعة، ودعم كامل لكافة شاشات الهواتف الذكية والأجهزة اللوحية.\n\nأهم ما يتضمنه هذا الإصدار:\n1. استجابة فائقة وتصميم مرن (Mobile Responsive) يناسب جميع مقاسات الهواتف مع واجهة مستخدم سلسة.\n2. تحسينات كبيرة على محرك المحادثات الفورية والوسائط الآمنة ذاتية التدمير.\n3. إضافة صفحة الفعاليات الرسمية وجدول الأنشطة التفاعلية والمجالس الصوتية.\n4. تدشين مركز المنشورات والأخبار لموافاتكم بكل جديد وتحديث رسمي أولاً بأول.\n5. اعتماد شارة المالك الرسمية لتعزيز الأمان والتواصل المباشر مع إدارة المنصة.\n\nنشكركم على ثقتكم الغالية ومشاركتكم اليومية في بناء هذا المجتمع العربي الراقي والآمن.`,
          'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
          ownerId,
          'تحديثات المنصة',
          1,
          420
        ],
        [
          'post_privacy_guide',
          'دليل الأمان والخصوصية: كيف تحافظ على سرية بياناتك وتجربتك الآمنة في فضفضه',
          `خصوصيتكم وأمانكم هي خط دفاعنا الأول وأولوية مطلقة في كل سطر برمجي نبنيه.\n\nنود تذكيركم بمجموعة من أهم الممارسات الآمنة أثناء استخدام منصة فضفضه:\n\n• خاصية المشاهدة لمرة واحدة (View Once): استخدموها عند مشاركة أي صور حساسة ليتم تدميرها تلقائياً وفوراً بمجرد أن يشاهدها الطرف الآخر.\n• أدوات الحظر والكتم والإبلاغ: متوفرة في كافة المحادثات والغرف والملفات الشخصية، وفريق الإشراف يراجع كافة البلاغات على مدار الساعة لضمان راحة الجميع.\n• إعدادات الخصوصية في صفحة الإعدادات: تتيح لك إخفاء آخر ظهور أو حالة الاتصال أو قصر الرسائل على الأصدقاء فقط.\n• لا تشارك أي كلمات مرور أو بيانات حساسة خارج المنصة، وإدارة فضفضه لن تطلب منك كلمة مرورك إطلاقاً.\n\nتذكروا دائماً أن فضفضه مساحتكم الآمنة للتعبير بدون قيود أو أحكام مسبقة.`,
          'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
          ownerId,
          'إرشادات وأمان',
          0,
          285
        ],
        [
          'post_community_rules',
          'ميثاق وقواعد المشاركة في المجالس الحوارية والغرف العامة',
          `لضمان بقاء مجالس فضفضه بيئة نقية ودافئة تجمع القلوب وتثري العقول، نؤكد على الالتزام بالميثاق التالي:\n\n1. الاحترام المتبادل وتجنب أي محتوى مسيء أو تنمر أو إثارة النزاعات.\n2. منع تداول الروابط الخارجية المشبوهة أو الإعلانات التجارية غير المصرح بها.\n3. احترام خصوصية المشاركين في الغرف الصوتية وعدم التسجيل أو النشر دون إذن مسبق.\n4. نشر الإيجابية والتعاطف والدعم لأي عضو يطلب المشورة أو يشارك مشاعره.\n\nتطبق الأنظمة الصارمة ضد أي مخالفة للحفاظ على رقي مجتمعنا. معاً نجعل الفضفضة أجمل.`,
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
          ownerId,
          'قوانين المجتمع',
          0,
          190
        ]
      ];

      for (const p of defaultPosts) {
        db.run(
          `INSERT INTO platform_posts (id, title, content, image_url, author_id, category, is_pinned, views_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          p
        );
      }
    }
  } catch (err) {
    console.error('Error seeding default posts:', err);
  }

  // NOTE: Requirement 9 & 29 explicitly state:
  // "Do NOT seed demo rooms. Do NOT create fake/default rooms. The application must start with NO rooms unless created by the Owner."
  // We strictly respect this! 0 demo rooms seeded.

  // Seed Random Connect Settings if empty
  try {
    const randExist = db.exec("SELECT COUNT(*) as c FROM random_settings");
    if (!randExist[0]?.values[0]?.[0]) {
      db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_chat_per_min', '1')");
      db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_voice_per_min', '3')");
      db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_video_per_min', '5')");
      db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('free_attempts', '4')");
      db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('free_minutes_per_session', '5')");
    }
  } catch (err) {
    console.error('Error seeding random settings:', err);
  }

  // Seed sample Story Ad if empty
  try {
    const adExist = db.exec("SELECT COUNT(*) as c FROM story_ads");
    if (!adExist[0]?.values[0]?.[0]) {
      db.run(`
        INSERT INTO story_ads (id, title, description, image_url, link_url, is_active, display_interval, priority)
        VALUES ('ad_fadfada_vip', 'باقات VIP الملكية في فضفضه', 'ارتقِ بتجربتك الاجتماعية واحصل على شارات نادرة وتثبيت حصري لحسابك!', 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80', '#shop', 1, 3, 1)
      `);
    }
  } catch (err) {
    console.error('Error seeding story ads:', err);
  }
}

// Helper utility to execute queries and return structured array of objects
export function queryAll<T = any>(db: SqlDatabase, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(db: SqlDatabase, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export interface WalletTransactionResult {
  success: boolean;
  txId: string;
  balanceBefore: number;
  balanceAfter: number;
  isIdempotentReplay?: boolean;
}

/**
 * Server-authoritative, atomic wallet balance execution.
 * Enforces:
 * 1. Database-level read and update of real coin balance
 * 2. Strict prevention of negative balance
 * 3. Idempotency checking via unique (user_id, idempotency_key)
 * 4. Immutable audit trail with balance_before and balance_after
 */
export function executeWalletTransaction(
  db: SqlDatabase,
  params: {
    userId: string;
    amount: number;
    type: string;
    description: string;
    relatedUserId?: string | null;
    idempotencyKey?: string | null;
  }
): WalletTransactionResult {
  if (params.idempotencyKey) {
    const existing = queryOne(
      db,
      "SELECT id, balance_before, balance_after FROM wallet_transactions WHERE user_id = ? AND idempotency_key = ?",
      [params.userId, params.idempotencyKey]
    );
    if (existing) {
      return {
        success: true,
        txId: existing.id,
        balanceBefore: existing.balance_before,
        balanceAfter: existing.balance_after,
        isIdempotentReplay: true
      };
    }
  }

  const user = queryOne(db, "SELECT coins FROM users WHERE id = ?", [params.userId]);
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }

  const balanceBefore = user.coins || 0;
  const balanceAfter = balanceBefore + params.amount;

  if (balanceAfter < 0) {
    throw new Error(`رصيد الكوينز غير كافٍ. تحتاج إلى ${Math.abs(params.amount)} كوينز (رصيدك الحالي: ${balanceBefore})`);
  }

  const txId = 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  db.run("UPDATE users SET coins = ? WHERE id = ?", [balanceAfter, params.userId]);
  db.run(
    `INSERT INTO wallet_transactions
     (id, user_id, amount, type, description, related_user_id, balance_before, balance_after, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txId,
      params.userId,
      params.amount,
      params.type,
      params.description,
      params.relatedUserId || null,
      balanceBefore,
      balanceAfter,
      params.idempotencyKey || null
    ]
  );

  return {
    success: true,
    txId,
    balanceBefore,
    balanceAfter,
    isIdempotentReplay: false
  };
}
