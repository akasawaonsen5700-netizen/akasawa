const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// ルートの.envを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not defined in .env');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  
  const db = admin.firestore();
  
  (async () => {
    const snapshot = await db.collection('submissions').orderBy('createdAt', 'desc').limit(5).get();
    console.log('\n====== 最新の投稿エラー確認 ======');
    if (snapshot.empty) {
      console.log('投稿データが見つかりませんでした。');
    }
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`[ID]: ${doc.id}`);
      console.log(`[登録日時]: ${data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : 'なし'}`);
      console.log(`[コメント]: ${data.ownerComment || 'なし'}`);
      console.log(`[ステータス]: ${data.videoStatus || 'なし'}`);
      console.log(`[エラー内容]: ${data.videoError || 'エラーなし'}`);
      console.log('--------------------------------');
    });
    console.log('==================================\n');
    process.exit(0);
  })();
} catch (e) {
  console.error('Failed:', e);
  process.exit(1);
}
