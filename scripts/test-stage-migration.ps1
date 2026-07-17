$env:JAVA_HOME = 'c:\Users\user\Desktop\akasawa\scratch\jdk-21\jdk-21.0.3+9'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "akasawadp-stage"
$env:MIGRATION_ID = "mig-stage-test"

Write-Host "=== Phase 2-A: Staging Environment Migration & Rollback Validation ===" -ForegroundColor Cyan

# 1. Firebase エミュレータをバックグラウンドで起動 (akasawadp-stage プロジェクト)
Write-Host "Starting Firestore Emulator in background..."
$EmulatorProcess = Start-Process cmd.exe -ArgumentList "/c npx firebase emulators:start --config test/firebase/firebase.json --project akasawadp-stage --only firestore" -PassThru -NoNewWindow
Start-Sleep -Seconds 12  # 起動を確実に待つ

try {
    # 2. 初期件数の確認
    Write-Host "`n[STEP 1] Checking initial Firestore collection counts..."
    node -e "
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      const admin = require('firebase-admin');
      admin.initializeApp({projectId: 'akasawadp-stage'});
      admin.firestore().collection('submissions').get().then(snap => {
        console.log('submissions count in staging:', snap.docs.length);
      }).catch(console.error);
    "
    Start-Sleep -Seconds 2

    # 3. データの複製 (Seeding)
    Write-Host "`n[STEP 2] Seeding 12 submissions from backup..."
    node scripts/seed-staging-data.js
    Start-Sleep -Seconds 2

    # 4. 移行前データと照合用のダンプレコード取得
    Write-Host "`n[STEP 3] Running migration --dry-run..."
    node scripts/migrate-tenant-data.js --dry-run
    Start-Sleep -Seconds 2

    # 5. limit=10 実書き込み
    Write-Host "`n[STEP 4] Executing migration with --limit=10..."
    node scripts/migrate-tenant-data.js --limit=10
    Start-Sleep -Seconds 2

    # 10件移行された状態の検証
    Write-Host "`nChecking 10-migrated status (10 docs, some migrated, others original)..."
    node -e "
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      const admin = require('firebase-admin');
      admin.initializeApp({projectId: 'akasawadp-stage'});
      admin.firestore().collection('submissions').get().then(snap => {
        let migrated = 0;
        let original = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (d.facilityId || d.personalProfileId) { migrated++; } else { original++; }
        });
        console.log('Migrated docs count:', migrated);
        console.log('Original docs count:', original);
      }).catch(console.error);
    "
    Start-Sleep -Seconds 2

    # 6. rollback-tenant-data.js による10件の完全復元
    # 実行ログから最新の移行IDを抽出してロールバック
    Write-Host "`n[STEP 5] Reverting 10 docs using rollback script for mig-stage-test..."
    node scripts/rollback-tenant-data.js --migrationId=mig-stage-test
    Start-Sleep -Seconds 2

    # ロールバック後のデータ整合性チェック
    Write-Host "`nChecking post-rollback status (All 12 docs should have NO tenant info)..."
    node -e "
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      const admin = require('firebase-admin');
      admin.initializeApp({projectId: 'akasawadp-stage'});
      admin.firestore().collection('submissions').get().then(snap => {
        let migrated = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (d.facilityId || d.personalProfileId) { migrated++; }
        });
        console.log('Migrated docs count (should be 0):', migrated);
      }).catch(console.error);
    "
    Start-Sleep -Seconds 2

    # 7. 全12件の完全移行
    Write-Host "`n[STEP 6] Running full migration for all 12 docs..."
    node scripts/migrate-tenant-data.js
    Start-Sleep -Seconds 2

    # 移行後の詳細なデータ検証
    Write-Host "`nVerifying full migration data integrity..."
    node -e "
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      const admin = require('firebase-admin');
      admin.initializeApp({projectId: 'akasawadp-stage'});
      admin.firestore().collection('submissions').get().then(snap => {
        let normal = 0;
        let personal = 0;
        let typeValid = true;
        let fieldValid = true;
        
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (d.personalProfileId === 'endo-personal') {
            personal++;
            if (!d.relatedFacilityIds || !d.relatedFacilityIds.includes('akazawa-onsen') || d.facilityId) {
              fieldValid = false;
              console.log('Invalid personal doc:', doc.id, d);
            }
          } else if (d.facilityId === 'akazawa-onsen') {
            normal++;
            if (d.personalProfileId) {
              fieldValid = false;
            }
          }
          
          // Timestamp型チェック (migratedAt)
          if (d.migratedAt && typeof d.migratedAt.toDate !== 'function') {
            typeValid = false;
            console.log('Invalid Timestamp type on doc:', doc.id);
          }
        });
        
        console.log('Validation results:');
        console.log('- Normal facility docs:', normal);
        console.log('- Personal branding docs:', personal);
        console.log('- Related fields structure valid:', fieldValid);
        console.log('- Timestamp (migratedAt) type valid:', typeValid);
      }).catch(console.error);
    "

} finally {
    # 8. エミュレータのクリーンアップ・停止
    Write-Host "`nStopping Firestore Emulator..."
    Stop-Process -Id $EmulatorProcess.Id -Force
}
