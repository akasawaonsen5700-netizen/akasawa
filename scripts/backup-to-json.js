const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in .env');
  }
  try {
    // まずスペース等を補正してからパース
    const corrected = raw.replace(/\\\s+/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    return admin.credential.cert(JSON.parse(corrected));
  } catch (e) {
    return admin.credential.cert(JSON.parse(raw));
  }
}

async function runBackup() {
  const MIGRATION_ID = `mig-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;
  const log = (msg) => console.log(msg);
  
  log('Starting Firestore backup to local JSON...');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: getCredential()
    });
  }
  
  const db = admin.firestore();
  
  // 対象コレクションリスト
  const collections = [
    'submissions',
    'settings',
    'admins',
    'roomTypes',
    'pricingRules',
    'bookings',
    'events',
    'overrides',
    'calendar_prices',
    'campaign_suggestions'
  ];
  
  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      migrationId: MIGRATION_ID
    },
    collections: {},
    errors: {}
  };
  
  for (const colName of collections) {
    log(`Fetching collection: ${colName}...`);
    try {
      const snapshot = await db.collection(colName).get();
      const docs = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        for (const key in data) {
          if (data[key] && typeof data[key].toDate === 'function') {
            data[key] = {
              _type: 'Timestamp',
              iso: data[key].toDate().toISOString()
            };
          }
        }
        docs.push({
          id: doc.id,
          data: data
        });
      });
      
      if (docs.length > 0) {
        backupData.collections[colName] = docs;
        log(`[SUCCESS] Fetched ${docs.length} documents from '${colName}'`);
      } else {
        backupData.collections[colName] = [];
        log(`[EMPTY] Collection '${colName}' is empty or does not exist on Firestore.`);
      }
    } catch (e) {
      log(`[ERROR] Failed to fetch collection '${colName}': ${e.message}`);
      backupData.errors[colName] = e.message;
    }
  }
  
  // 保存先フォルダの作成
  const scratchDir = path.join(__dirname, '../scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(scratchDir, `backup-${timestamp}.json`);
  
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup completed successfully! Saved to: ${backupFile}`);
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
