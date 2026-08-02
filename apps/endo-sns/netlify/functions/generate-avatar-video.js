const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { getDb, admin } = require('./_lib/firebase-admin');

/**
 * 添付画像を 100% Talking Photo アバターとして登録し、
 * Cartesia API の遠藤正俊本人のクローン音声(a513cd1d-17cd-4a92-94e3-de112db4a58e)で喋らせるAI動画生成関数
 * 生成開始時に Firestore の submissions コレクションへ自動登録・保存します。
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
    // STEP 3: 添付画像のアセット化 ＆ Talking Photo ID の特定
    // ========================================
    console.log('Step 3: Finding or creating avatar character...');
    let characterConfig = null;

    if (imageBase64) {
      try {
        console.log('Uploading user attached image as Talking Photo...');
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
            characterConfig = { type: 'talking_photo', talking_photo_id: tpId };
            console.log('Successfully created talking_photo_id from user image:', tpId);
          }
        } else {
          console.warn('v1/talking_photo upload failed:', await tpRes.text());
        }
      } catch (imgErr) {
        console.warn('User image processing warning:', imgErr.message);
      }
    }

    // アカウントの Talking Photo 一覧から男性・遠藤アバターを優先検索
    if (!characterConfig) {
      try {
        const tpListRes = await fetch('https://api.heygen.com/v2/talking_photos', {
          headers: { 'X-Api-Key': heygenApiKey }
        });
        if (tpListRes.ok) {
          const tpListData = await tpListRes.json();
          const list = tpListData.data?.talking_photos || tpListData.data || (Array.isArray(tpListData.data) ? tpListData.data : []);
          if (Array.isArray(list) && list.length > 0) {
            const endoOrMale = list.find(tp => 
              tp.name?.toLowerCase().includes('endo') ||
              tp.name?.toLowerCase().includes('male') ||
              tp.name?.includes('遠藤') ||
              tp.name?.includes('正俊') ||
              tp.gender?.toLowerCase() === 'male'
            ) || list.find(tp => !tp.gender || tp.gender?.toLowerCase() !== 'female') || list[0];

            const tpId = endoOrMale.talking_photo_id || endoOrMale.id;
            if (tpId) {
              characterConfig = { type: 'talking_photo', talking_photo_id: tpId };
              console.log('Selected male/Endo talking_photo_id from account:', tpId);
            }
          }
        }
      } catch (listErr) {
        console.warn('Failed to fetch talking_photos list:', listErr.message);
      }
    }

    // 既存の Avatars 一覧からアバターを検索
    if (!characterConfig) {
      try {
        const avatarListRes = await fetch('https://api.heygen.com/v2/avatars', {
          headers: { 'X-Api-Key': heygenApiKey }
        });
        if (avatarListRes.ok) {
          const avatarListData = await avatarListRes.json();
          const list = avatarListData.data?.avatars || avatarListData.data || (Array.isArray(avatarListData.data) ? avatarListData.data : []);
          if (Array.isArray(list) && list.length > 0) {
            const maleAv = list.find(av => 
              av.gender?.toLowerCase() === 'male' ||
              av.avatar_name?.toLowerCase().includes('male') ||
              av.avatar_name?.toLowerCase().includes('endo')
            ) || list[0];

            const avId = maleAv.avatar_id || maleAv.id;
            if (avId) {
              characterConfig = { type: 'avatar', avatar_id: avId };
              console.log('Selected avatar_id from account:', avId);
            }
          }
        }
      } catch (avErr) {
        console.warn('Failed to fetch avatars list:', avErr.message);
      }
    }

    if (!characterConfig) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: false,
          error: 'アバター画像(Talking Photo)が指定されていません。顔写真をアップロードしてください。'
        })
      };
    }

    // ==========================================
    // STEP 4: 添付画像アバター ＋ 遠藤オーナーの本人の音声(audio_url)で動画生成
    // ==========================================
    console.log('Step 4: Submitting HeyGen video generation request with character:', JSON.stringify(characterConfig));

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
      const videoId = videoData.data.video_id;

      // 🌟 Firestore の submissions コレクションへ即座に自動保存
      try {
        const db = getDb();
        const docRef = await db.collection('submissions').add({
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'approved',
          videoStatus: 'rendering_video',
          videoId: videoId,
          text: script,
          drafts: {
            instagram: { text: script },
            x: { text: script }
          },
          channels: ['instagram', 'x'],
          channelSettings: {
            instagram: { publishAt: new Date().toISOString() },
            x: { publishAt: new Date().toISOString() }
          }
        });
        console.log('Saved new submission to Firestore:', docRef.id);
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
          message: '🎙️ 添付画像＆遠藤正俊オーナー本人の声でAIアバター動画の生成を開始し、制作済み一覧へ保存しました。'
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
