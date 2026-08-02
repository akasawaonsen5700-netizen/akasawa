const FormData = require('form-data');

/**
 * 遠藤正俊オーナー本人のクローン音声（Cartesia API）を自動生成し、
 * HeyGen API と連携して【100% 遠藤オーナー本人の声】で喋るAIアバター動画を一括生成する関数
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const heygenApiKey = process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'HEYGEN_API_KEY is not configured' }) };
  }

  const cartesiaApiKey = process.env.CARTESIA_API_KEY;
  const cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || 'a513cd1d-17cd-4a92-94e3-de112db4a58e';

  if (!cartesiaApiKey || !cartesiaVoiceId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: false,
        error: '⚠️ 遠藤正俊オーナーのクローンボイス設定（CARTESIA_API_KEY / CARTESIA_VOICE_ID）が配置されていません。'
      })
    };
  }

  try {
    const { script, imageBase64, imageUrl } = JSON.parse(event.body || '{}');

    if (!script) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: '台本(script)が必要です' }) };
    }

    // ========================================
    // STEP 1: Cartesia API で遠藤正俊オーナー本人の声を直接生成
    // ========================================
    console.log(`Step 1: Generating Endou Masatoshi Owner voice via Cartesia (Voice ID: ${cartesiaVoiceId})...`);
    
    const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': cartesiaApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: script,
        voice: {
          mode: 'id',
          id: cartesiaVoiceId
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 44100
        },
        language: 'ja'
      })
    });

    if (!cartesiaRes.ok) {
      const errText = await cartesiaRes.text();
      throw new Error(`Cartesia オーナー音声生成失敗 (${cartesiaRes.status}): ${errText}`);
    }

    const audioArrayBuffer = await cartesiaRes.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);
    console.log(`Generated owner voice audio buffer size: ${audioBuffer.length} bytes`);

    // ========================================
    // STEP 2: 生成した本人の音声WAVを HeyGen にアセットアップロード
    // ========================================
    console.log('Step 2: Uploading owner voice audio to HeyGen asset...');
    
    // 方法A: バイナリ直接アップロード (HeyGen要求: audio/x-wav)
    let audioUploadRes = await fetch('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenApiKey,
        'Content-Type': 'audio/x-wav'
      },
      body: audioBuffer
    });

    let ownerAudioAssetId = null;
    let ownerAudioUrl = null;

    if (audioUploadRes.ok) {
      const audioUploadData = await audioUploadRes.json();
      console.log('HeyGen audio upload response:', JSON.stringify(audioUploadData));
      ownerAudioAssetId = audioUploadData.data?.id || audioUploadData.data?.asset_id;
      ownerAudioUrl = audioUploadData.data?.url;
    } else {
      const errTxt = await audioUploadRes.text();
      console.warn('HeyGen binary audio asset upload warning:', errTxt);

      // 方法B: Form-Data multipart アップロード (form-data ライブラリ使用)
      const form = new FormData();
      form.append('file', audioBuffer, { filename: 'owner_voice.wav', contentType: 'audio/wav' });

      audioUploadRes = await fetch('https://upload.heygen.com/v1/asset', {
        method: 'POST',
        headers: {
          'X-Api-Key': heygenApiKey,
          ...form.getHeaders()
        },
        body: form.getBuffer()
      });

      if (audioUploadRes.ok) {
        const audioUploadData = await audioUploadRes.json();
        console.log('HeyGen form audio upload response:', JSON.stringify(audioUploadData));
        ownerAudioAssetId = audioUploadData.data?.asset_id || audioUploadData.data?.id;
        ownerAudioUrl = audioUploadData.data?.url;
      } else {
        const errTxt2 = await audioUploadRes.text();
        console.warn('HeyGen form audio asset upload warning:', errTxt2);
      }
    }

    if (!ownerAudioAssetId && !ownerAudioUrl) {
      throw new Error('遠藤オーナーの音声ファイルをHeyGenへ連携できませんでした。');
    }

    // ========================================
    // STEP 3: アバター/Talking Photo 画像準備
    // ========================================
    let talkingPhotoId = null;
    let avatarId = null;

    if (imageBase64) {
      try {
        console.log('Step 3: Uploading avatar image to HeyGen...');
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const imgForm = new FormData();
        imgForm.append('file', imageBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

        const imgUploadRes = await fetch('https://upload.heygen.com/v1/asset', {
          method: 'POST',
          headers: {
            'X-Api-Key': heygenApiKey,
            ...imgForm.getHeaders()
          },
          body: imgForm.getBuffer()
        });

        if (imgUploadRes.ok) {
          const imgUploadData = await imgUploadRes.json();
          const uploadedUrl = imgUploadData.data?.url || imgUploadData.data?.image_url;

          if (uploadedUrl) {
            const tpRes = await fetch('https://api.heygen.com/v2/talking_photo', {
              method: 'POST',
              headers: {
                'X-Api-Key': heygenApiKey,
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
        console.warn('Image upload flow warning:', uploadErr.message);
      }
    }

    if (!talkingPhotoId && !avatarId) {
      try {
        const tpListRes = await fetch('https://api.heygen.com/v2/talking_photos', {
          headers: { 'X-Api-Key': heygenApiKey }
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
          headers: { 'X-Api-Key': heygenApiKey }
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

    // ==========================================
    // STEP 4: 本人の音声(audio)を指定して動画生成
    // ==========================================
    console.log('Step 4: Submitting HeyGen video generation with Endou Owner audio...');

    let characterConfig = {};
    if (talkingPhotoId) {
      characterConfig = { type: 'talking_photo', talking_photo_id: talkingPhotoId };
    } else {
      characterConfig = { type: 'avatar', avatar_id: avatarId };
    }

    const voiceConfig = ownerAudioAssetId 
      ? { type: 'audio', audio_asset_id: ownerAudioAssetId }
      : { type: 'audio', audio_url: ownerAudioUrl };

    const videoPayload = {
      video_inputs: [
        {
          character: characterConfig,
          voice: voiceConfig
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
        'X-Api-Key': heygenApiKey,
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
          message: '🎙️ 遠藤正俊オーナー本人のクローン音声でAIアバター動画の生成を開始しました。'
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
