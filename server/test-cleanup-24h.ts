import { getDb, queryAll, queryOne } from './db.js';
import { runCleanup } from './cron.js';

async function test24hCleanup() {
  console.log('Testing 24h Story and Temporary Media Auto-Cleanup...');

  const db = await getDb();

  // 1. Check users count before
  const usersBefore = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM users");
  const messagesBefore = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM private_messages");
  const roomsBefore = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM rooms");
  const ownerBefore = queryOne<{ id: string; username: string; coins: number }>(db, "SELECT id, username, coins FROM users WHERE role = 'owner'");

  console.log('Users before:', usersBefore?.c);
  console.log('Messages before:', messagesBefore?.c);
  console.log('Owner before:', ownerBefore?.username, 'Coins:', ownerBefore?.coins);

  // 2. Insert a simulated test story that expired 25 hours ago
  const expiredStoryId = 'test_story_expired_' + Date.now();
  const past25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  db.run(
    "INSERT INTO stories (id, user_id, content, media_url, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [expiredStoryId, ownerBefore!.id, 'قصة تجريبية منتهية', '', 'text', past25h, past25h]
  );

  // Insert a fresh active story that expires in 23 hours
  const activeStoryId = 'test_story_active_' + Date.now();
  const future23h = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  db.run(
    "INSERT INTO stories (id, user_id, content, media_url, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [activeStoryId, ownerBefore!.id, 'قصة تجريبية نشطة', '', 'text', future23h, new Date().toISOString()]
  );

  console.log('Inserted 1 expired story and 1 active story.');

  // 3. Execute runCleanup
  await runCleanup(db);
  console.log('runCleanup executed successfully.');

  // 4. Verify that expired story is deleted and active story is preserved
  const checkExpired = queryOne(db, "SELECT id FROM stories WHERE id = ?", [expiredStoryId]);
  const checkActive = queryOne(db, "SELECT id FROM stories WHERE id = ?", [activeStoryId]);

  console.log('Expired story found after cleanup (should be null):', checkExpired);
  console.log('Active story found after cleanup (should exist):', checkActive?.id);

  // 5. Clean up the test active story
  db.run("DELETE FROM stories WHERE id = ?", [activeStoryId]);

  // 6. Verify users, messages, and owner account are 100% UNTOUCHED
  const usersAfter = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM users");
  const messagesAfter = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM private_messages");
  const roomsAfter = queryOne<{ c: number }>(db, "SELECT count(*) as c FROM rooms");
  const ownerAfter = queryOne<{ id: string; username: string; coins: number }>(db, "SELECT id, username, coins FROM users WHERE role = 'owner'");

  console.log('Users after:', usersAfter?.c);
  console.log('Messages after:', messagesAfter?.c);
  console.log('Owner after:', ownerAfter?.username, 'Coins:', ownerAfter?.coins);

  const testPassed = 
    checkExpired === null &&
    checkActive !== null &&
    usersBefore?.c === usersAfter?.c &&
    messagesBefore?.c === messagesAfter?.c &&
    roomsBefore?.c === roomsAfter?.c &&
    ownerBefore?.coins === ownerAfter?.coins;

  if (testPassed) {
    console.log('\n>>> 24H AUTO-CLEANUP TEST PASSED 100% <<<');
    process.exit(0);
  } else {
    console.error('\n>>> TEST FAILED: DATA INTEGRITY MISMATCH <<<');
    process.exit(1);
  }
}

test24hCleanup().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
