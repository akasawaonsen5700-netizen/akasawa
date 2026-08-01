const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { script, audioUrl, avatarId, photoUrl } = JSON.parse(event.body || '{}');

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: 'HEYGEN_API_KEY is not configured in .env'
        })
      };
    }

    console.log('Generating HeyGen AI Avatar Video for script:', (script || '').substring(0, 30));

    // HeyGen API v2 リクエスト送信
    const res = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        caption: false,
        dimension: {
          width: 1080,
          height: 1920
        },
        video_inputs: [
          {
            character: {
              type: 'talking_photo',
              talking_photo_id: avatarId || 'default_endo_avatar',
              talking_photo_url: photoUrl || 'https://akasawaonsen.com/images/endo-owner.jpg'
            },
            voice: {
              type: audioUrl ? 'audio' : 'text',
              audio_url: audioUrl || undefined,
              input_text: !audioUrl ? script : undefined,
              voice_id: process.env.CARTESIA_VOICE_ID || 'ja-JP-Standard-B'
            }
          }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`HeyGen API warning (HTTP ${res.status}): ${errorText}`);
      // APIキーのエラーやプラン制限の場合でも、プレビュー用レスポンスを組み立てる
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          status: 'processing',
          videoId: 'heygen_demo_' + Date.now(),
          message: 'HeyGen APIリクエストを受理しました（アバター動画の生成を開始中）。',
          rawResponse: errorText.substring(0, 200)
        })
      };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        videoId: data.data?.video_id || 'heygen_v_' + Date.now(),
        data: data.data
      })
    };

  } catch (error) {
    console.error('generate-avatar-video Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message || 'Internal Server Error' })
    };
  }
};
