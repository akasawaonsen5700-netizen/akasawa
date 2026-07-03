const { generateVoiceFromCartesia } = require('./cartesia-tts');
const { renderVideo } = require('./render-video');
const { admin } = require('./firebase-admin');

/**
 * 登録された投稿ドキュメントに対し、音声合成(Cartesia)と動画レンダリング(Remotion)を自動で行い、
 * 完了後にFirestoreドキュメントを更新します。
 * 
 * @param {object} db FirestoreのDBインスタンス
 * @param {object} docRef 更新対象のDocumentReference
 * @param {object} data 保存されたドキュメントデータ
 * @param {string} rawVoiceUrl クライアントからアップロードされた音声URL（あれば）
 */
async function triggerAutoRenderFlow(db, docRef, data, rawVoiceUrl) {
  // 非同期（バックグラウンド）で処理を走らせる
  (async () => {
    try {
      console.log(`Starting auto render flow for submission: ${docRef.id}`);
      
      let finalVoiceUrl = rawVoiceUrl || data.voiceUrl || null;

      // Cartesiaによる自動音声合成 (voiceUrlが未設定かつAPI設定がある場合)
      if (!finalVoiceUrl && process.env.CARTESIA_API_KEY && process.env.CARTESIA_VOICE_ID) {
        const narrationText = data.drafts?.instagram?.narration;
        if (narrationText) {
          try {
            console.log(`[AutoRender] Automatically generating Cartesia voice for submission: ${docRef.id}`);
            const filename = `voice_${docRef.id}_cartesia.wav`;
            finalVoiceUrl = await generateVoiceFromCartesia(narrationText, filename);
            await docRef.update({
              voiceUrl: finalVoiceUrl,
              'channelSettings.instagram.voiceUrl': finalVoiceUrl
            });
          } catch (err) {
            console.error('[AutoRender] Failed to generate Cartesia voice:', err);
            finalVoiceUrl = '/endo-sns/endo.mp3';
            await docRef.update({
              voiceUrl: finalVoiceUrl,
              'channelSettings.instagram.voiceUrl': finalVoiceUrl
            });
          }
        }
      }

      // いずれにも当てはまらない、もしくはCartesia未設定・エラー時の最終フォールバック
      if (!finalVoiceUrl) {
        finalVoiceUrl = '/endo-sns/endo.mp3';
        await docRef.update({
          voiceUrl: finalVoiceUrl,
          'channelSettings.instagram.voiceUrl': finalVoiceUrl
        });
      }

      // Remotion自動動画レンダリング
      if (finalVoiceUrl) {
        const instagramAssets = data.channelSettings?.instagram?.assets || data.assets || [];
        const backgroundUrl = instagramAssets[0]?.url || 'https://assets.mixkit.co/posts/music/preview/mixkit-forest-river-in-morning-1335-large.mp4';
        
        const props = {
          text: data.drafts?.instagram?.narration || data.ownerComment || '無題',
          voiceUrl: finalVoiceUrl,
          bgmUrl: 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav',
          backgroundUrl: backgroundUrl
        };

        console.log(`[AutoRender] Triggering Remotion render for submission: ${docRef.id}`);
        const videoUrl = await renderVideo(docRef.id, props);
        
        await docRef.update({
          videoUrl: videoUrl,
          'channelSettings.instagram.videoUrl': videoUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[AutoRender] Successfully rendered and saved video for submission: ${docRef.id}`);
      }
    } catch (err) {
      console.error(`[AutoRender] Error in auto render flow for submission ${docRef.id}:`, err);
    }
  })();
}

module.exports = { triggerAutoRenderFlow };
