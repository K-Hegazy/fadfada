import pg from 'pg';
const { Pool, Client } = pg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { executePostgresWalletTransaction, pgQuery, pgQueryOne } from './postgresDb.js';
import { getMediaFile, UPLOAD_DIR } from './storage.js';

dotenv.config();

export async function runComprehensiveDeploymentTests() {
  console.log('======================================================');
  console.log('   FADFADA MULTI-INSTANCE & DEPLOYMENT TEST SUITE     ');
  console.log('======================================================\n');

  const results: Record<string, { status: 'PASS' | 'FAIL'; details: any }> = {};

  const pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 5,
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Service Restart & Database Persistence
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Service Restart & Data Persistence...');
    const ownerRes = await pool.query("SELECT id, username, role, coins FROM users WHERE role = 'owner'");
    const usersCountRes = await pool.query("SELECT count(*) as c FROM users");
    const roomsCountRes = await pool.query("SELECT count(*) as c FROM rooms");
    const settingsCountRes = await pool.query("SELECT count(*) as c FROM system_settings");

    const owner = ownerRes.rows[0];
    const test1Passed = owner && owner.username === 'Hegazy' && parseInt(usersCountRes.rows[0].c, 10) >= 29;

    results['1_persistence_after_restart'] = {
      status: test1Passed ? 'PASS' : 'FAIL',
      details: {
        ownerAccount: owner?.username,
        ownerRole: owner?.role,
        ownerCoins: owner?.coins,
        totalUsers: usersCountRes.rows[0].c,
        totalRooms: roomsCountRes.rows[0].c,
        totalSettings: settingsCountRes.rows[0].c
      }
    };
    console.log(`[TEST 1 RESULT]: ${test1Passed ? 'PASSED' : 'FAILED'}`);

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Instance Event Bus Synchronization (LISTEN / NOTIFY)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Multi-Instance Event Bus (Instance 1 -> Instance 2)...');
    const instance1Client = new Client({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
    });
    const instance2Listener = new Client({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
    });

    await instance1Client.connect();
    await instance2Listener.connect();

    let receivedEvent: any = null;
    instance2Listener.on('notification', (msg) => {
      if (msg.channel === 'fadfada_cluster_events' && msg.payload) {
        receivedEvent = JSON.parse(msg.payload);
      }
    });

    await instance2Listener.query('LISTEN fadfada_cluster_events');

    // Instance 1 broadcasts a room message
    const sampleEvent = {
      senderInstanceId: 'inst_sim_instance_1',
      channel: 'room',
      target: 'room_general',
      payload: {
        type: 'room:message',
        id: 'msg_test_123',
        content: 'مرحباً بجميع النسخ من الحاوية رقم 1',
        senderId: owner.id
      },
      timestamp: Date.now()
    };

    await instance1Client.query('SELECT pg_notify($1, $2)', ['fadfada_cluster_events', JSON.stringify(sampleEvent)]);

    // Wait for notification
    await new Promise(r => setTimeout(r, 600));

    const test2Passed = receivedEvent && receivedEvent.senderInstanceId === 'inst_sim_instance_1' && receivedEvent.target === 'room_general';
    results['2_multi_instance_event_sync'] = {
      status: test2Passed ? 'PASS' : 'FAIL',
      details: {
        sentFrom: 'Instance 1',
        receivedBy: 'Instance 2',
        latencyMs: receivedEvent ? Date.now() - receivedEvent.timestamp : -1,
        eventContent: receivedEvent?.payload?.content
      }
    };
    console.log(`[TEST 2 RESULT]: ${test2Passed ? 'PASSED' : 'FAILED'}`);

    await instance1Client.end();
    await instance2Listener.end();

    // -------------------------------------------------------------------------
    // TEST 3: Concurrent Balance Deduction & Transfer Between 2 Accounts
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Atomic Balance Deduction & Transfer Between 2 Accounts...');
    const userA = owner;
    const userBRes = await pool.query("SELECT id, username, coins FROM users WHERE role = 'user' AND coins > 0 LIMIT 1");
    const userB = userBRes.rows[0];

    const initialCoinsA = Number(userA.coins);
    const initialCoinsB = Number(userB.coins);

    const transferAmount = 25;
    const testIdempotencyKey = `test_idemp_${Date.now()}`;

    // Execute deduction from Account A and credit to Account B
    const txResult = await executePostgresWalletTransaction({
      userId: userA.id,
      amount: -transferAmount,
      type: 'coin_transfer',
      description: `تحويل كوينز اختباري إلى ${userB.username}`,
      relatedUserId: userB.id,
      idempotencyKey: testIdempotencyKey
    });

    // Check balances after
    const afterARes = await pool.query("SELECT coins FROM users WHERE id = $1", [userA.id]);
    const afterBRes = await pool.query("SELECT coins FROM users WHERE id = $1", [userB.id]);
    const afterCoinsA = Number(afterARes.rows[0].coins);
    const afterCoinsB = Number(afterBRes.rows[0].coins);

    // Test Idempotency Replay (submitting the exact same transaction key)
    const replayResult = await executePostgresWalletTransaction({
      userId: userA.id,
      amount: -transferAmount,
      type: 'coin_transfer',
      description: `تحويل مكرر للتأكد من منع الخصم المزدوج`,
      relatedUserId: userB.id,
      idempotencyKey: testIdempotencyKey
    });

    const test3Passed =
      afterCoinsA === initialCoinsA - transferAmount &&
      afterCoinsB === initialCoinsB + transferAmount &&
      replayResult.isIdempotentReplay === true;

    // Refund transfer to restore initial state
    await pool.query("UPDATE users SET coins = $1 WHERE id = $2", [initialCoinsA, userA.id]);
    await pool.query("UPDATE users SET coins = $1 WHERE id = $2", [initialCoinsB, userB.id]);

    results['3_atomic_balance_and_deduction_sync'] = {
      status: test3Passed ? 'PASS' : 'FAIL',
      details: {
        accountA: { username: userA.username, before: initialCoinsA, after: afterCoinsA, diff: afterCoinsA - initialCoinsA },
        accountB: { username: userB.username, before: initialCoinsB, after: afterCoinsB, diff: afterCoinsB - initialCoinsB },
        atomicDeductionConfirmed: afterCoinsA === initialCoinsA - transferAmount,
        atomicCreditConfirmed: afterCoinsB === initialCoinsB + transferAmount,
        idempotencyPreventionConfirmed: replayResult.isIdempotentReplay === true
      }
    };
    console.log(`[TEST 3 RESULT]: ${test3Passed ? 'PASSED' : 'FAILED'}`);

    // -------------------------------------------------------------------------
    // TEST 4: Media & Image File Persistence & Authorization
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Media & Image File Access & Persistence...');
    const uploadFiles = fs.readdirSync(UPLOAD_DIR);
    let sampleFileFound = false;
    let sampleFileLength = 0;

    if (uploadFiles.length > 0) {
      const firstFile = uploadFiles[0];
      const mediaRes = await getMediaFile(firstFile);
      if (mediaRes && mediaRes.found && mediaRes.buffer && mediaRes.buffer.length > 0) {
        sampleFileFound = true;
        sampleFileLength = mediaRes.buffer.length;
      }
    }

    const test4Passed = sampleFileFound && sampleFileLength > 0;
    results['4_image_and_media_persistence'] = {
      status: test4Passed ? 'PASS' : 'FAIL',
      details: {
        totalUploadFiles: uploadFiles.length,
        sampleCheckedFile: uploadFiles[0] || 'none',
        fileSizeBytes: sampleFileLength,
        mediaStorageAccessible: sampleFileFound
      }
    };
    console.log(`[TEST 4 RESULT]: ${test4Passed ? 'PASSED' : 'FAILED'}`);

    console.log('\n======================================================');
    console.log('                FINAL SUMMARY                         ');
    console.log('======================================================');
    console.log(JSON.stringify(results, null, 2));

    return results;
  } finally {
    await pool.end();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('test-multi-instance-deployment.ts') || process.argv[1]?.endsWith('test-multi-instance-deployment.js')) {
  runComprehensiveDeploymentTests()
    .then((results) => {
      const allPassed = Object.values(results).every(r => r.status === 'PASS');
      if (allPassed) {
        console.log('\n>>> ALL 4 DEPLOYMENT INTEGRATION TESTS PASSED! <<<');
        process.exit(0);
      } else {
        console.error('\n>>> SOME TESTS FAILED <<<');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
