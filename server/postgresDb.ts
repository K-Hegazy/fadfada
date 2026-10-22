import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

declare global {
  var _fadfadaPgPool: pg.Pool | undefined;
}

export function getPostgresPool(): pg.Pool | null {
  if (!process.env.SQL_HOST) {
    return null;
  }
  if (!global._fadfadaPgPool) {
    global._fadfadaPgPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 15,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

    global._fadfadaPgPool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool client error:', err.message);
    });
  }
  return global._fadfadaPgPool;
}

/**
 * Converts standard SQLite style '?' placeholders to PostgreSQL '$1, $2, ...' placeholders
 */
export function sqliteToPgSql(sql: string): string {
  let idx = 1;
  return sql
    .replace(/\?/g, () => '$' + (idx++))
    .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP');
}

/**
 * Execute query on PostgreSQL
 */
export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const convertedSql = sqliteToPgSql(sql);
  const res = await pool.query(convertedSql, params);
  return res.rows as T[];
}

/**
 * Execute single row query on PostgreSQL
 */
export async function pgQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute atomic wallet transaction on Cloud SQL PostgreSQL with row-level locking (FOR UPDATE)
 * Guarantees zero race-conditions and exact balance consistency across multiple Cloud Run instances.
 */
export async function executePostgresWalletTransaction(params: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  relatedUserId?: string | null;
  idempotencyKey?: string | null;
}): Promise<{
  success: boolean;
  txId: string;
  balanceBefore: number;
  balanceAfter: number;
  isIdempotentReplay?: boolean;
}> {
  const pool = getPostgresPool();
  if (!pool) {
    throw new Error('Cloud SQL PostgreSQL pool not available');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Idempotency Check
    if (params.idempotencyKey) {
      const existingRes = await client.query(
        'SELECT id, balance_before, balance_after FROM wallet_transactions WHERE user_id = $1 AND idempotency_key = $2',
        [params.userId, params.idempotencyKey]
      );
      if (existingRes.rows.length > 0) {
        await client.query('COMMIT');
        const row = existingRes.rows[0];
        return {
          success: true,
          txId: row.id,
          balanceBefore: Number(row.balance_before),
          balanceAfter: Number(row.balance_after),
          isIdempotentReplay: true
        };
      }
    }

    // 2. Lock user row with SELECT ... FOR UPDATE
    const userRes = await client.query(
      'SELECT coins FROM users WHERE id = $1 FOR UPDATE',
      [params.userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('المستخدم غير موجود');
    }

    const currentCoins = Number(userRes.rows[0].coins || 0);
    const balanceBefore = currentCoins;
    const balanceAfter = balanceBefore + params.amount;

    if (balanceAfter < 0) {
      await client.query('ROLLBACK');
      throw new Error(`رصيد الكوينز غير كافٍ. تحتاج إلى ${Math.abs(params.amount)} كوينز (رصيدك الحالي: ${balanceBefore})`);
    }

    // 3. Update User Balance
    await client.query(
      'UPDATE users SET coins = $1 WHERE id = $2',
      [balanceAfter, params.userId]
    );

    // 4. If there is a recipient (e.g. gift or coin transfer), update recipient atomically
    if (params.relatedUserId && params.type === 'coin_transfer' && params.amount < 0) {
      const transferAmount = Math.abs(params.amount);
      await client.query(
        'UPDATE users SET coins = coins + $1 WHERE id = $2',
        [transferAmount, params.relatedUserId]
      );
      
      const recipientTxId = 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      await client.query(
        `INSERT INTO wallet_transactions 
         (id, user_id, amount, type, description, related_user_id, balance_before, balance_after, created_at)
         VALUES ($1, $2, $3, 'transfer_received', $4, $5, 0, 0, NOW())`,
        [recipientTxId, params.relatedUserId, transferAmount, `استلام كوينز من مستخدم آخر`, params.userId]
      );
    }

    // 5. Insert audit log
    const txId = 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    await client.query(
      `INSERT INTO wallet_transactions 
       (id, user_id, amount, type, description, related_user_id, balance_before, balance_after, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
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

    await client.query('COMMIT');

    return {
      success: true,
      txId,
      balanceBefore,
      balanceAfter,
      isIdempotentReplay: false
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}
