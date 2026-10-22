import fs from 'fs';
import path from 'path';
import { Database as SqlDatabase } from 'sql.js';
import { queryAll, saveDbSync } from './db.js';
import { deleteMediaFile } from './storage.js';
import { getPostgresPool } from './postgresDb.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
const UPLOAD_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'fadfada.sqlite');

export function initCronJobs(db: SqlDatabase) {
  // Ensure backups and uploads directories exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Run initial cleanup and backup on server startup
  runCleanup(db).catch(err => {
    console.warn('[Cron] Startup cleanup notice:', err.message);
  });
  runDatabaseBackup(db);

  // Run automatic cleanup every 5 minutes (enforcing 24h story & temporary media expiration)
  setInterval(() => {
    runCleanup(db).catch(err => {
      console.warn('[Cron] Scheduled cleanup notice:', err.message);
    });
  }, 5 * 60 * 1000);

  // Run database backup every 4 hours
  setInterval(() => {
    runDatabaseBackup(db);
  }, 4 * 60 * 60 * 1000);
}

export function runDatabaseBackup(db: SqlDatabase) {
  try {
    if (!fs.existsSync(DB_FILE)) return;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `fadfada_backup_${timestamp}.sqlite`);

    // Export current state and save backup
    const data = db.export();
    fs.writeFileSync(backupPath, Buffer.from(data));

    // Maintain max 10 recent backups
    const existingBackups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('fadfada_backup_') && f.endsWith('.sqlite'))
      .sort();

    if (existingBackups.length > 10) {
      const toDelete = existingBackups.slice(0, existingBackups.length - 10);
      for (const oldFile of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
        } catch {}
      }
    }
  } catch (err) {
    console.error('Backup error (non-fatal):', err);
  }
}

/**
 * Server-authoritative cleanup job:
 * 1. Automatically deletes stories after 24 hours (and deletes their media files).
 * 2. Physically deletes temporary view-once media after viewing or after 24 hours.
 * 3. Physically deletes expired self-destruct message media after 24 hours.
 * 4. Deletes abandoned/orphaned temporary upload files older than 24 hours that are not linked to any account, post, or message.
 * 5. Strictly protects user accounts, regular messages, friendships, and core site data.
 */
