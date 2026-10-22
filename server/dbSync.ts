import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Storage as GoogleStorage } from '@google-cloud/storage';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fadfada.sqlite');

export interface DbSyncStatus {
  lastSyncTime: string | null;
  lastSyncSha256: string | null;
  syncInProgress: boolean;
  cloudProvider: 'gcs' | 'supabase' | 'none';
  bucketName: string;
  totalSyncs: number;
  lastError: string | null;
}

let syncStatus: DbSyncStatus = {
  lastSyncTime: null,
  lastSyncSha256: null,
  syncInProgress: false,
  cloudProvider: 'none',
  bucketName: '',
  totalSyncs: 0,
  lastError: null
};

function getGcs() {
  const bucket = process.env.GCS_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucket) return null;
  try {
    const options: any = {};
    if (process.env.GCS_KEY_BASE64) {
      const decoded = Buffer.from(process.env.GCS_KEY_BASE64, 'base64').toString('utf-8');
      options.credentials = JSON.parse(decoded);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const client = new GoogleStorage(options);
    return { client, bucket };
  } catch (err) {
    console.error('Failed to initialize GCS in dbSync:', err);
    return null;
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  const client = createSupabaseClient(url, key, { auth: { persistSession: false } });
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'fadfada-uploads';
  return { client, bucket };
}

/**
 * On initial boot of a Cloud Run container:
 * Checks if local DB exists. If not, pulls the latest verified snapshot from Cloud Storage.
 */
export async function bootSyncDatabase(): Promise<boolean> {
  const gcs = getGcs();
  const supabase = getSupabase();

  if (gcs) {
    syncStatus.cloudProvider = 'gcs';
    syncStatus.bucketName = gcs.bucket;
  } else if (supabase) {
    syncStatus.cloudProvider = 'supabase';
    syncStatus.bucketName = supabase.bucket;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // If local DB already exists and is non-empty, keep it
  if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 1000) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(DB_FILE)).digest('hex');
    syncStatus.lastSyncSha256 = hash;
    console.log(`[dbSync] Local database verified (${fs.statSync(DB_FILE).size} bytes, SHA256: ${hash.substring(0, 10)}...)`);
    return true;
  }

  console.log('[dbSync] Local database missing or empty. Attempting restore from persistent cloud storage...');

  // 1. Try restore from GCS
  if (gcs) {
    try {
      const file = gcs.client.bucket(gcs.bucket).file('database/fadfada.sqlite');
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        fs.writeFileSync(DB_FILE, buffer);
        syncStatus.lastSyncTime = new Date().toISOString();
        syncStatus.lastSyncSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        console.log(`[dbSync] Successfully restored database from GCS bucket ${gcs.bucket} (${buffer.length} bytes)`);
        return true;
      }
    } catch (err: any) {
      console.error('[dbSync] Failed to restore DB from GCS:', err.message);
      syncStatus.lastError = err.message;
    }
  }

  // 2. Try restore from Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.client.storage
        .from(supabase.bucket)
        .download('database/fadfada.sqlite');
      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        fs.writeFileSync(DB_FILE, buffer);
        syncStatus.lastSyncTime = new Date().toISOString();
        syncStatus.lastSyncSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        console.log(`[dbSync] Successfully restored database from Supabase Storage (${buffer.length} bytes)`);
        return true;
      }
    } catch (err: any) {
      console.error('[dbSync] Failed to restore DB from Supabase:', err.message);
      syncStatus.lastError = err.message;
    }
  }

  console.log('[dbSync] No remote database snapshot found. Fresh database will be created.');
  return false;
}

/**
 * Sync the local database snapshot to persistent cloud storage.
 * Called automatically after critical writes or on scheduled intervals.
 */
export async function syncDatabaseToCloud(): Promise<boolean> {
  if (syncStatus.syncInProgress) return false;
  if (!fs.existsSync(DB_FILE)) return false;

  const gcs = getGcs();
  const supabase = getSupabase();
  if (!gcs && !supabase) return false;

  syncStatus.syncInProgress = true;
  try {
    const buffer = fs.readFileSync(DB_FILE);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Only upload if database has changed
    if (hash === syncStatus.lastSyncSha256) {
      syncStatus.syncInProgress = false;
      return true;
    }

    if (gcs) {
      const bucket = gcs.client.bucket(gcs.bucket);
      // Primary snapshot
      await bucket.file('database/fadfada.sqlite').save(buffer, {
        contentType: 'application/x-sqlite3',
        resumable: false,
        metadata: { sha256: hash, timestamp: new Date().toISOString() }
      });
      // Timestamped checkpoint
      const checkpointName = `database/checkpoints/fadfada_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
      await bucket.file(checkpointName).save(buffer, {
        contentType: 'application/x-sqlite3',
        resumable: false
      });
    } else if (supabase) {
      await supabase.client.storage
        .from(supabase.bucket)
        .upload('database/fadfada.sqlite', buffer, {
          contentType: 'application/x-sqlite3',
          upsert: true
        });
    }

    syncStatus.lastSyncTime = new Date().toISOString();
    syncStatus.lastSyncSha256 = hash;
    syncStatus.totalSyncs++;
    syncStatus.lastError = null;
    return true;
  } catch (err: any) {
    console.error('[dbSync] Error syncing DB snapshot to cloud:', err.message);
    syncStatus.lastError = err.message;
    return false;
  } finally {
    syncStatus.syncInProgress = false;
  }
}

export function getDbSyncStatus(): DbSyncStatus {
  return { ...syncStatus };
}
