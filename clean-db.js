const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

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
    const snapshot = await db.collection('submissions').get();
    let deletedCount = 0;
    
    console.log('====== 古い海の動画データのクリーンアップ ======');
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const videoUrl = data.videoUrl || '';
      
      // 海洋動画（oceans.mp4）または以前のForBiggerBlazes.mp4が設定されているデータを一括削除
      if (videoUrl.includes('oceans.mp4') || videoUrl.includes('ForBiggerBlazes.mp4')) {
        console.log(`[削除ID]: ${doc.id} (${(data.ownerComment || '').substring(0, 15)}...)`);
        await doc.ref.delete();
        deletedCount++;
      }
    }
    console.log(`クリーンアップ完了: ${deletedCount} 件の古いデータをデータベースから完全に削除しました。`);
    console.log('================================================');
    process.exit(0);
  })();
} catch (e) {
  console.error('Failed:', e);
  process.exit(1);
}
