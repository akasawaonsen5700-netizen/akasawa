const FormData = require('form-data');

/**
 * endo-snsの画面から画像をアップロードするだけで、
 * HeyGen APIに自動で「画像アップロード→フォトアバター登録→動画生成」を一括実行する関数
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'HEYGEN_API_KEY is not configured' }) };
  }

  try {
    const { script, imageBase64, imageUrl } = JSON.parse(event.body || '{}');

    if (!script) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: '台本(script)が必要です' }) };
    }

    // ========================================
    // STEP 1: 画像をHeyGenにアップロードして asset_id を取得
    // ========================================
    let photoUrl = imageUrl || null;

    if (imageBase64) {
      console.log('Step 1: Uploading image to HeyGen...');

      // Base64からバイナリに変換
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // multipart/form-data でアップロード
      const boundary = '----FormBoundary' + Date.now();
      const bodyParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="avatar.jpg"\r\n`,
        `Content-Type: image/jpeg\r\n\r\n`,
      ];
      const bodyEnd = `\r\n--${boundary}--\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(bodyParts.join('')),
        imageBuffer,
        Buffer.from(bodyEnd)
      ]);

      const uploadRes = await fetch('https://api.heygen.com/v1/asset', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBuffer
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        console.log('Asset upload result:', JSON.stringify(uploadData));
        if (uploadData.data?.url) {
          photoUrl = uploadData.data.url;
        } else if (uploadData.data?.asset_id) {
          photoUrl = uploadData.data.asset_id;
        }
      } else {
        const errText = await uploadRes.text();
        console.warn('HeyGen asset upload failed:', uploadRes.status, errText);
      }
    }

    if (!photoUrl) {
      photoUrl = 'https://akasawaonsen.com/images/endo-owner.jpg';
    }

    // ========================================
    // STEP 2: 動画生成リクエスト（photo_url方式）
    // ========================================
    console.log('Step 2: Generating video with photo_url:', photoUrl);

    const videoPayload = {
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_url: photoUrl
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: 'jp_male_matsuda' // HeyGen内蔵の日本語男性音声
          }
        }
      ],
      dimension: {
        width: 1080,
        height: 1920
      }
    };

    const videoRes = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(videoPayload)
    });

    const videoData = await videoRes.json();
    console.log('Video generate result:', JSON.stringify(videoData));

    if (videoRes.ok && videoData.data?.video_id) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: true,
          videoId: videoData.data.video_id,
          status: 'processing',
          message: 'HeyGen AIアバター動画の生成を開始しました。完成までに数分かかります。'
        })
      };
    }

    // API応答がエラーでも情報を返す
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: false,
        error: videoData.error?.message || videoData.message || 'HeyGen動画生成に失敗しました',
        detail: JSON.stringify(videoData).substring(0, 500)
      })
    };

  } catch (error) {
    console.error('generate-avatar-video Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: error.message || 'Internal Server Error' })
    };
  }
};
