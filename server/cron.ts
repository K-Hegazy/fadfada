import fs from 'fs';
import path from 'path';
import { Database as SqlDatabase } from 'sql.js';
import { queryAll, saveDbSync } from './db';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
const UPLOAD_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'fadfada.sqlite');

export function initCronJobs(db: SqlDatabase) {
  // Ensure backups directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Run initial backup on startup
  runDatabaseBackup(db);

  // Run cleanup every 10 minutes
  setInterval(() => {
    runCleanup(db);
  }, 10 * 60 * 1000);

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

    // Maintain max 5 recent backups
    const existingBackups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('fadfada_backup_') && f.endsWith('.sqlite'))
      .sort();

    if (existingBackups.length > 5) {
      const toDelete = existingBackups.slice(0, existingBackups.length - 5);
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

export function runCleanup(db: SqlDatabase) {
  try {
    const nowIso = new Date().toISOString();

    // 1. Clean expired stories and their media files
    const expiredStories = queryAll<{ id: string; media_url: string }>(
      db,
      "SELECT id, media_url FROM stories WHERE expires_at <= CURRENT_TIMESTAMP"
    );

    for (const story of expiredStories) {
      if (story.media_url && story.media_url.startsWith('/uploads/')) {
        const fileName = story.media_url.replace('/uploads/', '');
        const filePath = path.join(UPLOAD_DIR, fileName);
        // Only delete file if not used elsewhere
        const otherRef = queryAll(
          db,
          "SELECT id FROM stories WHERE media_url = ? AND id != ?",
          [story.media_url, story.id]
        );
        if (otherRef.length === 0 && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
      db.run("DELETE FROM stories WHERE id = ?", [story.id]);
    }

    // 2. Physical cleanup of viewed View-Once media files (Server-Side Destruction)
    const viewedViewOnce = queryAll<{ id: string; media_url: string }>(
      db,
      "SELECT id, media_url FROM private_messages WHERE is_view_once = 1 AND is_viewed = 1 AND media_url != ''"
    );

    for (const msg of viewedViewOnce) {
      if (msg.media_url && msg.media_url.startsWith('/uploads/')) {
        const fileName = msg.media_url.replace('/uploads/', '');
        const filePath = path.join(UPLOAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
      // Blank out media_url to permanently prevent further access
      db.run("UPDATE private_messages SET media_url = '' WHERE id = ?", [msg.id]);
    }

    // 3. Physical cleanup of self-destructed messages
    const destroyedMsgs = queryAll<{ id: string; media_url: string }>(
      db,
      "SELECT id, media_url FROM private_messages WHERE is_self_destruct = 1 AND is_destroyed = 1 AND media_url != ''"
    );

    for (const msg of destroyedMsgs) {
      if (msg.media_url && msg.media_url.startsWith('/uploads/')) {
        const fileName = msg.media_url.replace('/uploads/', '');
        const filePath = path.join(UPLOAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
      db.run("UPDATE private_messages SET media_url = '' WHERE id = ?", [msg.id]);
    }

    // 4. Clean expired sessions (> 30 days inactive)
    db.run("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");

    // 5. Clean expired password reset tokens (> 2 hours old)
    db.run("DELETE FROM password_resets WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL");

    // 6. Clean unverified email verification tokens older than 48 hours
    db.run("DELETE FROM email_verifications WHERE expires_at < CURRENT_TIMESTAMP OR verified_at IS NOT NULL");

    saveDbSync();
  } catch (err) {
    console.error('Cleanup job error (non-fatal):', err);
  }
}
