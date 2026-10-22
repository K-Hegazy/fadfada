import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;
import { getDb, queryAll, queryOne, saveDbSync } from './db.js';
import { authenticateToken, createSession } from './auth.js';

export async function runTestCleanup(existingDb?: any) {
  console.log('====================================================');
  console.log('🧹 تنظيف كافة الحسابات مع الإبقاء الحصري على حساب المالك');
  console.log('====================================================');

  const dbFile = path.resolve(process.cwd(), 'data', 'fadfada.sqlite');
  if (!fs.existsSync(dbFile)) {
    throw new Error('قاعدة البيانات fadfada.sqlite غير موجودة!');
  }

  // 1. Full Backup Before Cleanup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'data', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `fadfada_before_purge_all_non_owner_${timestamp}.sqlite`);
  fs.copyFileSync(dbFile, backupFile);

  const preBackupHash = crypto.createHash('sha256').update(fs.readFileSync(backupFile)).digest('hex');
  console.log(`[1/5] تم حفظ نسخة احتياطية كاملة قبل أي تعديل:`);
  console.log(`  * المسار: ${backupFile}`);
  console.log(`  * البصمة الرقمية (SHA256): ${preBackupHash}`);

  const db = existingDb || await getDb();
  const allUsers = queryAll(db, 'SELECT id, username, email, role, is_guest, created_at FROM users');
  console.log(`\n[2/5] إجمالي المستخدمين قبل التنظيف: ${allUsers.length}`);

  // Identification Logic: Preserve ONLY genuine Owner (Hegazy)
  const isOwner = (u: any) => {
    return u.role === 'owner' || u.username === 'Hegazy' || (u.email && u.email === 'hegazymr6@gmail.com');
  };

  const usersToDelete: any[] = [];
  const keptOwner: any[] = [];

  for (const u of allUsers) {
    if (isOwner(u)) {
      keptOwner.push(u);
    } else {
      usersToDelete.push(u);
    }
  }

  console.log(`- حساب المالك المحفوظ: ${keptOwner.length}`);
  console.log(`- الحسابات المراد حذفها نهائياً: ${usersToDelete.length}`);

  // 3. Deletion Execution in SQLite
  console.log('\n[3/5] حذف الحسابات وبياناتها المرتبطة من SQLite...');
  const idsToDelete = usersToDelete.map(u => u.id);

  if (idsToDelete.length > 0) {
    const placeholders = idsToDelete.map(() => '?').join(',');

    const relatedQueries = [
      { table: 'sessions', col: 'user_id' },
      { table: 'room_members', col: 'user_id' },
      { table: 'room_messages', col: 'sender_id' },
      { table: 'room_reactions', col: 'user_id' },
      { table: 'private_messages', col: 'sender_id' },
      { table: 'private_messages', col: 'recipient_id' },
      { table: 'private_conversations', col: 'user1_id' },
      { table: 'private_conversations', col: 'user2_id' },
      { table: 'private_reactions', col: 'user_id' },
      { table: 'friendships', col: 'user_id' },
      { table: 'friendships', col: 'friend_id' },
      { table: 'friend_requests', col: 'sender_id' },
      { table: 'friend_requests', col: 'receiver_id' },
      { table: 'stories', col: 'user_id' },
      { table: 'story_views', col: 'viewer_id' },
      { table: 'notifications', col: 'user_id' },
      { table: 'user_mission_progress', col: 'user_id' },
      { table: 'user_achievements', col: 'user_id' },
      { table: 'event_participants', col: 'user_id' },
      { table: 'gift_transactions', col: 'sender_id' },
      { table: 'wallet_transactions', col: 'user_id' },
      { table: 'wallet_transactions', col: 'related_user_id' },
      { table: 'reports', col: 'reporter_id' },
      { table: 'blocks', col: 'user_id' },
      { table: 'blocks', col: 'blocked_user_id' },
      { table: 'mutes', col: 'user_id' },
      { table: 'mutes', col: 'muted_user_id' },
      { table: 'user_interests', col: 'user_id' },
      { table: 'user_inventory', col: 'user_id' },
      { table: 'email_verifications', col: 'user_id' },
      { table: 'password_resets', col: 'user_id' },
      { table: 'user_game_records', col: 'user_id' },
      { table: 'active_audio_speakers', col: 'user_id' },
      { table: 'post_likes', col: 'user_id' },
      { table: 'terms_agreements', col: 'user_id' },
      { table: 'random_sessions', col: 'user1_id' },
      { table: 'random_sessions', col: 'user2_id' },
    ];

    for (const q of relatedQueries) {
      try {
        db.run(`DELETE FROM ${q.table} WHERE ${q.col} IN (${placeholders})`, idsToDelete);
      } catch (err: any) {}
    }

    db.run(`DELETE FROM users WHERE id IN (${placeholders})`, idsToDelete);
    saveDbSync();
    console.log(`✅ تم حذف ${idsToDelete.length} حساب غير مالك وسجلاتهم من SQLite.`);
  }

  // Mirror to Cloud SQL PostgreSQL if configured
  if (process.env.SQL_HOST && idsToDelete.length > 0) {
    try {
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
        await client.query("DELETE FROM sessions WHERE user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM private_messages WHERE sender_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1) OR recipient_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM private_conversations WHERE user1_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1) OR user2_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM friend_requests WHERE sender_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1) OR receiver_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM friendships WHERE user1_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1) OR user2_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM room_members WHERE user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM room_messages WHERE sender_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM user_inventory WHERE user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM wallet_transactions WHERE user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM notifications WHERE user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM terms_agreements WHERE user_id IS NOT NULL AND user_id != (SELECT id FROM users WHERE role = 'owner' LIMIT 1)");
        await client.query("DELETE FROM users WHERE role != 'owner'");
        await client.query('COMMIT');
        console.log(`✅ تم تأكيد حذف الحسابات غير المالك من Cloud SQL PostgreSQL.`);
      } catch (pgErr: any) {
        await client.query('ROLLBACK');
        console.warn('[PostgreSQL Sync Warning]:', pgErr.message);
      } finally {
        client.release();
        await pool.end();
      }
    } catch (e: any) {
      console.warn('[PostgreSQL Pool Warning]:', e.message);
    }
  }

  // 4. Verify Owner Account Integrity
  console.log('\n[4/5] التحقق من سلامة حساب المالك وصلاحياته...');
  const owner = queryOne(db, "SELECT * FROM users WHERE username = 'Hegazy' OR role = 'owner'");
  if (!owner) {
    throw new Error('❌ تحذير حرج: تعذر العثور على حساب المالك!');
  }
  console.log(`- اسم المستخدم: ${owner.username}`);
  console.log(`- البريد الإلكتروني: ${owner.email}`);
  console.log(`- الرتبة: ${owner.role}`);
  console.log(`- رصيد الكوينز: ${owner.coins}`);

  // Test creating a fresh session for the owner
  const token = createSession(db, owner.id);
  const verifiedSession = authenticateToken(db, token);
  if (!verifiedSession || verifiedSession.userId !== owner.id || verifiedSession.role !== 'owner') {
    throw new Error('❌ فشل التحقق من جلسة المالك بعد التنظيف!');
  }
  console.log(`✅ تم تأكيد عمل حساب المالك وإنشاء جلسة نشطة بنجاح.`);

  // 5. Final Statistics
  const remainingUsers = queryAll(db, 'SELECT id, username, email, role, is_guest FROM users');
  console.log(`\n[5/5] إحصائيات ما بعد التنظيف:`);
  console.log(`- عدد الحسابات المتبقية: ${remainingUsers.length} (فقط حساب المالك)`);

  const report = {
    backupFile,
    preBackupHash,
    deletedCount: usersToDelete.length,
    remainingCount: remainingUsers.length,
    ownerVerified: {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      role: owner.role,
      active: true
    }
  };

  const reportPath = path.join(backupDir, `cleanup_report_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 تم حفظ تقرير التنظيف في: ${reportPath}`);
  console.log('====================================================');
  return report;
}

if (process.argv[1]?.endsWith('cleanup-tests.ts') || process.argv[1]?.endsWith('cleanup-tests.js')) {
  runTestCleanup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}
