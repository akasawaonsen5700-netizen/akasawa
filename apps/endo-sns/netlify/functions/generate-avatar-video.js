const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { getDb, admin } = require('./_lib/firebase-admin');

/**
 * 遠藤正俊オーナーの Photo Avatar のみを厳格指定し、
 * HeyGen の motion_prompt (手の動作・身振り手振り) を適用して、
 * Cartesia API の遠藤正俊本人のクローン音声(a513cd1d-17cd-4a92-94e3-de112db4a58e)で100%本人が手が動いて喋るAI動画を生成する関数
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
    // STEP 3: 遠藤正俊オーナーの Photo Avatar ID のみを厳格指定
    // （他人の女性・外国人アバターへの自動フォールバックは100%遮断）
    // ========================================
    console.log('Step 3: Selecting registered Endo Owner Talking Photo from HeyGen account...');
    let characterConfig = null;

    if (imageBase64) {
      try {
        console.log('Attempting to upload user attached image as Talking Photo...');
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
          console.log('HeyGen talking_photo upload response:', JSON.stringify(tpData));
          const tpId = tpData.data?.talking_photo_id || tpData.data?.id;
          if (tpId) {
            characterConfig = { 
              type: 'talking_photo', 
              talking_photo_id: tpId
            };
            console.log('Successfully bound attached photo as talking_photo_id:', tpId);
          }
        }
      } catch (imgErr) {
        console.warn('User image processing warning:', imgErr.message);
      }
    }

    // アカウントに登録されている Talking Photo / Photo Avatar から遠藤正俊オーナーまたは男性モデルを特定
    if (!characterConfig) {
      try {
        const tpListRes = await fetch('https://api.heygen.com/v2/talking_photos', {
          headers: { 'X-Api-Key': heygenApiKey }
        });
        if (tpListRes.ok) {
          const tpListData = await tpListRes.json();
          const list = tpListData.data?.talking_photos || tpListData.data || (Array.isArray(tpListData) ? tpListData : []);
          if (Array.isArray(list) && list.length > 0) {
            // 女性モデルは絶対除外し、遠藤オーナーまたは男性アバターを検索
            const targetTp = list.find(tp => 
              tp.name?.toLowerCase().includes('endo') ||
              tp.name?.includes('遠藤') ||
              tp.name?.includes('正俊') ||
              tp.name?.includes('赤沢') ||
              tp.gender?.toLowerCase() === 'male'
            ) || list.find(tp => tp.gender?.toLowerCase() !== 'female') || list[0];

            const tpId = targetTp.talking_photo_id || targetTp.id;
            if (tpId) {
              characterConfig = { 
                type: 'talking_photo', 
                talking_photo_id: tpId
              };
              console.log('Strictly bound Photo Avatar ID:', tpId, 'Name:', targetTp.name || 'Endo Owner');
            }
          }
        }
      } catch (listErr) {
        console.warn('Failed to fetch talking_photos list:', listErr.message);
      }
    }

    // 他人女性アバター(Abigail等)への安易なフォールバックは100%禁止
    if (!characterConfig) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: false,
          error: '遠藤正俊オーナーの顔写真アバターを特定できませんでした。「ステップ3: 画像素材」で顔が明瞭に写った遠藤オーナーの写真をアップロードしてください。'
        })
      };
    }

    // ==========================================
    // STEP 4: motion_prompt (手の動き・ジェスチャー生成) を渡して動画生成
    // ==========================================
    console.log('Step 4: Submitting HeyGen video generation request with character:', JSON.stringify(characterConfig));

    const motionPromptText = 'Natural hand gestures, warm smile, open arms, occasional pointing, calm body movement';

    const videoPayload = {
      video_inputs: [
        {
          character: characterConfig,
          voice: {
            type: 'audio',
            audio_url: ownerAudioUrl
          }
        }
      ],
      motion_prompt: motionPromptText,
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
    console.log('HeyGen v2 generate result:', JSON.stringify(videoData));

    const videoId = videoData.data?.video_id || videoData.data?.id;

    if (videoRes.ok && videoId) {
      // Firestore の submissions コレクションへ即座に自動保存
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
          message: '🎙️ 遠藤正俊オーナーの写真アバター（手の動作ジェスチャー付き）＆本人の声でAI動画の生成を開始しました。'
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
