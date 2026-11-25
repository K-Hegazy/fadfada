import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  Account as ClientAccount,
  Channel,
  Client as WebClient,
  ExecutionMethod,
  Functions as ClientFunctions,
  ID,
  Permission,
  Query as ClientQuery,
  Realtime,
  Role,
  Storage as ClientStorage,
  TablesDB as ClientTablesDB,
} from 'appwrite';
import {
  Client as ServerClient,
  Functions as ServerFunctions,
  Query as ServerQuery,
  Storage as ServerStorage,
  TablesDB as ServerTablesDB,
  Users as ServerUsers,
} from 'node-appwrite';

interface GeneratedResources {
  provisioned: boolean;
  endpoint: string;
  projectId: string;
  databaseId: string;
  bucketId: string;
  economyFunctionId: string;
  adminFunctionId: string;
  tables: Record<string, string>;
}

function deterministicConvId(uidA: string, uidB: string): string {
  const [p1, p2] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  const raw = `${p1}_${p2}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + ((h1 << 5) | (h1 >>> 27));
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `c_${h1.toString(36)}${h2.toString(36)}`.slice(0, 32);
}

function deterministicMarriageId(uidA: string, uidB: string): string {
  const [p1, p2] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  const raw = `${p1}_${p2}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + ((h1 << 5) | (h1 >>> 27));
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `m_${h1.toString(36)}${h2.toString(36)}`.slice(0, 32);
}

