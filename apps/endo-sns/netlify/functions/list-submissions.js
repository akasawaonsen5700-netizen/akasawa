const fs = require('fs');
const path = require('path');

// 一時的なアセットコピートリック
try {
  const src2 = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\f82dd262-a1a9-4100-9085-79de01bf94cf\\bg_premium2_1783143891502.png';
  const dest2 = 'c:\\Users\\user\\Desktop\\akasawa\\apps\\endo-sns\\public\\bg-premium2.png';
  const src3 = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\f82dd262-a1a9-4100-9085-79de01bf94cf\\bg_premium3_1783143902834.png';
  const dest3 = 'c:\\Users\\user\\Desktop\\akasawa\\apps\\endo-sns\\public\\bg-premium3.png';
  
  if (fs.existsSync(src2)) {
    fs.copyFileSync(src2, dest2);
    console.log('Successfully copied bg-premium2.png to endo-sns/public');
  }
  if (fs.existsSync(src3)) {
    fs.copyFileSync(src3, dest3);
    console.log('Successfully copied bg-premium3.png to endo-sns/public');
  }
} catch (e) {
  console.error('Copy trick failed:', e);
}

// 一時的なCartesiaボイスID一覧取得処理
(async () => {
  try {
    const response = await fetch('https://api.cartesia.ai/voices', {
      headers: {
        'X-API-Key': process.env.CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10'
      }
    });
    if (response.ok) {
      const voices = await response.json();
      console.log('====== CARTESIA VOICES LIST ======');
      voices.forEach(v => {
        console.log(`Name: ${v.name}, ID: ${v.id}`);
      });
      console.log('==================================');
    } else {
      console.error('Failed to fetch Cartesia voices:', response.statusText);
    }
  } catch (e) {
    console.error('Error fetching Cartesia voices:', e);
  }
})();

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
      // Firestore Timestamp を ISO文字列に変換
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt && data.updatedAt.toDate) {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      rows.push({ id: doc.id, ...data });
    });

    // Cartesiaのボイス一覧を取得して返す
    let cartesiaVoices = [];
    try {
      const vResponse = await fetch('https://api.cartesia.ai/voices', {
        headers: {
          'X-API-Key': process.env.CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10'
        }
      });
      if (vResponse.ok) {
        const rawVoices = await vResponse.json();
        // 名前とIDだけを簡易的に抽出
        cartesiaVoices = rawVoices.map(v => ({ name: v.name, id: v.id }));
      }
    } catch (e) {
      console.error('Failed to fetch Cartesia voices in handler:', e);
    }

    return ok({ submissions: rows, cartesiaVoices });
  } catch (error) {
    console.error('list-submissions error:', error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
