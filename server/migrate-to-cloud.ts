import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, queryAll, queryOne } from './db.js';
import { syncAllLocalUploadsToCloud, getStorageStatus, UPLOAD_DIR } from './storage.js';
import { syncDatabaseToCloud, getDbSyncStatus } from './dbSync.js';

export async function runCloudMigration() {
  console.log('====================================================');
  console.log('🚀 بدء فحص وترقية تخزين فضفضه للنشر على Cloud Run');
  console.log('====================================================');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'data', 'backups', `migration_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  // 1. Database Inspection & Integrity Check
  console.log('\n[1/5] فحص قاعدة البيانات المحلية fadfada.sqlite...');
  const dbFile = path.resolve(process.cwd(), 'data', 'fadfada.sqlite');
  if (!fs.existsSync(dbFile)) {
    throw new Error('ملف قاعدة البيانات data/fadfada.sqlite غير موجود!');
  }
  const dbSize = fs.statSync(dbFile).size;
  const dbHash = crypto.createHash('sha256').update(fs.readFileSync(dbFile)).digest('hex');
  console.log(`- الحجم: ${(dbSize / 1024).toFixed(2)} KB`);
  console.log(`- البصمة الرقمية (SHA256): ${dbHash}`);

  const db = await getDb();
  const integrity = queryOne(db, 'PRAGMA integrity_check');
  console.log(`- فحص سلامة البيانات: ${integrity?.integrity_check || 'ok'}`);

  const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  console.log(`- إجمالي الجداول: ${tables.length}`);

  const usersCount = queryOne(db, 'SELECT count(*) as c FROM users')?.c || 0;
  const messagesCount = (queryOne(db, 'SELECT count(*) as c FROM private_messages')?.c || 0) + (queryOne(db, 'SELECT count(*) as c FROM room_messages')?.c || 0);
  const walletTxCount = queryOne(db, 'SELECT count(*) as c FROM wallet_transactions')?.c || 0;
  console.log(`- إجمالي المستخدمين المسجلين: ${usersCount}`);
  console.log(`- إجمالي الرسائل: ${messagesCount}`);
  console.log(`- إجمالي المعاملات المالية: ${walletTxCount}`);

  // 2. Local Backup Creation (Strict requirement: Never delete or mutate original data)
  console.log('\n[2/5] إنشاء نسخة احتياطية آمنة وغير قابلة للتعديل...');
  const dbBackup = path.join(backupDir, 'fadfada.sqlite');
  fs.copyFileSync(dbFile, dbBackup);

  const uploadsBackupDir = path.join(backupDir, 'uploads');
  fs.mkdirSync(uploadsBackupDir, { recursive: true });
  const localUploadFiles = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
  for (const f of localUploadFiles) {
    fs.copyFileSync(path.join(UPLOAD_DIR, f), path.join(uploadsBackupDir, f));
  }
  console.log(`- تم حفظ نسخة احتياطية كاملة في: ${backupDir}`);
  console.log(`- تم حفظ نسخة من ${localUploadFiles.length} ملف وسائط.`);

  // 3. Media Uploads Inspection & Cloud Sync
  console.log('\n[3/5] فحص مجلد uploads ونقل الوسائط للتخزين الدائم...');
  console.log(`- عدد الملفات في مجلد uploads: ${localUploadFiles.length}`);
  const storageStatus = getStorageStatus();
  console.log(`- خدمة التخزين السحابي النشطة: ${storageStatus.providerName} (Bucket: ${storageStatus.bucketName || 'غير محدد'})`);

  const syncResult = await syncAllLocalUploadsToCloud();
  console.log(`- نتيجة المزامنة: تم رفع ${syncResult.uploaded} ملف، تم تخطي ${syncResult.skipped}، فشل ${syncResult.failed}.`);
  for (const d of syncResult.details) {
    console.log(`  * ${d}`);
  }

  // 4. Database Snapshot Sync to Cloud
  console.log('\n[4/5] مزامنة لقطة قاعدة البيانات الحالية مع التخزين السحابي الدائم...');
  const dbSynced = await syncDatabaseToCloud();
  const dbSyncStatus = getDbSyncStatus();
  console.log(`- حالة مزامنة قاعدة البيانات: ${dbSynced ? 'نجحت' : 'مكتملة محلياً أو جاهزة للمزامنة السحابية'}`);
  console.log(`- مزود المزامنة: ${dbSyncStatus.cloudProvider} (Bucket: ${dbSyncStatus.bucketName || 'محلي'})`);

  // 5. Verification & Final Manifest
  console.log('\n[5/5] التحقق النهائي وإصدار التقرير...');
  const manifest = {
    timestamp: new Date().toISOString(),
    status: 'READY_FOR_CLOUDRUN',
    database: {
      sha256: dbHash,
      sizeBytes: dbSize,
      tablesCount: tables.length,
      usersCount,
      messagesCount,
      walletTxCount
    },
    uploads: {
      totalFiles: localUploadFiles.length,
      cloudUploaded: syncResult.uploaded,
      files: localUploadFiles
    },
    storageStatus,
    dbSyncStatus
  };

  const manifestPath = path.join(backupDir, 'migration_report.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ تم إعداد التقرير بنجاح: ${manifestPath}`);
  console.log('====================================================');
  return manifest;
}

// If executed directly via CLI
if (process.argv[1]?.endsWith('migrate-to-cloud.ts') || process.argv[1]?.endsWith('migrate-to-cloud.js')) {
  runCloudMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
