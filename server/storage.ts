import fs from 'fs';
import path from 'path';
import { Storage as GoogleStorage } from '@google-cloud/storage';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Local uploads directory (or Cloud Run mounted volume)
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export type StorageProviderType = 'gcs' | 'supabase' | 'local';

export interface StorageStatusInfo {
  provider: StorageProviderType;
  providerName: string;
  isCloudPersistent: boolean;
  bucketName: string;
  localFilesCount: number;
  cloudConfigured: boolean;
  statusMessage: string;
}

// ----------------------------------------------------
// Google Cloud Storage Client Initializer
// ----------------------------------------------------
let gcsClient: GoogleStorage | null = null;
let gcsBucketName: string | null = null;

function getGcsClient(): { client: GoogleStorage; bucket: string } | null {
  const bucket = process.env.GCS_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucket) return null;

  if (gcsClient && gcsBucketName === bucket) {
    return { client: gcsClient, bucket };
  }

  try {
    const options: any = {};
    if (process.env.GCS_KEY_BASE64) {
      try {
        const decoded = Buffer.from(process.env.GCS_KEY_BASE64, 'base64').toString('utf-8');
        options.credentials = JSON.parse(decoded);
      } catch (err) {
        console.error('Failed to parse GCS_KEY_BASE64:', err);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    // If running in Google Cloud Run, default application credentials (ADC) are automatically picked up

    gcsClient = new GoogleStorage(options);
    gcsBucketName = bucket;
    return { client: gcsClient, bucket };
  } catch (err) {
    console.error('Failed to initialize GCS client:', err);
    return null;
  }
}

// ----------------------------------------------------
// Supabase Storage Client Initializer
// ----------------------------------------------------
let supabaseClient: SupabaseClient | null = null;
let supabaseBucketName: string = 'fadfada-uploads';

function getSupabaseStorageClient(): { client: SupabaseClient; bucket: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;

  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(url, key, {
      auth: { persistSession: false }
    });
  }
  supabaseBucketName = process.env.SUPABASE_STORAGE_BUCKET || 'fadfada-uploads';
  return { client: supabaseClient, bucket: supabaseBucketName };
}

// ----------------------------------------------------
// Determine Active Storage Provider
// ----------------------------------------------------
export function getActiveStorageProvider(): StorageProviderType {
  if (process.env.GCS_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
    return 'gcs';
  }
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)) {
    return 'supabase';
  }
  return 'local';
}

export function getStorageStatus(): StorageStatusInfo {
  const provider = getActiveStorageProvider();
  let localCount = 0;
  try {
    if (fs.existsSync(UPLOAD_DIR)) {
      localCount = fs.readdirSync(UPLOAD_DIR).length;
    }
  } catch {}

  if (provider === 'gcs') {
    const bucket = process.env.GCS_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '';
    return {
      provider: 'gcs',
      providerName: 'Google Cloud Storage (Cloud Run Native)',
      isCloudPersistent: true,
      bucketName: bucket,
      localFilesCount: localCount,
      cloudConfigured: true,
      statusMessage: `متصل بـ Google Cloud Storage (Bucket: ${bucket}) - الوسائط محفوظة ومحمية دائمياً.`
    };
  }

  if (provider === 'supabase') {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'fadfada-uploads';
    return {
      provider: 'supabase',
      providerName: 'Supabase Storage',
      isCloudPersistent: true,
      bucketName: bucket,
      localFilesCount: localCount,
      cloudConfigured: true,
      statusMessage: `متصل بـ Supabase Storage (Bucket: ${bucket}) - الوسائط محفوظة ومحمية دائمياً.`
    };
  }

  return {
    provider: 'local',
    providerName: 'التخزين المحلي / Cloud Storage Mounted Volume',
    isCloudPersistent: false,
    bucketName: 'data/uploads',
    localFilesCount: localCount,
    cloudConfigured: false,
    statusMessage: 'يعمل على المجلد المحلي data/uploads. للنشر متعدد النسخ على Cloud Run، قم بضبط GCS_BUCKET أو ربط Cloud Storage Volume Mount.'
  };
}

// ----------------------------------------------------
// Save Media File (Dual-Write: Local Cache + Persistent Cloud)
// ----------------------------------------------------
export async function saveMediaFile(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; localPath: string; cloudStored: boolean; url: string }> {
  const safeFilename = path.basename(filename);
  const localPath = path.join(UPLOAD_DIR, safeFilename);

  // 1. Save to local disk immediately for rapid serving
  fs.writeFileSync(localPath, buffer);

  let cloudStored = false;

  // 2. Upload to Google Cloud Storage if configured
  const gcs = getGcsClient();
  if (gcs) {
    try {
      const bucket = gcs.client.bucket(gcs.bucket);
      const file = bucket.file(`uploads/${safeFilename}`);
      await file.save(buffer, {
        contentType: mimeType,
        metadata: {
          cacheControl: 'private, max-age=3600'
        },
        resumable: false
      });
      cloudStored = true;
    } catch (err) {
      console.error(`Error uploading ${safeFilename} to GCS:`, err);
    }
  }

  // 3. Upload to Supabase Storage if configured
  const supabase = getSupabaseStorageClient();
  if (supabase && !cloudStored) {
    try {
      const { error } = await supabase.client.storage
        .from(supabase.bucket)
        .upload(`uploads/${safeFilename}`, buffer, {
          contentType: mimeType,
          upsert: true
        });
      if (!error) {
        cloudStored = true;
      } else {
        console.error(`Supabase upload error for ${safeFilename}:`, error.message);
      }
    } catch (err) {
      console.error(`Error uploading ${safeFilename} to Supabase:`, err);
    }
  }

  return {
    success: true,
    localPath,
    cloudStored,
    url: `/uploads/${safeFilename}`
  };
}

