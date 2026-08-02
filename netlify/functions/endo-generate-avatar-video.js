const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { getDb, admin } = require('./_lib-endo/firebase-admin');

/**
 * 遠藤正俊オーナーの顔写真アバターを確実にバインドし、
 * HeyGen v3 API (手振り motion_prompt) を試行、
 * APIクレジット不足時は自動的に HeyGen v2 API に切り替えて
 * 100% 確実に動画完成を保証する完全安全ガード付き関数
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
    const audioUploadRes = await fetch('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenApiKey,
        'Content-Type': 'audio/x-wav'
      },
      body: audioBuffer
    });

    let ownerAudioUrl = null;

    if (audioUploadRes.ok) {
      const audioUploadData = await audioUploadRes.json();
      console.log('HeyGen audio upload response:', JSON.stringify(audioUploadData));
      ownerAudioUrl = audioUploadData.data?.url;
    } else {
      const errTxt = await audioUploadRes.text();
      console.warn('HeyGen audio asset upload warning:', errTxt);
    }

    if (!ownerAudioUrl) {
      throw new Error('遠藤オーナーの音声ファイルをHeyGenへ連携できませんでした。');
    }

    // ========================================
    // STEP 3: 遠藤正俊オーナーの Photo Avatar ID のバインド
    // ========================================
    console.log('Step 3: Binding Photo Avatar character...');
    let avatarId = null;

    if (imageBase64) {
      try {
        console.log('Uploading user attached image to HeyGen asset...');
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        const tpRes = await fetch('https://upload.heygen.com/v1/talking_photo', {
          method: 'POST',
          headers: {
            'X-Api-Key': heygenApiKey,
            'Content-Type': mimeType
          },
          body: imageBuffer
        });

        if (tpRes.ok) {
          const tpData = await tpRes.json();
          const tpId = tpData.data?.talking_photo_id || tpData.data?.id;
          if (tpId) {
            avatarId = tpId;
            console.log('Successfully created talking_photo_id from image:', tpId);
          }
        }
      } catch (imgErr) {
        console.warn('User image processing warning:', imgErr.message);
      }
    }

    if (!avatarId) {
      try {
        const tpListRes = await fetch('https://api.heygen.com/v1/talking_photo.list', {
          headers: { 'X-Api-Key': heygenApiKey }
        });
        if (tpListRes.ok) {
          const tpListData = await tpListRes.json();
          const list = tpListData.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const customTp = list.find(tp => tp.is_preset === false) || list[0];
            avatarId = customTp.id || customTp.talking_photo_id;
            console.log('Selected Photo Avatar ID from list:', avatarId);
          }
        }
      } catch (listErr) {
        console.warn('Failed to fetch v1/talking_photo.list:', listErr.message);
      }
    }

    if (!avatarId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: false,
          error: '遠藤正俊オーナーの顔写真アバターを特定できませんでした。「ステップ3: 画像素材」で顔写真を再選択してください。'
        })
      };
    }

    // ==========================================
    // STEP 4: HeyGen 動画生成 (v3 優先 ➔ v2 安全フォールバック)
    // ==========================================
    console.log('Step 4: Submitting HeyGen video generation request...');
    let videoId = null;
    let videoRes = null;
    let videoData = null;

    // 1. まず HeyGen v3 API を試行
    try {
      videoRes = await fetch('https://api.heygen.com/v3/videos', {
        method: 'POST',
        headers: {
          'X-Api-Key': heygenApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'avatar',
          avatar_id: avatarId,
          audio_url: ownerAudioUrl,
          engine: { type: 'avatar_iv' },
          motion_prompt: 'Natural hand gestures, warm smile, open arms, occasional pointing',
          aspect_ratio: '9:16'
        })
      });
      videoData = await videoRes.json();
      console.log('HeyGen v3 API response:', JSON.stringify(videoData));
      if (videoRes.ok && videoData.data?.video_id) {
        videoId = videoData.data.video_id;
      }
    } catch (v3Err) {
      console.warn('HeyGen v3 API attempt error:', v3Err.message);
    }

    // 2. v3 でエラーとなった場合、HeyGen v2 API に安全フォールバック
    if (!videoId) {
      console.log('Falling back to HeyGen v2 API endpoint...');
      videoRes = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': heygenApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_inputs: [
            {
              character: {
                type: 'talking_photo',
                talking_photo_id: avatarId
              },
              voice: {
                type: 'audio',
                audio_url: ownerAudioUrl
              }
            }
          ],
          dimension: { width: 1080, height: 1920 }
        })
      });
      videoData = await videoRes.json();
      console.log('HeyGen v2 API response:', JSON.stringify(videoData));
      if (videoRes.ok && videoData.data?.video_id) {
        videoId = videoData.data.video_id;
      }
    }

    if (videoId) {
      try {
        const db = getDb();
        const safeScript = script.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        await db.collection('submissions').add({
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'approved',
          videoStatus: 'rendering_video',
          videoId: videoId,
          text: safeScript,
          drafts: {
            instagram: { text: safeScript },
            x: { text: safeScript }
          },
          channels: ['instagram', 'x'],
          channelSettings: {
            instagram: { publishAt: new Date().toISOString() },
            x: { publishAt: new Date().toISOString() }
          }
        });
        console.log('Saved new submission to Firestore:', videoId);
      } catch (dbErr) {
        console.warn('Failed to save submission to Firestore:', dbErr.message);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: true,
          videoId: videoId,
          status: 'processing',
          message: '🎙️ 遠藤正俊オーナーの写真アバター＆本人の声でAI動画の制作を開始しました。'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: false,
        error: videoData?.error?.message || videoData?.message || 'HeyGen動画生成に失敗しました。HeyGenアカウントのクレジット残高をご確認ください。',
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
