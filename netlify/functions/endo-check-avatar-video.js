require('dotenv').config();
const { getDb, admin } = require('./_lib-endo/firebase-admin');

/**
 * HeyGenで生成した動画のステータスを確認し、完了時にダウンロードURLを返す
 * 完了時は Firestore の submissions コレクションの該当ドキュメントも更新保存します
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'HEYGEN_API_KEY is not configured' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const videoId = params.video_id || params.videoId;

    if (!videoId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'video_id is required' }) };
    }

    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey }
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, status: 'error', error: data.message || 'Status check failed' })
      };
    }

    const status = data.data?.status || 'unknown';
    const videoUrl = data.data?.video_url || null;

    // 完成時に Firestore ドキュメントを自動更新
    if (status === 'completed' && videoUrl) {
      try {
        const db = getDb();
        const snap = await db.collection('submissions').where('videoId', '==', videoId).limit(1).get();
        if (!snap.empty) {
          const docRef = snap.docs[0].ref;
          await docRef.update({
            videoUrl: videoUrl,
            videoStatus: 'completed',
            'channelSettings.instagram.videoUrl': videoUrl,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('Updated Firestore submission with completed videoUrl:', videoId);
        }
      } catch (dbErr) {
        console.warn('Firestore update warning on check-avatar-video:', dbErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: true,
        status: status,
        videoUrl: videoUrl,
        thumbnailUrl: data.data?.thumbnail_url || null,
        duration: data.data?.duration || null
      })
    };

  } catch (error) {
    console.error('check-avatar-video Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
