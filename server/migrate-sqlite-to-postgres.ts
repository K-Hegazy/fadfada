import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

const DB_FILE = path.resolve(process.cwd(), 'data/fadfada.sqlite');

export async function migrateSqliteToPostgres() {
  console.log('[Migration] Starting migration from SQLite to Cloud SQL PostgreSQL...');
  
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`SQLite database file not found at ${DB_FILE}`);
  }

  const pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 5,
    connectionTimeoutMillis: 15000,
  });

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_FILE);
  const sqliteDb = new SQL.Database(fileBuffer);

  const client = await pool.connect();
  const report: Record<string, { sqliteCount: number; pgCount: number; status: string }> = {};

  try {
    // Get list of all user tables in SQLite
    const tablesStmt = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const sqliteTables: string[] = [];
    while (tablesStmt.step()) {
      sqliteTables.push(tablesStmt.getAsObject().name as string);
    }
    tablesStmt.free();

    console.log(`[Migration] Found ${sqliteTables.length} tables in SQLite to inspect and migrate.`);

    // Desired insertion order to respect foreign key constraints
    const prioritizedOrder = [
      'system_settings',
      'random_settings',
      'truth_or_dare_items',
      'achievements',
      'coin_packages',
      'vip_plans',
      'shop_items',
      'gifts',
      'missions',
      'story_ads',
      'users',
      'sessions',
      'rooms',
      'room_members',
      'room_messages',
      'room_reactions',
      'active_audio_speakers',
      'room_active_sessions',
      'private_conversations',
      'private_messages',
      'private_reactions',
      'private_message_deletions',
      'wallet_transactions',
      'gift_transactions',
      'game_transactions',
      'payment_orders',
      'stories',
      'story_views',
      'friendships',
      'friend_requests',
      'blocks',
      'mutes',
      'reports',
      'notifications',
      'audit_logs',
      'events',
      'event_participants',
      'user_mission_progress',
      'user_game_records',
      'terms_agreements',
      'platform_posts',
      'post_likes',
      'site_suggestions',
      'user_badges',
      'user_inventory',
      'user_interests',
      'user_achievements',
      'random_sessions',
      'email_verifications',
      'password_resets',
      'cluster_events'
    ];

    // Order all tables, putting unlisted ones at the end
    const sortedTables = [...new Set([...prioritizedOrder.filter(t => sqliteTables.includes(t)), ...sqliteTables])];

    // Get list of tables that actually exist in PostgreSQL
    const pgTablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const pgExistingTables = new Set(pgTablesRes.rows.map(r => r.table_name));

    for (const tableName of sortedTables) {
      if (!pgExistingTables.has(tableName)) {
        console.warn(`[Migration] Table ${tableName} does not exist in PostgreSQL schema, skipping.`);
        continue;
      }

      // Read SQLite rows
      const rowsStmt = sqliteDb.prepare(`SELECT * FROM ${tableName}`);
      const rows: any[] = [];
      while (rowsStmt.step()) {
        rows.push(rowsStmt.getAsObject());
      }
      rowsStmt.free();

      // Get PostgreSQL columns for this table
      const colRes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      const pgColMap = new Map(colRes.rows.map(r => [r.column_name, r.data_type]));

      if (rows.length === 0) {
        const pgCountRes = await client.query(`SELECT COUNT(*) as c FROM ${tableName}`);
        report[tableName] = { sqliteCount: 0, pgCount: parseInt(pgCountRes.rows[0].c, 10), status: 'EMPTY' };
        continue;
      }

      console.log(`[Migration] Migrating ${rows.length} rows for table: ${tableName}`);

      // Insert rows with ON CONFLICT DO NOTHING (or DO UPDATE for idempotent safety)
      for (const row of rows) {
        const validCols: string[] = [];
        const values: any[] = [];
        const placeholders: string[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(row)) {
          if (pgColMap.has(key)) {
            validCols.push(`"${key}"`);
            
            // Format dates/timestamps if needed
            let cleanVal = val;
            const colType = pgColMap.get(key);
            if (colType === 'timestamp without time zone' || colType === 'timestamp with time zone') {
              if (cleanVal === '' || cleanVal === null || cleanVal === undefined) {
                cleanVal = null;
              } else if (typeof cleanVal === 'string' && !isNaN(Date.parse(cleanVal))) {
                cleanVal = new Date(cleanVal).toISOString();
              }
            } else if (colType === 'integer') {
              if (cleanVal === '' || cleanVal === null || cleanVal === undefined) {
                cleanVal = null;
              } else {
                const parsedInt = parseInt(String(cleanVal), 10);
                cleanVal = isNaN(parsedInt) ? 0 : parsedInt;
              }
            }

            values.push(cleanVal);
            placeholders.push(`$${idx++}`);
          }
        }

        if (validCols.length > 0) {
          const insertSql = `
            INSERT INTO "${tableName}" (${validCols.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT DO NOTHING
          `;
          try {
            await client.query(insertSql, values);
          } catch (err: any) {
            console.warn(`[Migration] Warning inserting row into ${tableName}:`, err.message);
          }
        }
      }

      // Verify row count in PostgreSQL
      const pgCountRes = await client.query(`SELECT COUNT(*) as c FROM "${tableName}"`);
      const pgCount = parseInt(pgCountRes.rows[0].c, 10);
      report[tableName] = {
        sqliteCount: rows.length,
        pgCount,
        status: pgCount >= rows.length ? 'OK' : 'MISMATCH'
      };
      console.log(`[Migration] Completed ${tableName}: SQLite = ${rows.length}, PG = ${pgCount}`);
    }

    // Verify Owner Account specifically
    const ownerRes = await client.query("SELECT id, username, role, coins, is_banned FROM users WHERE role = 'owner'");
    console.log('[Migration] Verified Owner accounts in PostgreSQL:', ownerRes.rows);

    return {
      success: true,
      report,
      ownerAccounts: ownerRes.rows
    };
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('migrate-sqlite-to-postgres.ts') || process.argv[1]?.endsWith('migrate-sqlite-to-postgres.js')) {
  migrateSqliteToPostgres()
    .then(res => {
      console.log('[Migration] RESULT SUCCESS:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migration] FATAL ERROR:', err);
      process.exit(1);
    });
}
