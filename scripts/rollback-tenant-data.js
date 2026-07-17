const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const migrationIdArg = process.argv.find(arg => arg.startsWith('--migrationId='));
if (!migrationIdArg) {
  console.error('ERROR: --migrationId=<ID> parameter is required.');
  process.exit(1);
}
const targetMigrationId = migrationIdArg.split('=')[1];

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in .env');
  }
  try {
    const corrected = raw.replace(/\\\s+/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    return admin.credential.cert(JSON.parse(corrected));
  } catch (e) {
    return admin.credential.cert(JSON.parse(raw));
  }
}

// 逆シリアライズ (Timestampオブジェクトの復帰)
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

async function runRollback() {
  console.log(`=== Starting Rollback for Migration ID: ${targetMigrationId} ===`);
  
  if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId: 'akasawadp-stage' });
    } else {
      admin.initializeApp({ credential: getCredential() });
    }
  }
  const db = admin.firestore();
  
  // 該当する移行ログを取得
  const logsQuery = await db.collection('migration_logs')
    .where('migrationId', '==', targetMigrationId)
    .get();
    
  if (logsQuery.empty) {
    console.log(`No migration logs found for migration ID: ${targetMigrationId}. Rollback completed (nothing to do).`);
    return;
  }
  
  console.log(`Found ${logsQuery.docs.length} logged modifications to revert.`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const logDoc of logsQuery.docs) {
    const logData = logDoc.data();
    const { collectionPath, documentId, beforeData } = logData;
    
    // サブコレクションパスの判定に対応
    let docRef;
    if (collectionPath.includes('/')) {
      docRef = db.doc(`${collectionPath}/${documentId}`);
    } else {
      docRef = db.collection(collectionPath).doc(documentId);
    }
    
    try {
      if (beforeData === null) {
        // 移行時に新しく作られたドキュメントなので削除する
        console.log(`Deleting newly created document: ${collectionPath}/${documentId}`);
        await docRef.delete();
      } else {
        // 移行前のデータに上書き復元する
        console.log(`Restoring document to previous state: ${collectionPath}/${documentId}`);
        const originalData = deserializeData(beforeData);
        await docRef.set(originalData);
      }
      
      // 復元したログドキュメント自体を削除する（再実行で二重復元を防ぐため）
      await logDoc.ref.delete();
      successCount++;
    } catch (err) {
      console.error(`ERROR reverting document ${collectionPath}/${documentId}:`, err.message);
      failCount++;
    }
  }
  
  console.log(`=== Rollback Summary ===`);
  console.log(`Reverted successfully: ${successCount}`);
  console.log(`Failed to revert:     ${failCount}`);
  console.log(`========================`);
}

runRollback().catch(err => {
  console.error('Rollback script failed:', err);
  process.exit(1);
});
