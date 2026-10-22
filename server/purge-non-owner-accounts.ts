import pg from 'pg';
const { Pool } = pg;
import { getDb, saveDbSync, queryAll, queryOne } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

export async function purgeNonOwnerAccounts() {
  console.log('=====================================================');
  console.log('  PURGING ALL ACCOUNTS EXCEPT OWNER (HEGAZY)         ');
  console.log('=====================================================\n');

  const db = await getDb();

  // 1. Identify Owner
  const owner = queryOne<{ id: string; username: string; role: string; coins: number }>(
    db,
    "SELECT id, username, role, coins FROM users WHERE role = 'owner'"
  );

  if (!owner) {
    throw new Error('Fatal: Owner account not found! Aborting purge.');
  }

  const ownerId = owner.id;
  console.log(`[Target Owner] ID: ${ownerId}, Username: ${owner.username}, Coins: ${owner.coins}`);

  // Count before
  const usersBefore = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM users")?.c || 0;
  const nonOwnersBefore = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM users WHERE id != ?", [ownerId])?.c || 0;
  console.log(`[Before] Total users: ${usersBefore}, Non-owners to delete: ${nonOwnersBefore}`);

  // 2. Perform Clean deletion in SQLite
  const deleteTables = [
    { table: 'sessions', sql: "DELETE FROM sessions WHERE user_id != ?" },
    { table: 'private_messages', sql: "DELETE FROM private_messages WHERE sender_id != ? OR recipient_id != ?" },
    { table: 'private_conversations', sql: "DELETE FROM private_conversations WHERE user1_id != ? OR user2_id != ?" },
    { table: 'private_reactions', sql: "DELETE FROM private_reactions WHERE user_id != ?" },
    { table: 'private_message_deletions', sql: "DELETE FROM private_message_deletions WHERE user_id != ?" },
    { table: 'friend_requests', sql: "DELETE FROM friend_requests WHERE sender_id != ? OR receiver_id != ?" },
    { table: 'friendships', sql: "DELETE FROM friendships WHERE user1_id != ? OR user2_id != ?" },
    { table: 'blocks', sql: "DELETE FROM blocks WHERE user_id != ? OR blocked_user_id != ?" },
    { table: 'mutes', sql: "DELETE FROM mutes WHERE user_id != ? OR muted_user_id != ?" },
    { table: 'room_members', sql: "DELETE FROM room_members WHERE user_id != ?" },
    { table: 'room_messages', sql: "DELETE FROM room_messages WHERE sender_id != ?" },
    { table: 'room_reactions', sql: "DELETE FROM room_reactions WHERE user_id != ?" },
    { table: 'active_audio_speakers', sql: "DELETE FROM active_audio_speakers WHERE user_id != ?" },
    { table: 'room_active_sessions', sql: "DELETE FROM room_active_sessions WHERE user_id != ?" },
    { table: 'stories', sql: "DELETE FROM stories WHERE user_id != ?" },
    { table: 'story_views', sql: "DELETE FROM story_views WHERE viewer_id != ?" },
    { table: 'user_inventory', sql: "DELETE FROM user_inventory WHERE user_id != ?" },
    { table: 'user_interests', sql: "DELETE FROM user_interests WHERE user_id != ?" },
    { table: 'user_mission_progress', sql: "DELETE FROM user_mission_progress WHERE user_id != ?" },
    { table: 'user_badges', sql: "DELETE FROM user_badges WHERE user_id != ?" },
    { table: 'user_achievements', sql: "DELETE FROM user_achievements WHERE user_id != ?" },
    { table: 'user_game_records', sql: "DELETE FROM user_game_records WHERE user_id != ?" },
    { table: 'wallet_transactions', sql: "DELETE FROM wallet_transactions WHERE user_id != ?" },
    { table: 'gift_transactions', sql: "DELETE FROM gift_transactions WHERE sender_id != ?" },
    { table: 'payment_orders', sql: "DELETE FROM payment_orders WHERE user_id != ?" },
    { table: 'notifications', sql: "DELETE FROM notifications WHERE user_id != ?" },
    { table: 'terms_agreements', sql: "DELETE FROM terms_agreements WHERE user_id IS NOT NULL AND user_id != ?" },
    { table: 'reports', sql: "DELETE FROM reports WHERE reporter_id != ?" },
    { table: 'site_suggestions', sql: "DELETE FROM site_suggestions WHERE user_id != ?" },
    { table: 'post_likes', sql: "DELETE FROM post_likes WHERE user_id != ?" },
    { table: 'email_verifications', sql: "DELETE FROM email_verifications WHERE user_id != ?" },
    { table: 'password_resets', sql: "DELETE FROM password_resets WHERE user_id != ?" },
    { table: 'random_sessions', sql: "DELETE FROM random_sessions WHERE user1_id != ? OR user2_id != ?" }
  ];

  for (const item of deleteTables) {
    try {
      const params = item.sql.includes('OR') ? [ownerId, ownerId] : [ownerId];
      db.run(item.sql, params);
    } catch (err: any) {
      console.warn(`[SQLite Cleanup] Warning on ${item.table}:`, err.message);
    }
  }

  // Delete non-owner users in SQLite
  db.run("DELETE FROM users WHERE id != ? AND role != 'owner'", [ownerId]);
  saveDbSync();

  const usersAfter = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM users")?.c || 0;
  console.log(`[After SQLite] Users remaining: ${usersAfter} (Should be 1: Hegazy)`);

  // 3. Mirror the deletion to Cloud SQL PostgreSQL if configured
  if (process.env.SQL_HOST) {
    console.log('[PostgreSQL] Connecting to Cloud SQL to mirror account purge...');
    const pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 3,
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const pgDeleteStatements = [
        "DELETE FROM sessions WHERE user_id != $1",
        "DELETE FROM private_messages WHERE sender_id != $1 OR recipient_id != $1",
        "DELETE FROM private_conversations WHERE user1_id != $1 OR user2_id != $1",
        "DELETE FROM private_reactions WHERE user_id != $1",
        "DELETE FROM private_message_deletions WHERE user_id != $1",
        "DELETE FROM friend_requests WHERE sender_id != $1 OR receiver_id != $1",
        "DELETE FROM friendships WHERE user1_id != $1 OR user2_id != $1",
        "DELETE FROM blocks WHERE user_id != $1 OR blocked_user_id != $1",
        "DELETE FROM mutes WHERE user_id != $1 OR muted_user_id != $1",
        "DELETE FROM room_members WHERE user_id != $1",
        "DELETE FROM room_messages WHERE sender_id != $1",
        "DELETE FROM room_reactions WHERE user_id != $1",
        "DELETE FROM active_audio_speakers WHERE user_id != $1",
        "DELETE FROM room_active_sessions WHERE user_id != $1",
        "DELETE FROM stories WHERE user_id != $1",
        "DELETE FROM story_views WHERE viewer_id != $1",
        "DELETE FROM user_inventory WHERE user_id != $1",
        "DELETE FROM user_interests WHERE user_id != $1",
        "DELETE FROM user_mission_progress WHERE user_id != $1",
        "DELETE FROM user_badges WHERE user_id != $1",
        "DELETE FROM user_achievements WHERE user_id != $1",
        "DELETE FROM user_game_records WHERE user_id != $1",
        "DELETE FROM wallet_transactions WHERE user_id != $1",
        "DELETE FROM gift_transactions WHERE sender_id != $1",
        "DELETE FROM payment_orders WHERE user_id != $1",
        "DELETE FROM notifications WHERE user_id != $1",
        "DELETE FROM terms_agreements WHERE user_id IS NOT NULL AND user_id != $1",
        "DELETE FROM reports WHERE reporter_id != $1",
        "DELETE FROM site_suggestions WHERE user_id != $1",
        "DELETE FROM post_likes WHERE user_id != $1",
        "DELETE FROM email_verifications WHERE user_id != $1",
        "DELETE FROM password_resets WHERE user_id != $1",
        "DELETE FROM random_sessions WHERE user1_id != $1 OR user2_id != $1",
        "DELETE FROM users WHERE id != $1 AND role != 'owner'"
      ];

      for (const sql of pgDeleteStatements) {
        await client.query(sql, [ownerId]);
      }

      await client.query('COMMIT');
      console.log('[PostgreSQL] Successfully committed account purge in Cloud SQL PostgreSQL!');

      const pgUsersRes = await client.query("SELECT count(*) as c FROM users");
      const pgOwnerRes = await client.query("SELECT id, username, role, coins FROM users");
      console.log(`[After PostgreSQL] Users remaining: ${pgUsersRes.rows[0].c}`);
      console.log(`[After PostgreSQL] Owner account:`, pgOwnerRes.rows);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] Purge rollback due to error:', err.message);
      throw err;
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log('\n>>> NON-OWNER ACCOUNTS PURGED SUCCESSFULLY! <<<');
  console.log(`>>> OWNER (${owner.username}) PRESERVED IN BOTH DATABASES <<<`);
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('purge-non-owner-accounts.ts') || process.argv[1]?.endsWith('purge-non-owner-accounts.js')) {
  purgeNonOwnerAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal purge error:', err);
      process.exit(1);
    });
}
