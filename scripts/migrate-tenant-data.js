const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { LEGACY_DEFAULT_FACILITY_ID, LEGACY_DEFAULT_PARTNER_ID, LEGACY_DEFAULT_ORGANIZATION_ID } = require('../shared/tenant_config');

// 移行ID
const MIGRATION_ID = process.env.MIGRATION_ID || `mig-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;

// 引数パーサー
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const recordLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

// ログファイル定義
const logFile = path.join(__dirname, `../scratch/migration-${MIGRATION_ID}.log`);
function log(msg) {
  const time = new Date().toISOString();
  const formatted = `[${time}] ${msg}`;
  console.log(formatted);
  fs.appendFileSync(logFile, formatted + '\n', 'utf8');
}

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

// ヘルパー: Timestampオブジェクトのシリアライズ
function serializeData(data) {
  if (!data) return null;
  const clone = { ...data };
  for (const key in clone) {
    if (clone[key] && typeof clone[key].toDate === 'function') {
      clone[key] = {
        _type: 'Timestamp',
        iso: clone[key].toDate().toISOString()
      };
    }
  }
  return clone;
}

async function runMigration() {
  log(`=== Starting Tenant Data Migration (${MIGRATION_ID}) ===`);
  log(`Parameters: dry-run=${isDryRun}, recordLimit=${recordLimit || 'unlimited'}`);
  
  if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId: 'akasawadp-stage' });
    } else {
      admin.initializeApp({ credential: getCredential() });
    }
  }
  const db = admin.firestore();
  
  // 1. settings/brand から facilities/akazawa-onsen/profiles/brand への移行（ブランド情報移行）
  log('1. Migrating brand settings to facilities subcollection...');
  const brandDocRef = db.collection('settings').doc('brand');
  const targetBrandRef = db.collection('facilities').doc(LEGACY_DEFAULT_FACILITY_ID).collection('profiles').doc('brand');
  const brandSnap = await brandDocRef.get();
  
  if (brandSnap.exists) {
    const brandData = brandSnap.data();
    const targetBrandSnap = await targetBrandRef.get();
    
    if (targetBrandSnap.exists && targetBrandSnap.data().facilityId) {
      log('Brand settings already migrated. Skipping.');
    } else {
      const beforeData = targetBrandSnap.exists ? serializeData(targetBrandSnap.data()) : null;
      const afterData = {
        ...brandData,
        organizationId: LEGACY_DEFAULT_ORGANIZATION_ID,
        partnerId: LEGACY_DEFAULT_PARTNER_ID,
        facilityId: LEGACY_DEFAULT_FACILITY_ID,
        schemaVersion: 1,
        migrationVersion: "v1.0.0",
        lastMigrationId: MIGRATION_ID,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      log(`Action: Migrate settings/brand -> facilities/${LEGACY_DEFAULT_FACILITY_ID}/profiles/brand`);
      if (!isDryRun) {
        await targetBrandRef.set(afterData);
        // 移行ログの記録
        await db.collection('migration_logs').add({
          migrationId: MIGRATION_ID,
          collectionPath: `facilities/${LEGACY_DEFAULT_FACILITY_ID}/profiles`,
          documentId: 'brand',
          beforeData,
          afterData: serializeData(afterData),
          result: 'created',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  } else {
    log('No settings/brand document found to migrate.');
  }

  // 2. 他の主要フラットコレクションの移行
  const collectionsToMigrate = [
    { name: 'roomTypes', isSubmissions: false },
    { name: 'pricingRules', isSubmissions: false },
    { name: 'bookings', isSubmissions: false },
    { name: 'events', isSubmissions: false },
    { name: 'overrides', isSubmissions: false },
    { name: 'calendar_prices', isSubmissions: false },
    { name: 'submissions', isSubmissions: true }
  ];
  
  const stats = {
    totalDocs: 0,
    updatedDocs: 0,
    skippedDocs: 0,
    errorDocs: 0
  };
  
  for (const colConf of collectionsToMigrate) {
    const colName = colConf.name;
    log(`\nMigrating collection: ${colName}...`);
    
    const snapshot = await db.collection(colName).get();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      if (recordLimit && count >= recordLimit) {
        log(`Limit ${recordLimit} reached for ${colName}. Stopping collection fetch.`);
        break;
      }
      
      stats.totalDocs++;
      count++;
      const data = doc.data();
      
      // 冪等性の確認: すでにテナントIDが付与されているか
      const hasTenantInfo = data.facilityId || data.personalProfileId;
      if (hasTenantInfo) {
        log(`Document ${doc.id} already has tenant info. Skipping.`);
        stats.skippedDocs++;
        continue;
      }
      
      let updatePayload = {
        organizationId: LEGACY_DEFAULT_ORGANIZATION_ID,
        partnerId: LEGACY_DEFAULT_PARTNER_ID,
        schemaVersion: 1,
        migrationVersion: "v1.0.0",
        lastMigrationId: MIGRATION_ID,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // 個人SNS (endo-sns) 判定
      if (colConf.isSubmissions) {
        const ownerName = data.brandSnapshot?.ownerName;
        if (ownerName === '遠藤正俊') {
          // 遠藤氏の個人プロフィールに紐づける (relatedFacilityIds を設定し、facilityId は設定しない)
          updatePayload.personalProfileId = 'endo-personal';
          updatePayload.relatedFacilityIds = [LEGACY_DEFAULT_FACILITY_ID];
          log(`Document ${doc.id} mapped to personalProfileId 'endo-personal' and relatedFacilityIds`);
        } else {
          // 通常の赤沢温泉旅館
          updatePayload.facilityId = LEGACY_DEFAULT_FACILITY_ID;
        }
      } else {
        updatePayload.facilityId = LEGACY_DEFAULT_FACILITY_ID;
      }
      
      try {
        log(`Updating doc: ${colName}/${doc.id} with keys: ${Object.keys(updatePayload).join(', ')}`);
        
        if (!isDryRun) {
          const docRef = db.collection(colName).doc(doc.id);
          const beforeData = serializeData(data);
          
          await docRef.set(updatePayload, { merge: true });
          
          const afterSnap = await docRef.get();
          
          // 移行ログの記録
          await db.collection('migration_logs').add({
            migrationId: MIGRATION_ID,
            collectionPath: colName,
            documentId: doc.id,
            beforeData,
            afterData: serializeData(afterSnap.data()),
            result: 'updated',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        stats.updatedDocs++;
      } catch (err) {
        log(`ERROR updating doc ${colName}/${doc.id}: ${err.message}`);
        stats.errorDocs++;
      }
    }
  }
  
  log('\n=== Migration Summary ===');
  log(`Total scanned: ${stats.totalDocs}`);
  log(`Updated:       ${stats.updatedDocs}`);
  log(`Skipped:       ${stats.skippedDocs}`);
  log(`Errors:        ${stats.errorDocs}`);
  log(`Dry-run mode:  ${isDryRun}`);
  log(`=========================`);
}

runMigration().catch(err => {
  log(`Migration script crash: ${err.stack}`);
  process.exit(1);
});
