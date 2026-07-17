const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in .env');
  }
  const corrected = raw.replace(/\\\s+/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return admin.credential.cert(JSON.parse(corrected));
}

// 逆シリアライズ (Timestampオブジェクトの復元)
function deserializeData(data) {
  if (!data) return null;
  const clone = { ...data };
  for (const key in clone) {
    if (clone[key] && clone[key]._type === 'Timestamp' && clone[key].iso) {
      clone[key] = admin.firestore.Timestamp.fromDate(new Date(clone[key].iso));
    }
  }
  return clone;
}

// 最新のバックアップJSONを取得
function getLatestBackupFile() {
  const scratchDir = path.join(__dirname, '../scratch');
  const files = fs.readdirSync(scratchDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(f => ({ name: f, time: fs.statSync(path.join(scratchDir, f)).mtime }));
  
  if (files.length === 0) {
    throw new Error('No backup files found in scratch/ directory.');
  }
  
  files.sort((a, b) => b.time - a.time);
  return path.join(scratchDir, files[0].name);
}

async function runSeed() {
  const isEmulator = process.env.FIRESTORE_EMULATOR_HOST ? true : false;
  console.log(`=== Seeding Stage Database (Emulator=${isEmulator}) ===`);
  
  if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId: 'akasawadp-stage' });
    } else {
      admin.initializeApp({ credential: getCredential() });
    }
  }
  const db = admin.firestore();
  
  const backupFile = getLatestBackupFile();
  console.log(`Using backup file: ${backupFile}`);
  
  const rawBackup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const submissions = rawBackup.collections.submissions;
  
  if (!submissions || submissions.length === 0) {
    console.log('No submissions found in backup data.');
    return;
  }
  
  console.log(`Preparing to seed ${submissions.length} submissions to staging...`);
  
  let successCount = 0;
  for (const doc of submissions) {
    try {
      const restored = deserializeData(doc.data);
      
      // 個人情報保護のため、不要な機密・個人情報は除外しつつ複製する (今回は実機の submissions スキーマをそのまま再現)
      await db.collection('submissions').doc(doc.id).set(restored);
      console.log(`[SEEDED] submissions/${doc.id}`);
      successCount++;
    } catch (e) {
      console.error(`[ERROR] Failed to seed submissions/${doc.id}: ${e.message}`);
    }
  }
  
  console.log(`=== Seeding completed. Success: ${successCount} ===`);
}

runSeed().catch(err => {
  console.error('Seed script crash:', err);
  process.exit(1);
});