// ----------------------------------------------------
// Get Media File (Checks Local, then pulls from Cloud Storage)
// ----------------------------------------------------
export async function getMediaFile(
  filename: string
): Promise<{ buffer: Buffer | null; mimeType: string; found: boolean }> {
  const safeFilename = path.basename(filename);
  const localPath = path.join(UPLOAD_DIR, safeFilename);

  // Derive mime type
  const ext = path.extname(safeFilename).toLowerCase();
  let mimeType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.gif') mimeType = 'image/gif';
  else if (ext === '.webm') mimeType = 'video/webm';
  else if (ext === '.mp4') mimeType = 'video/mp4';
  else if (ext === '.mov') mimeType = 'video/quicktime';
  else if (ext === '.mp3') mimeType = 'audio/mpeg';
  else if (ext === '.wav') mimeType = 'audio/wav';
  else if (ext === '.ogg') mimeType = 'audio/ogg';

  // 1. If present in local cache/volume, return it instantly
  if (fs.existsSync(localPath)) {
    try {
      const buffer = fs.readFileSync(localPath);
      return { buffer, mimeType, found: true };
    } catch (err) {
      console.error(`Error reading local file ${safeFilename}:`, err);
    }
  }

  // 2. Not in local filesystem? Pull from Google Cloud Storage
  const gcs = getGcsClient();
  if (gcs) {
    try {
      const bucket = gcs.client.bucket(gcs.bucket);
      const file = bucket.file(`uploads/${safeFilename}`);
      const [exists] = await file.exists();
      if (exists) {
        const [cloudBuffer] = await file.download();
        // Cache locally for subsequent fast reads
        try {
          fs.writeFileSync(localPath, cloudBuffer);
        } catch {}
        return { buffer: cloudBuffer, mimeType, found: true };
      }
    } catch (err) {
      console.error(`Error fetching ${safeFilename} from GCS:`, err);
    }
  }

  // 3. Pull from Supabase Storage if configured
  const supabase = getSupabaseStorageClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.client.storage
        .from(supabase.bucket)
        .download(`uploads/${safeFilename}`);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const cloudBuffer = Buffer.from(arrayBuf);
        try {
          fs.writeFileSync(localPath, cloudBuffer);
        } catch {}
        return { buffer: cloudBuffer, mimeType, found: true };
      }
    } catch (err) {
      console.error(`Error fetching ${safeFilename} from Supabase:`, err);
    }
  }

  return { buffer: null, mimeType, found: false };
}

// ----------------------------------------------------
// Delete Media File (Deletes Local + Remote Cloud)
// ----------------------------------------------------
export async function deleteMediaFile(filename: string): Promise<boolean> {
  const safeFilename = path.basename(filename);
  const localPath = path.join(UPLOAD_DIR, safeFilename);

  let deleted = false;

  // 1. Delete from local disk
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
      deleted = true;
    } catch (err) {
      console.error(`Failed to delete local file ${safeFilename}:`, err);
    }
  }

  // 2. Delete from GCS
  const gcs = getGcsClient();
  if (gcs) {
    try {
      const file = gcs.client.bucket(gcs.bucket).file(`uploads/${safeFilename}`);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        deleted = true;
      }
    } catch (err) {
      console.error(`Error deleting ${safeFilename} from GCS:`, err);
    }
  }

  // 3. Delete from Supabase Storage
  const supabase = getSupabaseStorageClient();
  if (supabase) {
    try {
      await supabase.client.storage
        .from(supabase.bucket)
        .remove([`uploads/${safeFilename}`]);
      deleted = true;
    } catch (err) {
      console.error(`Error deleting ${safeFilename} from Supabase:`, err);
    }
  }

  return deleted;
}

// ----------------------------------------------------
// Sync All Local Uploads to Cloud Storage
// ----------------------------------------------------
export async function syncAllLocalUploadsToCloud(): Promise<{
  uploaded: number;
  failed: number;
  skipped: number;
  details: string[];
}> {
  const result = { uploaded: 0, failed: 0, skipped: 0, details: [] as string[] };
  if (!fs.existsSync(UPLOAD_DIR)) return result;

  const files = fs.readdirSync(UPLOAD_DIR);
  const gcs = getGcsClient();
  const supabase = getSupabaseStorageClient();

  if (!gcs && !supabase) {
    result.details.push('لا توجد خدمة تخزين سحابية (GCS أو Supabase) مهيأة حالياً. الملفات محفوظة في التخزين المحلي.');
    result.skipped = files.length;
    return result;
  }

  for (const filename of files) {
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      let mime = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.webm') mime = 'video/webm';
      else if (ext === '.mp4') mime = 'video/mp4';

      let success = false;

      if (gcs) {
        const file = gcs.client.bucket(gcs.bucket).file(`uploads/${filename}`);
        await file.save(buffer, { contentType: mime, resumable: false });
        success = true;
      } else if (supabase) {
        const { error } = await supabase.client.storage
          .from(supabase.bucket)
          .upload(`uploads/${filename}`, buffer, { contentType: mime, upsert: true });
        if (!error) success = true;
      }

      if (success) {
        result.uploaded++;
        result.details.push(`تم رفع ${filename} بنجاح إلى التخزين السحابي`);
      } else {
        result.failed++;
        result.details.push(`فشل رفع ${filename}`);
      }
    } catch (err: any) {
      result.failed++;
      result.details.push(`خطأ أثناء معالجة ${filename}: ${err?.message || err}`);
    }
  }

  return result;
}
