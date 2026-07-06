const { generateVoiceFromCartesia } = require('./cartesia-tts');
const { startRenderVideo } = require('./render-video');
const { admin } = require('./firebase-admin');
const fs = require('fs');
const path = require('path');

function getEndoSnsDir() {
  const match = __dirname.match(/(.*[\\/]apps[\\/]endo-sns)/i);
  if (match) return match[1];
  const rootDir = process.cwd();
  const directPath = path.join(rootDir, 'apps', 'endo-sns');
  if (!rootDir.includes('.netlify') && fs.existsSync(directPath)) return directPath;
  return path.resolve(__dirname, '..', '..', '..', 'apps', 'endo-sns');
}

async function ensureBgmDownloaded(localBgmPath, remoteBgmUrl) {
  if (fs.existsSync(localBgmPath)) return;
  return new Promise((resolve) => {
    logDebug(`[AutoRender] Downloading BGM from ${remoteBgmUrl}...`);
    const https = require('https');
    const file = fs.createWriteStream(localBgmPath);
    
    const request = https.get(remoteBgmUrl, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(localBgmPath, () => {});
        resolve();
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.setTimeout(10000, () => {
      request.destroy();
      file.close();
      fs.unlink(localBgmPath, () => {});
      resolve();
    });

    request.on('error', () => {
      file.close();
      fs.unlink(localBgmPath, () => {});
      resolve();
    });
  });
}

function logDebug(message) {
  try {
    const endoSnsDir = getEndoSnsDir();
    const logFile = path.join(endoSnsDir, 'render-debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (e) {
    console.error('Failed to write debug log:', e);
  }
  console.log(message);
}

/**
 * 音声合成と動画生成のキックを管理します。
 * Netlifyの10秒タイムアウト制限内に安全に収まるよう、動画生成の完了待ちは行わず
 * キックした時点でレスポンスを返します。
 */
async function triggerAutoRenderFlow(db, docRef, data, rawVoiceUrl) {
  try {
    logDebug(`=== Starting auto render flow for submission: ${docRef.id} ===`);
    
    // 1. 初期ステータス（音声生成中）を設定
    await docRef.update({ videoStatus: 'generating_audio' });
    
    let finalVoiceUrl = rawVoiceUrl || data.voiceUrl || null;

    // Cartesiaによる自動音声合成 (voiceUrlが未設定かつAPI設定がある場合)
    if (!finalVoiceUrl && process.env.CARTESIA_API_KEY && process.env.CARTESIA_VOICE_ID) {
      const narrationText = data.drafts?.instagram?.narration;
      if (narrationText) {
        try {
          logDebug(`[AutoRender] Generating Cartesia voice for: ${docRef.id}`);
          const filename = `voice_${docRef.id}_cartesia.wav`;
          finalVoiceUrl = await generateVoiceFromCartesia(narrationText, filename);
          logDebug(`[AutoRender] Generated Cartesia voice URL: ${finalVoiceUrl}`);
          
          await docRef.update({
            voiceUrl: finalVoiceUrl,
            'channelSettings.instagram.voiceUrl': finalVoiceUrl
          });
        } catch (err) {
          logDebug(`[AutoRender-Error] Cartesia voice generation failed: ${err.message}`);
          throw err;
        }
      }
    }

    if (!finalVoiceUrl) {
      throw new Error('音声の生成に失敗したため、動画のレンダリングを中止しました。');
    }

    // 2. Remotion自動動画レンダリングのキック準備
    const instagramAssets = data.channelSettings?.instagram?.assets || data.assets || [];
    const backgroundUrls = instagramAssets.map(asset => asset.url).filter(Boolean);

    const endoSnsDir = getEndoSnsDir();
    const remoteBgmUrl = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav';

    // AWS Lambdaからは絶対URLでないとアクセスできないため、finalVoiceUrlをそのまま使用する
    let absoluteVoiceUrl = finalVoiceUrl;
    if (finalVoiceUrl === '/endo-sns/endo.mp3' || finalVoiceUrl === '/endo.mp3') {
      // プロジェクト内アセットの場合は、本番のフルURLに変換
      absoluteVoiceUrl = 'https://akasawa.netlify.app/endo-sns/endo.mp3';
    }

    const props = {
      text: data.drafts?.instagram?.narration || data.ownerComment || '無題',
      voiceUrl: absoluteVoiceUrl,
      bgmUrl: null,
      backgroundUrls: backgroundUrls.length > 0 ? backgroundUrls : null
    };

    logDebug(`[AutoRender] Kicking startRenderVideo for: ${docRef.id}`);
    const renderInfo = await startRenderVideo(docRef.id, props);

    if (renderInfo.mode === 'aws') {
      // AWSキック成功時は、進捗チェック用の情報を登録して 'rendering_video' とする
      logDebug(`[AutoRender] AWS Lambda render successfully kicked. Status -> rendering_video.`);
      await docRef.update({
        videoStatus: 'rendering_video',
        awsRenderId: renderInfo.renderId,
        awsBucketName: renderInfo.bucketName,
        awsRegion: renderInfo.region,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (renderInfo.mode === 'local') {
      // ローカル開発環境時は同期的に完了するため、即時completedにする
      logDebug(`[AutoRender] Local render completed. Status -> completed.`);
      await docRef.update({
        videoUrl: renderInfo.videoUrl,
        'channelSettings.instagram.videoUrl': renderInfo.videoUrl,
        videoStatus: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // モックモード
      logDebug(`[AutoRender] Mock render complete. Status -> completed.`);
      await docRef.update({
        videoUrl: '',
        'channelSettings.instagram.videoUrl': '',
        videoStatus: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (err) {
    logDebug(`[AutoRender-Error] Flow failed: ${err.message}`);
    await docRef.update({
      videoStatus: 'failed',
      videoError: err.message
    });
    throw err;
  }
}

module.exports = { triggerAutoRenderFlow };