export async function runCleanup(db: SqlDatabase) {
  try {
    // -------------------------------------------------------------------------
    // 1. Stories Cleanup (> 24 hours old / expired)
    // -------------------------------------------------------------------------
    const expiredStories = queryAll<{ id: string; media_url: string }>(
      db,
      "SELECT id, media_url FROM stories WHERE expires_at <= CURRENT_TIMESTAMP OR created_at <= datetime('now', '-24 hours')"
    );

    for (const story of expiredStories) {
      if (story.media_url && story.media_url.startsWith('/uploads/')) {
        const fileName = story.media_url.replace('/uploads/', '');
        // Verify this media file is not still in use by another active story
        const otherRef = queryAll(
          db,
          "SELECT id FROM stories WHERE media_url = ? AND id != ?",
          [story.media_url, story.id]
        );
        if (otherRef.length === 0) {
          await deleteMediaFile(fileName).catch(() => {});
        }
      }
      // Delete story views first (foreign key dependency)
      db.run("DELETE FROM story_views WHERE story_id = ?", [story.id]);
      // Delete the expired story
      db.run("DELETE FROM stories WHERE id = ?", [story.id]);
    }

    // -------------------------------------------------------------------------
    // 2. View-Once Media Cleanup (viewed OR older than 24 hours)
    // -------------------------------------------------------------------------
    const expiredViewOnce = queryAll<{ id: string; media_url: string }>(
      db,
      `SELECT id, media_url FROM private_messages 
       WHERE is_view_once = 1 
         AND (is_viewed = 1 OR created_at <= datetime('now', '-24 hours')) 
         AND media_url != ''`
    );

    for (const msg of expiredViewOnce) {
      if (msg.media_url && msg.media_url.startsWith('/uploads/')) {
        const fileName = msg.media_url.replace('/uploads/', '');
        await deleteMediaFile(fileName).catch(() => {});
      }
      db.run("UPDATE private_messages SET media_url = '' WHERE id = ?", [msg.id]);
    }

    // -------------------------------------------------------------------------
    // 3. Self-Destruct Messages Media Cleanup (> 24 hours or expired)
    // -------------------------------------------------------------------------
    const expiredSelfDestruct = queryAll<{ id: string; media_url: string }>(
      db,
      `SELECT id, media_url FROM private_messages 
       WHERE is_self_destruct = 1 
         AND (is_destroyed = 1 
              OR created_at <= datetime('now', '-24 hours') 
              OR is_deleted = 1) 
         AND media_url != ''`
    );

    for (const msg of expiredSelfDestruct) {
      if (msg.media_url && msg.media_url.startsWith('/uploads/')) {
        const fileName = msg.media_url.replace('/uploads/', '');
        await deleteMediaFile(fileName).catch(() => {});
      }
      db.run("UPDATE private_messages SET media_url = '' WHERE id = ?", [msg.id]);
    }

    // -------------------------------------------------------------------------
    // 4. Orphaned Temporary Uploads Cleanup (> 24 hours old)
    // -------------------------------------------------------------------------
    if (fs.existsSync(UPLOAD_DIR)) {
      const nowMs = Date.now();
      const oneDayAgoMs = nowMs - (24 * 60 * 60 * 1000);
      const files = fs.readdirSync(UPLOAD_DIR);

      for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        try {
          const stat = fs.statSync(filePath);
          // Only check files created/modified more than 24 hours ago
          if (stat.mtimeMs < oneDayAgoMs) {
            const fileUrl = `/uploads/${file}`;

            // Check if referenced in any permanent table
            const isAvatarOrCover = queryAll(db, "SELECT id FROM users WHERE avatar_url = ? OR cover_url = ?", [fileUrl, fileUrl]);
            if (isAvatarOrCover.length > 0) continue;

            const isRoomImage = queryAll(db, "SELECT id FROM rooms WHERE image_url = ?", [fileUrl]);
            if (isRoomImage.length > 0) continue;

            const isPostImage = queryAll(db, "SELECT id FROM platform_posts WHERE image_url = ?", [fileUrl]);
            if (isPostImage.length > 0) continue;

            const isStoryMedia = queryAll(db, "SELECT id FROM stories WHERE media_url = ?", [fileUrl]);
            if (isStoryMedia.length > 0) continue;

            const isPrivateMsgMedia = queryAll(db, "SELECT id FROM private_messages WHERE media_url = ?", [fileUrl]);
            if (isPrivateMsgMedia.length > 0) continue;

            const isRoomMsgMedia = queryAll(db, "SELECT id FROM room_messages WHERE media_url = ?", [fileUrl]);
            if (isRoomMsgMedia.length > 0) continue;

            const isShopItem = queryAll(db, "SELECT id FROM shop_items WHERE image_url = ?", [fileUrl]);
            if (isShopItem.length > 0) continue;

            const isGift = queryAll(db, "SELECT id FROM gifts WHERE image_url = ?", [fileUrl]);
            if (isGift.length > 0) continue;

            const isAd = queryAll(db, "SELECT id FROM story_ads WHERE image_url = ?", [fileUrl]);
            if (isAd.length > 0) continue;

            const isPaymentReceipt = queryAll(db, "SELECT id FROM payment_orders WHERE receipt_image_url = ?", [fileUrl]);
            if (isPaymentReceipt.length > 0) continue;

            // File is an abandoned / temporary upload older than 24h: safely delete it
            await deleteMediaFile(file).catch(() => {});
          }
        } catch {}
      }
    }

    // -------------------------------------------------------------------------
    // 5. Expired Sessions & Tokens Cleanup
    // -------------------------------------------------------------------------
    db.run("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");
    db.run("DELETE FROM password_resets WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL");
    db.run("DELETE FROM email_verifications WHERE expires_at < CURRENT_TIMESTAMP OR verified_at IS NOT NULL");

    // Persist changes to disk
    saveDbSync();

    // Mirror story deletions to PostgreSQL if configured
    const pgPool = getPostgresPool();
    if (pgPool) {
      try {
        await pgPool.query("DELETE FROM story_views WHERE story_id IN (SELECT id FROM stories WHERE expires_at <= NOW() OR created_at <= NOW() - INTERVAL '24 hours')");
        await pgPool.query("DELETE FROM stories WHERE expires_at <= NOW() OR created_at <= NOW() - INTERVAL '24 hours'");
      } catch {}
    }
  } catch (err) {
    console.error('Cleanup job error (non-fatal):', err);
  }
}