function deterministicRelId(uidA: string, uidB: string): string {
  const [p1, p2] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  const raw = `${p1}_${p2}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + ((h1 << 5) | (h1 >>> 27));
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `r_${h1.toString(36)}${h2.toString(36)}`.slice(0, 32);
}

function attachSessionFromResponse(client: WebClient, res: Response): void {
  const fallback = res.headers.get('x-fallback-cookies');
  if (fallback) {
    (client as unknown as { headers: Record<string, string> }).headers['X-Fallback-Cookies'] = fallback;
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const cookiePair = setCookie
      .split(/,(?=[^;]+=[^;]+)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    if (cookiePair) client.setCookie(cookiePair);
  }
}

async function runLiveVerify(): Promise<void> {
  const resourcesPath = path.resolve(process.cwd(), 'src', 'appwrite', 'resources.json');
  const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8')) as GeneratedResources;

  assert.equal(resources.provisioned, true, 'Appwrite resources are not provisioned yet. Run npm run appwrite:setup first.');
  assert.ok(resources.endpoint && resources.projectId, 'Missing endpoint or projectId in resources.json');
  assert.ok(resources.databaseId && resources.bucketId, 'Missing databaseId or bucketId in resources.json');
  assert.ok(resources.economyFunctionId && resources.adminFunctionId, 'Missing function IDs in resources.json');

  const apiKey = (process.env.APPWRITE_API_KEY || '').trim();
  assert.ok(apiKey, 'APPWRITE_API_KEY is required to run live integration verification & cleanup.');

  const serverClient = new ServerClient()
    .setEndpoint(resources.endpoint)
    .setProject(resources.projectId)
    .setKey(apiKey);
  const serverTables = new ServerTablesDB(serverClient);
  const serverStorage = new ServerStorage(serverClient);
  const serverFunctions = new ServerFunctions(serverClient);
  const serverUsers = new ServerUsers(serverClient);

  const createdUserIds: string[] = [];
  const createdRowCleanups: Array<{ tableId: string; rowId: string; client?: ClientTablesDB }> = [];
  const createdFileIds: Array<{ fileId: string; client?: ClientStorage }> = [];
  const failures: string[] = [];

  const check = async (label: string, fn: () => Promise<void>): Promise<boolean> => {
    try {
      await fn();
      console.log(`PASS [${label}]`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAIL [${label}]: ${msg}`);
      failures.push(`${label}: ${msg}`);
      return false;
    }
  };

  const cleanup = async () => {
    for (const item of createdFileIds) {
      await serverStorage
        .deleteFile({ bucketId: resources.bucketId, fileId: item.fileId })
        .catch(() => item.client?.deleteFile({ bucketId: resources.bucketId, fileId: item.fileId }))
        .catch(() => {});
    }
    for (const uid of createdUserIds) {
      for (const tbl of [resources.tables.dailyClaims, resources.tables.notifications, resources.tables.matchQueue]) {
        const list = await serverTables
          .listRows({ databaseId: resources.databaseId, tableId: tbl, queries: [ServerQuery.limit(50)] })
          .catch(() => ({ rows: [] }));
        for (const r of list.rows) {
          const rowObj = r as { $id: string; uid?: string; userId?: string; recipientId?: string; senderId?: string };
          if (rowObj.uid === uid || rowObj.userId === uid || rowObj.recipientId === uid || rowObj.senderId === uid) {
            await serverTables
              .deleteRow({ databaseId: resources.databaseId, tableId: tbl, rowId: rowObj.$id })
              .catch(() => {});
          }
        }
      }
      const txList = await serverTables
        .listRows({ databaseId: resources.databaseId, tableId: resources.tables.coinTransactions, queries: [ServerQuery.limit(50)] })
        .catch(() => ({ rows: [] }));
      for (const r of txList.rows) {
        const rowObj = r as { $id: string; senderId?: string; recipientId?: string };
        if (rowObj.senderId === uid || rowObj.recipientId === uid) {
          await serverTables
            .deleteRow({ databaseId: resources.databaseId, tableId: resources.tables.coinTransactions, rowId: rowObj.$id })
            .catch(() => {});
        }
      }
    }
    for (const item of createdRowCleanups) {
      await serverTables
        .deleteRow({ databaseId: resources.databaseId, tableId: item.tableId, rowId: item.rowId })
        .catch(() => item.client?.deleteRow({ databaseId: resources.databaseId, tableId: item.tableId, rowId: item.rowId }))
        .catch(() => {});
    }
    for (const uid of createdUserIds) {
      await serverUsers.delete({ userId: uid }).catch(() => {});
    }
  };

  const execEconomy = async (
    fns: ClientFunctions,
    action: string,
    payload: Record<string, unknown> = {}
  ) => {
    const exec = await fns.createExecution({
      functionId: resources.economyFunctionId,
      body: JSON.stringify({ action, ...payload }),
      async: false,
      xpath: '/',
      method: ExecutionMethod.POST,
      headers: { 'content-type': 'application/json' },
    });
    const parsed = JSON.parse(exec.responseBody || '{}') as {
      ok?: boolean;
      data?: Record<string, unknown>;
      error?: string;
    };
    return { status: exec.responseStatusCode, parsed, raw: exec.responseBody };
  };

  try {
    // 1. Provisioned Resources Audit
    await check('Provisioned Resources', async () => {
      const db = await serverTables.get({ databaseId: resources.databaseId });
      assert.equal(db.$id, resources.databaseId);

      const tablesList = await serverTables.listTables({
        databaseId: resources.databaseId,
        queries: [ServerQuery.limit(100)],
      });
      assert.ok(tablesList.tables.length >= 31, `Expected >= 31 tables, got ${tablesList.tables.length}`);

      const bucket = await serverStorage.getBucket({ bucketId: resources.bucketId });
      assert.equal(bucket.$id, resources.bucketId);

      const usersIdx = await serverTables.listIndexes({
        databaseId: resources.databaseId,
        tableId: resources.tables.users,
        queries: [ServerQuery.limit(100)],
      });
      const messagesIdx = await serverTables.listIndexes({
        databaseId: resources.databaseId,
        tableId: resources.tables.messages,
        queries: [ServerQuery.limit(100)],
      });
      const roomMessagesIdx = await serverTables.listIndexes({
        databaseId: resources.databaseId,
        tableId: resources.tables.roomMessages,
        queries: [ServerQuery.limit(100)],
      });
      const userIdxKeys = new Set(usersIdx.indexes.map((i) => i.key));
      const msgIdxKeys = new Set(messagesIdx.indexes.map((i) => i.key));
      const roomMsgIdxKeys = new Set(roomMessagesIdx.indexes.map((i) => i.key));
      assert.ok(userIdxKeys.has('idx_role') && userIdxKeys.has('idx_last_seen'), 'Missing users indexes (idx_role, idx_last_seen)');
      assert.ok(msgIdxKeys.has('idx_msg_created'), 'Missing messages index (idx_msg_created)');
      assert.ok(roomMsgIdxKeys.has('idx_room_msg_created'), 'Missing room_messages index (idx_room_msg_created)');

      const econFn = await serverFunctions.get({ functionId: resources.economyFunctionId });
      const adminFn = await serverFunctions.get({ functionId: resources.adminFunctionId });
      assert.ok(econFn.deploymentId, 'fadfada-economy has no active deployment');
      assert.ok(adminFn.deploymentId, 'fadfada-admin has no active deployment');
      console.log(
        `  -> DB=${db.$id}, Tables=${tablesList.tables.length}/31, Bucket=${bucket.$id}, Indexes=verified, EconScopes=[${(econFn.scopes || []).join(',')}], AdminScopes=[${(adminFn.scopes || []).join(',')}]`
      );
    });

    // 2. Check Function & API Key Required Scopes (2-function free-plan setup)
    await check('Function Scopes (users.read, users.write, rows.read, rows.write, files)', async () => {
      const econFn = await serverFunctions.get({ functionId: resources.economyFunctionId });
      const adminFn = await serverFunctions.get({ functionId: resources.adminFunctionId });
      const required = ['users.read', 'users.write', 'rows.read', 'rows.write', 'databases.read', 'tables.read'];
      const requiredAdminFiles = ['files.read', 'files.write'];
      const missingEcon = required.filter((s) => !(econFn.scopes || []).includes(s));
      const missingAdmin = [...required, ...requiredAdminFiles].filter((s) => !(adminFn.scopes || []).includes(s));
      assert.ok(
        missingEcon.length === 0 && missingAdmin.length === 0,
        `Missing Function scopes -> fadfada-economy:[${missingEcon.join(', ')}], fadfada-admin:[${missingAdmin.join(', ')}]`
      );
    });

    // 3. Member Signup & Email/Password Auth (Client A)
    const clientA = new WebClient().setEndpoint(resources.endpoint).setProject(resources.projectId);
    const accountA = new ClientAccount(clientA);
    const emailA = `verify_a_${Date.now()}@fadfada.test`;
    const passA = 'FadfadaVerify!123';
    let userAId = '';

    await check('Member Auth (Email/Password Signup & Session)', async () => {
      const userA = await accountA.create({
        userId: ID.unique(),
        email: emailA,
        password: passA,
        name: 'اختبار أ',
      });
      userAId = userA.$id;
      createdUserIds.push(userAId);

      const sessAResp = await fetch(`${resources.endpoint}/account/sessions/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-appwrite-project': resources.projectId,
        },
        body: JSON.stringify({ email: emailA, password: passA }),
      });
      assert.ok(sessAResp.ok, `Email session creation failed: ${await sessAResp.text()}`);
      attachSessionFromResponse(clientA, sessAResp);
      const me = await accountA.get();
      assert.equal(me.$id, userAId);
    });

    const fnsA = new ClientFunctions(clientA);
    const tablesA = new ClientTablesDB(clientA);

    // 4. Guest/Anonymous Session & Guest -> Member Upgrade (Client B)
    const clientB = new WebClient().setEndpoint(resources.endpoint).setProject(resources.projectId);
    const accountB = new ClientAccount(clientB);
    let userBId = '';
    let jwtB = '';

    await check('Anonymous Session & Guest -> Member Upgrade', async () => {
      const sessBResp = await fetch(`${resources.endpoint}/account/sessions/anonymous`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-appwrite-project': resources.projectId,
        },
        body: '{}',
      });
      const guestSess = (await sessBResp.json()) as { userId: string; message?: string };
      assert.ok(sessBResp.ok && guestSess.userId, `Anonymous session failed: ${guestSess.message || sessBResp.status}`);
      attachSessionFromResponse(clientB, sessBResp);
      userBId = guestSess.userId;
      createdUserIds.push(userBId);

      const meGuest = await accountB.get();
      assert.equal(meGuest.$id, userBId);
      assert.equal(meGuest.email, '');

      const jwtObj = await accountB.createJWT();
      jwtB = jwtObj.jwt;

      const upgradedEmailB = `verify_b_${Date.now()}@fadfada.test`;
      await accountB.updateEmail({ email: upgradedEmailB, password: passA });
      const meMember = await accountB.get();
      assert.equal(meMember.email, upgradedEmailB);
    });

    const fnsB = new ClientFunctions(clientB);
    const tablesB = new ClientTablesDB(clientB);

    // 5. Server-Authoritative Profile + PII Isolation via fadfada-economy
    let economyReady = false;
    await check('Functions Profile & PII Isolation (ensureProfile)', async () => {
      assert.ok(userAId && userBId, 'Skipped because Auth sessions failed');
      const profileARes = await execEconomy(fnsA, 'ensureProfile');
      assert.equal(profileARes.parsed.ok, true, `ensureProfile A failed: ${profileARes.raw}`);
      assert.equal(profileARes.parsed.data?.role, 'member');
      createdRowCleanups.push({ tableId: resources.tables.users, rowId: userAId });
      createdRowCleanups.push({ tableId: resources.tables.userPrivate, rowId: userAId });

      const profileBRes = await execEconomy(fnsB, 'ensureProfile');
      assert.equal(profileBRes.parsed.ok, true, `ensureProfile B failed: ${profileBRes.raw}`);
      createdRowCleanups.push({ tableId: resources.tables.users, rowId: userBId });
      createdRowCleanups.push({ tableId: resources.tables.userPrivate, rowId: userBId });

      const publicRowA = await tablesA.getRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.users,
        rowId: userAId,
      });
      assert.equal('email' in publicRowA, false, 'Public user row leaked email field');
      const privateRowA = await tablesA.getRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.userPrivate,
        rowId: userAId,
      });
      assert.equal(privateRowA.email, emailA);

      await assert.rejects(() =>
        tablesB.getRow({
          databaseId: resources.databaseId,
          tableId: resources.tables.userPrivate,
          rowId: userAId,
        })
      );
      economyReady = true;
    });

    // 6. Presence Heartbeat (syncPresence)
    await check('Online Presence (syncPresence)', async () => {
      assert.ok(economyReady, 'Blocked by missing function scopes on fadfada-economy');
      const presRes = await execEconomy(fnsA, 'syncPresence', { isOnline: true });
      assert.equal(presRes.parsed.ok, true, `syncPresence failed: ${presRes.raw}`);
      const afterPres = await tablesA.getRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.users,
        rowId: userAId,
      });
      assert.equal(afterPres.isOnline, true);
    });

    // 7. Economy + Verified Daily Tasks + Gifts + Marriage + Notifications
    await check('Economy, Verified Daily Tasks, Gifts, Marriage & Notifications', async () => {
      assert.ok(economyReady, 'Blocked by missing function scopes on fadfada-economy');

      // Incomplete task must be rejected (400) before user performs the action
      const incompleteEngage = await execEconomy(fnsA, 'claimDailyReward', { taskKey: 'engage' });
      assert.equal(incompleteEngage.status, 400, `Expected 400 for incomplete engage, got ${incompleteEngage.status}`);

      // Complete engage (DM), share, ad_watch, referral
      const preEngageDm = await execEconomy(fnsA, 'sendPrivateMessage', {
        recipientId: userBId,
        text: 'رسالة تفعيل المهمة اليومية',
        type: 'text',
      });
      assert.equal(preEngageDm.parsed.ok, true, `pre-engage DM failed: ${preEngageDm.raw}`);
      if (preEngageDm.parsed.data?.conversationId) {
        createdRowCleanups.push({ tableId: resources.tables.conversations, rowId: String(preEngageDm.parsed.data.conversationId) });
      }
      if (preEngageDm.parsed.data?.messageId) {
        createdRowCleanups.push({ tableId: resources.tables.messages, rowId: String(preEngageDm.parsed.data.messageId) });
      }

      const shareAct = await execEconomy(fnsA, 'recordDailyTaskActivity', { kind: 'share' });
      assert.equal(shareAct.parsed.ok, true, `recordDailyTaskActivity(share) failed: ${shareAct.raw}`);
      const adAct = await execEconomy(fnsA, 'recordDailyTaskActivity', { kind: 'ad_watch' });
      assert.equal(adAct.parsed.ok, true, `recordDailyTaskActivity(ad_watch) failed: ${adAct.raw}`);

      for (const taskKey of ['checkin', 'engage', 'share', 'ad_watch']) {
        const claimRes = await execEconomy(fnsA, 'claimDailyReward', { taskKey });
        assert.equal(claimRes.parsed.ok, true, `claimDailyReward(${taskKey}) failed: ${claimRes.raw}`);
      }
      const refClaim = await execEconomy(fnsA, 'claimDailyReward', {
        taskKey: 'referral',
        referralCode: userBId.slice(0, 8).toUpperCase(),
      });
      assert.equal(refClaim.parsed.ok, true, `claimDailyReward(referral) failed: ${refClaim.raw}`);

      const progressRes = await execEconomy(fnsA, 'getDailyTaskProgress');
      assert.equal(progressRes.parsed.ok, true, `getDailyTaskProgress failed: ${progressRes.raw}`);
      assert.equal((progressRes.parsed.data?.claimedByKey as Record<string, boolean>)?.engage, true);

      const wheelRes = await execEconomy(fnsA, 'claimDailyReward', { taskKey: 'daily_wheel' });
      assert.equal(wheelRes.parsed.ok, true, `claimDailyReward(daily_wheel) failed: ${wheelRes.raw}`);
      assert.equal(typeof wheelRes.parsed.data?.wheelIndex, 'number', 'daily_wheel must return wheelIndex');
      assert.ok(Number(wheelRes.parsed.data?.rewardCoins ?? 0) >= 25, 'daily_wheel must return server rewardCoins');

      const transferRes = await execEconomy(fnsA, 'transferCoins', { recipientId: userBId, amount: 15 });
      assert.equal(transferRes.parsed.ok, true, `transferCoins failed: ${transferRes.raw}`);

      const buyRes = await execEconomy(fnsA, 'purchaseStoreItem', { itemId: 'feat_themes', priceCoins: 1 });
      assert.equal(buyRes.parsed.ok, true, `purchaseStoreItem failed: ${buyRes.raw}`);

      const giftRes = await execEconomy(fnsA, 'sendGift', {
        recipientId: userBId,
        giftId: 'gift_coffee',
        alsoInChat: false,
      });
      assert.equal(giftRes.parsed.ok, true, `sendGift failed: ${giftRes.raw}`);

      const proposeRes = await execEconomy(fnsA, 'proposeMarriage', {
        partnerId: userBId,
        dowry: 50,
        message: 'اختبار زواج حي',
      });
      assert.equal(proposeRes.parsed.ok, true, `proposeMarriage failed: ${proposeRes.raw}`);
      const marriageId = deterministicMarriageId(userAId, userBId);
      createdRowCleanups.push({ tableId: resources.tables.marriages, rowId: marriageId });

      const acceptMarriageRes = await execEconomy(fnsB, 'respondMarriage', {
        marriageId,
        accept: true,
      });
      assert.equal(acceptMarriageRes.parsed.ok, true, `respondMarriage failed: ${acceptMarriageRes.raw}`);

      const bNotifs = await tablesB.listRows({
        databaseId: resources.databaseId,
        tableId: resources.tables.notifications,
        queries: [ClientQuery.equal('recipientId', userBId), ClientQuery.limit(20)],
      });
      assert.ok(bNotifs.rows.length >= 2, 'Expected notifications on B from gift/marriage');
    });

    // 8. Random Match
    await check('Random Match Queue & Pairing', async () => {
      assert.ok(economyReady, 'Blocked by missing function scopes on fadfada-economy');
      const matchA = await execEconomy(fnsA, 'joinRandomMatch', { mode: 'text', preferredGender: 'all' });
      assert.equal(matchA.parsed.ok, true, `joinRandomMatch A failed: ${matchA.raw}`);
      const matchB = await execEconomy(fnsB, 'joinRandomMatch', { mode: 'text', preferredGender: 'all' });
      assert.equal(matchB.parsed.ok, true, `joinRandomMatch B failed: ${matchB.raw}`);
      const matchSessionId = String(matchB.parsed.data?.matchedSessionId || '');
      assert.ok(matchSessionId, 'Random match did not pair A and B');
      createdRowCleanups.push({ tableId: resources.tables.matchSessions, rowId: matchSessionId });
    });

    // 9. Owner Account, Bootstrap, Login & Admin RBAC Isolation
    await check('Owner Account (Exists, Verified, Role=owner, Login & Non-owner Blocked)', async () => {
      const usersList = await serverUsers.list({ queries: [ServerQuery.limit(100)] });
      const ownerEmails = new Set(['owner@fadfada.app', 'hegazymr6@gmail.com']);
      const ownerAuth = usersList.users.find(
        (u) => ownerEmails.has(String(u.email || '').toLowerCase()) && u.emailVerification
      ) || usersList.users.find((u) => ownerEmails.has(String(u.email || '').toLowerCase()));
      assert.ok(
        ownerAuth,
        'Owner Auth account (hegazymr6@gmail.com or owner@fadfada.app) does not exist in Appwrite'
      );
      assert.equal(ownerAuth.emailVerification, true, 'Owner Auth account emailVerification must be true');
      assert.equal(ownerAuth.status, true, 'Owner Auth account must be active');

      // Verify Owner can authenticate into a real Appwrite client session & run owner actions
      const token = await serverUsers.createToken({ userId: ownerAuth.$id });
      const ownerClient = new WebClient().setEndpoint(resources.endpoint).setProject(resources.projectId);
      const ownerSessResp = await fetch(`${resources.endpoint}/account/sessions/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-appwrite-project': resources.projectId,
        },
        body: JSON.stringify({ userId: ownerAuth.$id, secret: token.secret }),
      });
      assert.ok(ownerSessResp.ok, `Owner session creation failed: ${await ownerSessResp.text()}`);
      attachSessionFromResponse(ownerClient, ownerSessResp);
      const ownerAccount = new ClientAccount(ownerClient);
      const ownerMe = await ownerAccount.get();
      assert.equal(ownerMe.$id, ownerAuth.$id);
      assert.equal(ownerEmails.has(String(ownerMe.email || '').toLowerCase()), true);

      const ownerFns = new ClientFunctions(ownerClient);
      const ownerEnsure = await execEconomy(ownerFns, 'ensureProfile');
      assert.equal(ownerEnsure.parsed.ok, true, `Owner ensureProfile failed: ${ownerEnsure.raw}`);
      assert.equal(ownerEnsure.parsed.data?.role, 'owner');

      const ownerDbRow = await serverTables.getRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.users,
        rowId: ownerAuth.$id,
      });
      assert.equal(ownerDbRow.role, 'owner', `Expected owner row role='owner', got ${String(ownerDbRow.role)}`);

      const ownerAdminExec = await ownerFns.createExecution({
        functionId: resources.adminFunctionId,
        body: JSON.stringify({ action: 'ensureStaffDefaults' }),
        async: false,
        xpath: '/',
        method: ExecutionMethod.POST,
        headers: { 'content-type': 'application/json' },
      });
      assert.equal(
        ownerAdminExec.responseStatusCode,
        200,
        `Expected owner admin action HTTP 200, got ${ownerAdminExec.responseStatusCode}: ${ownerAdminExec.responseBody}`
      );
      await ownerAccount.deleteSession({ sessionId: 'current' }).catch(() => {});

      // Verify Non-owner CANNOT obtain owner permissions or call admin actions
      const nonOwnerRow = await tablesA.getRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.users,
        rowId: userAId,
      });
      assert.notEqual(nonOwnerRow.role, 'owner');
      const adminBlockExec = await fnsA.createExecution({
        functionId: resources.adminFunctionId,
        body: JSON.stringify({ action: 'adminUpdateUser', targetUid: userAId, updates: { coins: 99999 } }),
        async: false,
        xpath: '/',
        method: ExecutionMethod.POST,
        headers: { 'content-type': 'application/json' },
      });
      assert.equal(
        adminBlockExec.responseStatusCode,
        403,
        `Expected 403 for non-owner, got ${adminBlockExec.responseStatusCode}: ${adminBlockExec.responseBody}`
      );
    });

    // 10. Realtime WebSocket & Private Chat A -> B
    await check('Realtime WebSocket (Appwrite Live Subscription)', async () => {
      assert.ok(userAId && userBId && jwtB, 'Skipped because Auth/JWT not ready');
      if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
        const memStore = new Map<string, string>();
        (globalThis as Record<string, unknown>).window = {
          setInterval: globalThis.setInterval.bind(globalThis),
          clearInterval: globalThis.clearInterval.bind(globalThis),
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
          localStorage: {
            getItem: (k: string) => memStore.get(k) ?? null,
            setItem: (k: string, v: string) => {
              memStore.set(k, String(v));
            },
            removeItem: (k: string) => {
              memStore.delete(k);
            },
          },
        };
      }
      const rtClientB = new WebClient().setEndpoint(resources.endpoint).setProject(resources.projectId);
      rtClientB.setJWT(jwtB);
      const rtB = new Realtime(rtClientB);

      let storyReceivedOnB = false;
      const storyRtSub = await rtB.subscribe(
        Channel.tablesdb(resources.databaseId).table(resources.tables.stories).row(),
        (ev) => {
          if (ev.payload && (ev.payload as { authorId?: string }).authorId === userAId) {
            storyReceivedOnB = true;
          }
        }
      );

      const rtStoryRow = await new Promise<void>((resolve) => setTimeout(resolve, 800)).then(() =>
        tablesA.createRow({
          databaseId: resources.databaseId,
          tableId: resources.tables.stories,
          rowId: ID.unique(),
          data: {
            authorId: userAId,
            authorName: 'اختبار أ',
            type: 'text',
            text: 'قصة تحقق Realtime',
            bgColor: '#0D7A5F',
            expiresAt: Date.now() + 3600_000,
            createdAt: new Date().toISOString(),
          },
          permissions: [Permission.read(Role.users()), Permission.delete(Role.user(userAId))],
        })
      );
      createdRowCleanups.push({ tableId: resources.tables.stories, rowId: rtStoryRow.$id, client: tablesA });

      for (let i = 0; i < 40 && !storyReceivedOnB; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
      await storyRtSub.unsubscribe().catch(() => {});
      assert.equal(storyReceivedOnB, true, 'Session B did not receive live Realtime event over WebSocket');
    });

    await check('Private Chat A -> B (Server-Authoritative sendPrivateMessage + Realtime)', async () => {
      assert.ok(economyReady, 'Blocked by missing function scopes on fadfada-economy');
      const rtClientB = new WebClient().setEndpoint(resources.endpoint).setProject(resources.projectId);
      rtClientB.setJWT(jwtB);
      const rtB = new Realtime(rtClientB);

      let dmReceivedOnB = false;
      const dmSub = await rtB.subscribe(
        Channel.tablesdb(resources.databaseId).table(resources.tables.messages).row(),
        (ev) => {
          if (ev.payload && (ev.payload as { senderId?: string }).senderId === userAId) {
            dmReceivedOnB = true;
          }
        }
      );

      const dmRes = await execEconomy(fnsA, 'sendPrivateMessage', {
        recipientId: userBId,
        text: 'رسالة تحقق مباشرة من A إلى B',
        type: 'text',
      });
      assert.equal(dmRes.parsed.ok, true, `sendPrivateMessage failed: ${dmRes.raw}`);
      const convId = String(dmRes.parsed.data?.conversationId || deterministicConvId(userAId, userBId));
      const messageId = String(dmRes.parsed.data?.messageId || '');
      if (convId) createdRowCleanups.push({ tableId: resources.tables.conversations, rowId: convId });
      if (messageId) createdRowCleanups.push({ tableId: resources.tables.messages, rowId: messageId });

      for (let i = 0; i < 25 && !dmReceivedOnB; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
      await dmSub.unsubscribe().catch(() => {});
      assert.equal(dmReceivedOnB, true, 'Session B did not receive realtime DM from Session A');

      // Test friends-only privacy & preserved contact / screenshot_alert types
      const privRes = await execEconomy(fnsB, 'updatePrivacy', {
        ghostMode: false,
        hideLastSeen: false,
        isPublic: true,
        privacy: { messagePermission: 'friends', showOnline: true, soundNotifications: true, visualNotifications: true },
      });
      assert.equal(privRes.parsed.ok, true, `updatePrivacy failed: ${privRes.raw}`);

      const blockedDm = await execEconomy(fnsA, 'sendPrivateMessage', {
        recipientId: userBId,
        text: 'ممنوع قبل الصداقة',
        type: 'text',
      });
      assert.equal(blockedDm.status, 403, `Expected 403 for non-friend DM, got ${blockedDm.status}`);

      const relId = deterministicRelId(userAId, userBId);
      createdRowCleanups.push({ tableId: resources.tables.relationships, rowId: relId });
      const friendReq = await execEconomy(fnsA, 'sendFriendRequest', { targetUid: userBId });
      assert.equal(friendReq.parsed.ok, true, `sendFriendRequest failed: ${friendReq.raw}`);
      const friendAcc = await execEconomy(fnsB, 'respondFriendRequest', { relationshipId: relId, accept: true });
      assert.equal(friendAcc.parsed.ok, true, `respondFriendRequest failed: ${friendAcc.raw}`);

      const contactDm = await execEconomy(fnsA, 'sendPrivateMessage', {
        recipientId: userBId,
        text: 'مشاركة جهة اتصال',
        type: 'contact',
      });
      assert.equal(contactDm.parsed.ok, true, `contact DM failed for friend: ${contactDm.raw}`);
      if (contactDm.parsed.data?.messageId) {
        createdRowCleanups.push({ tableId: resources.tables.messages, rowId: String(contactDm.parsed.data.messageId) });
        const msgRow = await tablesA.getRow({
          databaseId: resources.databaseId,
          tableId: resources.tables.messages,
          rowId: String(contactDm.parsed.data.messageId),
        });
        assert.equal(msgRow.type, 'contact');
      }

      // View-Once Video DM -> B opens once, second attempt fails 410
      const viewOnceDm = await execEconomy(fnsA, 'sendPrivateMessage', {
        recipientId: userBId,
        text: 'فيديو مرة واحدة',
        type: 'video',
        mediaUrl: 'https://example.com/live-clip.mp4',
        isViewOnce: true,
      });
      assert.equal(viewOnceDm.parsed.ok, true, `viewOnce DM failed: ${viewOnceDm.raw}`);
      const voId = String(viewOnceDm.parsed.data?.messageId || '');
      if (voId) {
        createdRowCleanups.push({ tableId: resources.tables.messages, rowId: voId });
        const openOnce = await execEconomy(fnsB, 'consumeViewOnceMessage', { messageId: voId });
        assert.equal(openOnce.parsed.ok, true, `consumeViewOnceMessage failed: ${openOnce.raw}`);
        const openTwice = await execEconomy(fnsB, 'consumeViewOnceMessage', { messageId: voId });
        assert.equal(openTwice.status, 410, `Expected 410 on second view-once open, got ${openTwice.status}`);
      }
    });

    // 11. Room Chat (member room creation, server join/leave/meta + rich room messages & view-once)
    await check('Rooms & Room Chat', async () => {
      assert.ok(economyReady, 'Blocked by missing function scopes on fadfada-economy');
      await execEconomy(fnsB, 'recordDailyTaskActivity', { kind: 'share' });
      await execEconomy(fnsB, 'recordDailyTaskActivity', { kind: 'ad_watch' });
      for (const taskKey of ['checkin', 'share', 'ad_watch']) {
        await execEconomy(fnsB, 'claimDailyReward', { taskKey });
      }
      const roomRes = await execEconomy(fnsB, 'createMemberRoom', {
        name: 'غرفة اختبار حي',
        description: 'تحقق آلي من الغرف',
        category: 'عام',
        theme: 'emerald',
      });
      assert.equal(roomRes.parsed.ok, true, `createMemberRoom failed: ${roomRes.raw}`);
      const roomId = String(roomRes.parsed.data?.roomId || '');
      assert.ok(roomId, 'createMemberRoom returned empty roomId');
      createdRowCleanups.push({ tableId: resources.tables.rooms, rowId: roomId });

      const joinRes = await execEconomy(fnsA, 'joinRoom', { roomId });
      assert.equal(joinRes.parsed.ok, true, `joinRoom failed: ${joinRes.raw}`);
      assert.equal(joinRes.parsed.data?.activeCount, 2);

      const roomMsgRes = await execEconomy(fnsA, 'sendRoomMessage', {
        roomId,
        text: 'رسالة تحقق حية في الغرفة',
        type: 'image',
        mediaUrl: 'https://example.com/room-pic.png',
        isViewOnce: true,
      });
      assert.equal(roomMsgRes.parsed.ok, true, `sendRoomMessage failed: ${roomMsgRes.raw}`);
      const roomMsgId = String(roomMsgRes.parsed.data?.$id || '');
      if (roomMsgId) {
        createdRowCleanups.push({ tableId: resources.tables.roomMessages, rowId: roomMsgId, client: tablesA });
        const consumeRoomVo = await execEconomy(fnsB, 'consumeRoomViewOnce', { messageId: roomMsgId });
        assert.equal(consumeRoomVo.parsed.ok, true, `consumeRoomViewOnce failed: ${consumeRoomVo.raw}`);
        const reactRoomMsg = await execEconomy(fnsB, 'toggleRoomMessageReaction', { messageId: roomMsgId, emoji: '❤️' });
        assert.equal(reactRoomMsg.parsed.ok, true, `toggleRoomMessageReaction failed: ${reactRoomMsg.raw}`);
      }

      const unauthMeta = await execEconomy(fnsA, 'updateRoomMeta', { roomId, pinnedMessage: 'مرفوض' });
      assert.equal(unauthMeta.status, 403, `Expected 403 for non-owner updateRoomMeta, got ${unauthMeta.status}`);

      const ownerMeta = await execEconomy(fnsB, 'updateRoomMeta', { roomId, pinnedMessage: 'رسالة ترحيب محدثة', theme: 'amber' });
      assert.equal(ownerMeta.parsed.ok, true, `updateRoomMeta owner failed: ${ownerMeta.raw}`);

      const leaveRes = await execEconomy(fnsA, 'leaveRoom', { roomId });
      assert.equal(leaveRes.parsed.ok, true, `leaveRoom failed: ${leaveRes.raw}`);
      assert.equal(leaveRes.parsed.data?.activeCount, 1);

      // Non-member A cannot sendRoomMessage after leaving
      const afterLeaveSend = await execEconomy(fnsA, 'sendRoomMessage', {
        roomId,
        text: 'ممنوع بعد المغادرة',
        type: 'text',
      });
      assert.equal(afterLeaveSend.status, 403, `Expected 403 after leaveRoom, got ${afterLeaveSend.status}`);
    });

    // 12. Stories + Wall Post + Wall Comment (Direct TablesDB)
    await check('Stories, Wall Posts & Wall Comments', async () => {
      assert.ok(userAId && userBId, 'Skipped because Auth sessions failed');
      const storyRow = await tablesA.createRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.stories,
        rowId: ID.unique(),
        data: {
          authorId: userAId,
          authorName: 'اختبار أ',
          type: 'text',
          text: 'قصة تحقق حية',
          bgColor: '#0D7A5F',
          expiresAt: Date.now() + 3600_000,
          createdAt: new Date().toISOString(),
        },
        permissions: [Permission.read(Role.users()), Permission.delete(Role.user(userAId))],
      });
      createdRowCleanups.push({ tableId: resources.tables.stories, rowId: storyRow.$id, client: tablesA });

      const wallRow = await tablesA.createRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.wallPosts,
        rowId: ID.unique(),
        data: {
          authorId: userAId,
          authorName: 'اختبار أ',
          text: 'منشور حائط حي',
          createdAt: new Date().toISOString(),
        },
        permissions: [Permission.read(Role.users()), Permission.delete(Role.user(userAId))],
      });
      createdRowCleanups.push({ tableId: resources.tables.wallPosts, rowId: wallRow.$id, client: tablesA });

      const commentRow = await tablesB.createRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.wallComments,
        rowId: ID.unique(),
        data: {
          postId: wallRow.$id,
          senderId: userBId,
          senderName: 'اختبار ب',
          text: 'تعليق حي على المنشور',
          createdAt: new Date().toISOString(),
        },
        permissions: [Permission.read(Role.users()), Permission.delete(Role.user(userBId))],
      });
      createdRowCleanups.push({ tableId: resources.tables.wallComments, rowId: commentRow.$id, client: tablesB });

      const proposalRow = await tablesA.createRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.creatorProposals,
        rowId: ID.unique(),
        data: {
          authorId: userAId,
          authorName: 'اختبار أ',
          authorAvatar: '',
          title: 'مقترح ميزة حية',
          category: 'feature',
          description: 'وصف اختبار لمقترح المبدعين',
          status: 'pending',
          adminReply: '',
          badgeDurationDays: 0,
          likedBy: [],
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date().toISOString(),
        },
        permissions: [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.user(userAId)),
        ],
      });
      createdRowCleanups.push({ tableId: resources.tables.creatorProposals, rowId: proposalRow.$id, client: tablesA });

      const propCommentRow = await tablesB.createRow({
        databaseId: resources.databaseId,
        tableId: resources.tables.proposalComments,
        rowId: ID.unique(),
        data: {
          proposalId: proposalRow.$id,
          senderId: userBId,
          senderName: 'اختبار ب',
          text: 'تعليق حي على المقترح',
          createdAt: new Date().toISOString(),
        },
        permissions: [Permission.read(Role.users()), Permission.delete(Role.user(userBId))],
      });
      createdRowCleanups.push({ tableId: resources.tables.proposalComments, rowId: propCommentRow.$id, client: tablesB });
    });

    // 13. Storage Upload & Client View/Download
    await check('Storage Media Upload, View & Download', async () => {
      assert.ok(userAId, 'Skipped because Session A failed');
      const testPngBytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      const clientStorage = new ClientStorage(clientA);
      const uploadedFile = await clientStorage.createFile({
        bucketId: resources.bucketId,
        fileId: ID.unique(),
        file: new File([testPngBytes], 'verify-pixel.png', { type: 'image/png' }),
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(userAId))],
      });
      createdFileIds.push({ fileId: uploadedFile.$id, client: clientStorage });
      const viewUrl = clientStorage.getFileView({ bucketId: resources.bucketId, fileId: uploadedFile.$id });
      assert.ok(String(viewUrl).includes(uploadedFile.$id), 'Storage file view URL invalid');
      const viewResp = await fetch(String(viewUrl));
      assert.ok(viewResp.ok, `Public file view HTTP ${viewResp.status}`);
      const downloadedBuf = await viewResp.arrayBuffer();
      assert.ok(downloadedBuf.byteLength > 0, 'Downloaded file empty');
    });

    if (failures.length > 0) {
      throw new Error(`${failures.length} live check(s) failed`);
    }
    console.log('ALL LIVE APPWRITE INTEGRATION CHECKS PASSED!');
  } finally {
    await cleanup();
  }
}

void runLiveVerify().catch((err) => {
  console.error('Live verification failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
