require('dotenv').config();

/**
 * HeyGenで生成した動画のステータスを確認し、完了時にダウンロードURLを返す
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
