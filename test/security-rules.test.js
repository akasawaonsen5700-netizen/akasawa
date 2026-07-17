const fs = require('fs');
const path = require('path');
const assert = require('assert');
const testing = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'akasawadp-test-rules';
const RULES_PATH = path.join(__dirname, '../firestore.rules.multitenant.test');
const FIXTURES_PATH = path.join(__dirname, 'fixtures/mock-data.json');

let testEnv;

async function setupFixtures(db) {
  // フィクスチャデータのロードと初期値設定
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  
  // users
  for (const [uid, data] of Object.entries(fixtures.users)) {
    await db.collection('users').doc(uid).set(data);
  }
  // memberships
  for (const [id, data] of Object.entries(fixtures.memberships)) {
    await db.collection('memberships').doc(id).set(data);
  }
  // facilities
  for (const [id, data] of Object.entries(fixtures.facilities)) {
    await db.collection('facilities').doc(id).set(data);
  }
}

async function runTests() {
  console.log('Initializing Security Rules Test Environment...');
  
  // テスト環境の初期化
  testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });

  // フィクスチャデータの投入 (管理者権限を使用)
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setupFixtures(db);
  });

  console.log('Starting Security Rules Tests...\n');
  
  const suites = [
    // -------------------------------------------------------------
    // 1. 本部管理者の全閲覧・全編集
    // -------------------------------------------------------------
    {
      name: '本部管理者は全施設およびデータを閲覧・編集できる',
      fn: async () => {
        const context = testEnv.authenticatedContext('super-admin-uid', { role: 'super_admin' });
        const db = context.firestore();
        
        // 閲覧
        await db.collection('facilities').doc('akazawa-onsen').get();
        await db.collection('facilities').doc('other-facility').get();
        
        // 編集
        await db.collection('facilities').doc('akazawa-onsen').set({
          name: '赤沢温泉旅館 (改名)',
          organizationId: 'success-research',
          partnerId: 'akazawa-tochigi'
        }, { merge: true });
      }
    },

    // -------------------------------------------------------------
    // 2. 地域パートナーは担当施設だけ閲覧できる
    // -------------------------------------------------------------
    {
      name: '地域パートナーは担当施設だけ閲覧でき、他地域の施設は拒否される',
      fn: async () => {
        // 栃木県のパートナー管理者
        const context = testEnv.authenticatedContext('partner-admin-uid', { 
          role: 'partner_admin', 
          partnerId: 'akazawa-tochigi' 
        });
        const db = context.firestore();
        
        // 担当施設へのアクセス (membershipsで紐付けられていること)
        await db.collection('memberships').doc('facility-admin-uid_akazawa-onsen').get();
        
        // 他地域のメンバーシップへのアクセスは拒否されるべき
        await assert.rejects(
          db.collection('facilities').doc('other-facility').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 3. 施設管理者は自施設だけ閲覧・編集できる
    // -------------------------------------------------------------
    {
      name: '施設管理者は自施設だけ閲覧・編集でき、他施設は拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-admin-uid');
        const db = context.firestore();
        
        // 自施設
        await db.collection('facilities').doc('akazawa-onsen').get();
        
        // 他施設
        await assert.rejects(
          db.collection('facilities').doc('other-facility').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 4. ログイン済み施設スタッフが他ユーザーのusers文書を読めない
    // -------------------------------------------------------------
    {
      name: '施設スタッフが他ユーザーのusers文書を閲覧することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-staff-uid');
        const db = context.firestore();
        
        // 他のユーザー (facility-admin-uid)
        await assert.rejects(
          db.collection('users').doc('facility-admin-uid').get(),
          /permission-denied/i
        );
        
        // 本人自身のドキュメントは読める
        await db.collection('users').doc('facility-staff-uid').get();
      }
    },

    // -------------------------------------------------------------
    // 5. 施設スタッフが他施設のmembershipsを読めない
    // -------------------------------------------------------------
    {
      name: '施設スタッフが他施設のmembershipsを閲覧することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-staff-uid');
        const db = context.firestore();
        
        // 本人以外の membership
        await assert.rejects(
          db.collection('memberships').doc('facility-admin-uid_akazawa-onsen').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 6. 施設スタッフが自分のmembershipのroleを変更できない
    // -------------------------------------------------------------
    {
      name: '施設スタッフが自身のmembershipのroleを書き換えることは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-staff-uid');
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('memberships').doc('facility-staff-uid_akazawa-onsen').update({
            role: 'facility_admin'
          }),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 7. 地域パートナーがsuper_adminを作成できない
    // -------------------------------------------------------------
    {
      name: '地域パートナーがsuper_adminのロールを持つmembershipを作成することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('partner-admin-uid', { 
          role: 'partner_admin', 
          partnerId: 'akazawa-tochigi' 
        });
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('memberships').doc('new-user-uid_akazawa-onsen').set({
            userId: 'new-user-uid',
            facilityId: 'akazawa-onsen',
            partnerId: 'akazawa-tochigi',
            role: 'super_admin',
            permissions: [],
            status: 'active'
          }),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 8. 地域パートナーが他地域のpartner_adminを作成できない
    // -------------------------------------------------------------
    {
      name: '地域パートナーが他地域のpartner_adminを作成することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('partner-admin-uid', { 
          role: 'partner_admin', 
          partnerId: 'akazawa-tochigi' 
        });
        const db = context.firestore();
        
        // 他地域 (ibara-partner) のドキュメント作成
        await assert.rejects(
          db.collection('memberships').doc('new-user-uid_other-facility').set({
            userId: 'new-user-uid',
            facilityId: 'other-facility',
            partnerId: 'ibara-partner',
            role: 'partner_admin',
            permissions: [],
            status: 'active'
          }),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 9. 外部連携情報を施設スタッフが読めない
    // -------------------------------------------------------------
    {
      name: '外部連携情報(integrations)を施設スタッフが閲覧することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-staff-uid');
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('facilities').doc('akazawa-onsen').collection('integrations').doc('gemini').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 10. 施設IDが存在しないmembershipではアクセスできない
    // -------------------------------------------------------------
    {
      name: 'メンバーシップが存在しない施設へのアクセスは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-staff-uid');
        const db = context.firestore();
        
        // メンバーシップのない facility
        await assert.rejects(
          db.collection('facilities').doc('other-facility').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 11. 無効化されたmembershipではアクセスできない
    // -------------------------------------------------------------
    {
      name: 'statusがinactiveのmembershipを持つユーザーのアクセスは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('inactive-user-uid');
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('facilities').doc('akazawa-onsen').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 12. statusがinactiveのユーザーはアクセスできない
    // -------------------------------------------------------------
    {
      name: 'statusがinactiveのユーザーのアクセスは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('inactive-user-uid');
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('facilities').doc('akazawa-onsen').get(),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 13. 一般ユーザーが所属ID(organizationId, partnerId)を書き換えられない
    // -------------------------------------------------------------
    {
      name: '施設管理者が所属ID(organizationId)を書き換えて更新することは拒否される',
      fn: async () => {
        const context = testEnv.authenticatedContext('facility-admin-uid');
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('facilities').doc('akazawa-onsen').update({
            organizationId: 'malicious-org'
          }),
          /permission-denied/i
        );
      }
    },

    // -------------------------------------------------------------
    // 14. 未ログインユーザーが管理データを取得できない
    // -------------------------------------------------------------
    {
      name: '未ログインユーザーが施設基本情報を閲覧することは拒否される',
      fn: async () => {
        const context = testEnv.unauthenticatedContext();
        const db = context.firestore();
        
        await assert.rejects(
          db.collection('facilities').doc('akazawa-onsen').get(),
          /permission-denied/i
        );
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const suite of suites) {
    try {
      await suite.fn();
      console.log(`[PASS] ${suite.name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${suite.name}`);
      console.error(e.message);
      failed++;
    }
  }

  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`====================`);
  
  await testEnv.cleanup();
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
