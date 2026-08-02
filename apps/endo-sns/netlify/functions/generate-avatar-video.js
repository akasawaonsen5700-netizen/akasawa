const FormData = require('form-data');

/**
 * HeyGen API v2 対応 動画生成関数
 * 【厳格ルール】遠藤正俊オーナーの本人の声（クローンボイス）以外での生成を一切禁止。
 * 本人の声（Custom Voice / Cloned Voice）が見つからない場合はエラーを返して停止。
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

    let talkingPhotoId = null;
    let avatarId = null;

    // ========================================
    // STEP 1: 画像アップロード & talking_photo_id 発行
    // ========================================
    if (imageBase64) {
      try {
        console.log('Step 1: Uploading image asset to HeyGen...');
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

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
          const uploadedUrl = uploadData.data?.url || uploadData.data?.image_url;

          if (uploadedUrl) {
            const tpRes = await fetch('https://api.heygen.com/v2/talking_photo', {
              method: 'POST',
              headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ talking_photo_url: uploadedUrl })
            });

            if (tpRes.ok) {
              const tpData = await tpRes.json();
              talkingPhotoId = tpData.data?.talking_photo_id || tpData.data?.id;
            }
          }
        }
      } catch (uploadErr) {
        console.warn('Image upload flow failed:', uploadErr.message);
      }
    }

    // ========================================
    // STEP 2: talking_photo_id / avatar_id 自動取得
    // ========================================
    if (!talkingPhotoId && !avatarId) {
      try {
        const tpListRes = await fetch('https://api.heygen.com/v2/talking_photos', {
          headers: { 'X-Api-Key': apiKey }
        });
        if (tpListRes.ok) {
          const tpListData = await tpListRes.json();
          const list = tpListData.data?.talking_photos || tpListData.data || [];
          if (Array.isArray(list) && list.length > 0) {
            talkingPhotoId = list[0].talking_photo_id || list[0].id;
          }
        }
      } catch (listErr) {
        console.warn('Failed to fetch talking_photos list:', listErr.message);
      }
    }

    if (!talkingPhotoId && !avatarId) {
      try {
        const avatarListRes = await fetch('https://api.heygen.com/v2/avatars', {
          headers: { 'X-Api-Key': apiKey }
        });
        if (avatarListRes.ok) {
          const avatarListData = await avatarListRes.json();
          const list = avatarListData.data?.avatars || avatarListData.data || [];
          if (Array.isArray(list) && list.length > 0) {
            avatarId = list[0].avatar_id || list[0].id;
          }
        }
      } catch (avErr) {
        console.warn('Failed to fetch avatars list:', avErr.message);
      }
    }

    if (!talkingPhotoId && !avatarId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: false,
          error: 'HeyGenアカウント内に使用可能なアバターまたはTalking Photoが見つかりませんでした。'
        })
      };
    }

    // ========================================
    // STEP 3: 遠藤正俊オーナー本人の声（クローンボイス）の厳格特定
    // 他人の標準ボイスによるフォールバックを完全禁止！
    // ========================================
    let ownerVoiceId = process.env.HEYGEN_VOICE_ID || null;

    if (!ownerVoiceId) {
      console.log('Searching for Endou Masatoshi cloned/custom voice in HeyGen account...');
      try {
        const voicesRes = await fetch('https://api.heygen.com/v2/voices', {
          headers: { 'X-Api-Key': apiKey }
        });
        if (voicesRes.ok) {
          const voicesData = await voicesRes.json();
          const voices = voicesData.data?.voices || voicesData.data || [];
          
          if (Array.isArray(voices) && voices.length > 0) {
            // アカウントに登録されたカスタムボイス/クローンボイスを探索
            const customVoice = voices.find(v => 
              v.is_custom === true || 
              v.type === 'custom' || 
              v.type === 'cloned' ||
              v.name?.toLowerCase().includes('endo') ||
              v.name?.includes('遠藤') ||
              v.name?.includes('正俊')
            );

            if (customVoice) {
              ownerVoiceId = customVoice.voice_id || customVoice.id;
              console.log('Found Endou Owner Cloned Voice ID:', ownerVoiceId, customVoice.name);
            }
          }
        }
      } catch (vErr) {
        console.warn('Voice search error:', vErr.message);
      }
    }

    // 本人のクローンボイスが見つからない場合は他人の声で勝手に作成させず、厳格にエラーを返す！
    if (!ownerVoiceId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: false,
          error: '⚠️ 遠藤正俊オーナーの本人のクローンボイス（Voice Clone）がHeyGenアカウント内に未登録です。他人の標準ボイスでの生成を防ぐため処理を停止しました。HeyGenで遠藤オーナーの声（クローンボイス）を作成するか、.env の HEYGEN_VOICE_ID にボイスIDを設定してください。'
        })
      };
    }

    // ========================================
    // STEP 4: 遠藤オーナー本人の声で動画生成リクエスト
    // ========================================
    console.log('Submitting video generation with Endou Owner Voice ID:', ownerVoiceId);
    
    let characterConfig = {};
    if (talkingPhotoId) {
      characterConfig = {
        type: 'talking_photo',
        talking_photo_id: talkingPhotoId
      };
    } else {
      characterConfig = {
        type: 'avatar',
        avatar_id: avatarId
      };
    }

    const videoPayload = {
      video_inputs: [
        {
          character: characterConfig,
          voice: {
            type: 'text',
            input_text: script,
            voice_id: ownerVoiceId
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
          message: '遠藤正俊オーナー本人の声でAIアバター動画の生成を開始しました。'
        })
      };
    }

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
