const { getDb } = require('./_lib/firebase-admin');
const { ok, json, methodNotAllowed } = require('./_lib/helpers');

/**
 * Firestoreから投稿一覧を取得するサーバーサイドAPI。
 * ブラウザ側でFirebase SDKの設定を不要にするため、
 * データの読み込みはすべてこのエンドポイント経由で行う。
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'GET') return methodNotAllowed();

  try {
    const db = getDb();
    const snapshot = await db
      .collection('submissions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const rows = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // 遠藤正俊のデータ（個人SNS戦略用）は除外する
      if (data.brandSnapshot && data.brandSnapshot.ownerName === '遠藤正俊') {
        return;
      }
      // Firestore Timestamp を ISO文字列に変換
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt && data.updatedAt.toDate) {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      rows.push({ id: doc.id, ...data });
    });

    return ok({ submissions: rows });
  } catch (error) {
    console.error('list-submissions error:', error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
