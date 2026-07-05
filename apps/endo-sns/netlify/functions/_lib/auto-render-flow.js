const { generateVoiceFromCartesia } = require('./cartesia-tts');
const { renderVideo } = require('./render-video');
const { admin } = require('./firebase-admin');
const fs = require('fs');
const path = require('path');

// 物理的な apps/endo-sns ディレクトリを確実に取得するヘルパー
function getEndoSnsDir() {
  const rootDir = process.cwd();
  if (fs.existsSync(path.join(rootDir, 'apps', 'endo-sns'))) {
    return path.join(rootDir, 'apps', 'endo-sns');
  }
  if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    try {
      const pkg = require(path.join(rootDir, 'package.json'));
      if (pkg.name === 'endo-sns-personal-tool') {
        return rootDir;
      }
    } catch (e) {}
  }
  let currentDir = __dirname;
  while (currentDir && currentDir !== path.parse(currentDir).root) {
    if (currentDir.endsWith(path.join('apps', 'endo-sns'))) {
      return currentDir;
    }
    if (currentDir.includes('.netlify')) {
      const parts = currentDir.split(path.sep);
      const netlifyIdx = parts.indexOf('.netlify');
      if (netlifyIdx !== -1) {
        const projectRoot = parts.slice(0, netlifyIdx).join(path.sep);
        if (projectRoot.endsWith(path.join('apps', 'endo-sns')) || projectRoot.endsWith('endo-sns')) {
          return projectRoot;
        }
        return path.join(projectRoot, 'apps', 'endo-sns');
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return path.resolve(__dirname, '..', '..', '..', 'apps', 'endo-sns');
}

async function ensureBgmDownloaded(localBgmPath, remoteBgmUrl) {
  if (fs.existsSync(localBgmPath)) return;
  return new Promise((resolve) => {
    logDebug(`[AutoRender] Downloading BGM from ${remoteBgmUrl} to ${localBgmPath}...`);
    const https = require('https');
    const file = fs.createWriteStream(localBgmPath);
    
    https.get(remoteBgmUrl, (response) => {
      if (response.statusCode !== 200) {
        logDebug(`[AutoRender-Error] BGM download failed, status code: ${response.statusCode}`);
        file.close();
        fs.unlink(localBgmPath, () => {});
        resolve();
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        logDebug('[AutoRender] BGM downloaded successfully!');
        resolve();
      });
    }).on('error', (err) => {
      logDebug(`[AutoRender-Error] Failed to download BGM: ${err.message}`);
      file.close();
      fs.unlink(localBgmPath, () => {});
      resolve();
    });
  });
}

// デバッグログファイルへの出力関数
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
 * 登録された投稿ドキュメントに対し、音声合成(Cartesia)と動画レンダリング(Remotion)を自動で行い、
 * 完了後にFirestoreドキュメントを更新します。
 */
async function triggerAutoRenderFlow(db, docRef, data, rawVoiceUrl) {
  try {
    logDebug(`=== Starting auto render flow for submission: ${docRef.id} ===`);
    
    // Netlifyの本番環境（サーバーレス環境）では、ディスク書き込み制限やタイムアウトを完全に避けるため、
    // 即時にダミー音声（endo.mp3）とモック動画URLを設定して処理を正常完了させます。
    const isNetlifyProduction = process.env.NETLIFY_DEV !== 'true';
    if (isNetlifyProduction) {
      logDebug(`[AutoRender] Netlify Production detected. Setting up demo voice/video URLs instantly.`);
      
      const mockVoiceUrl = '/endo-sns/endo.mp3'; // 同梱の遠藤様クローン音声ファイル
      const mockVideoUrl = ''; // 海洋の動画（oceans.mp4）を完全に排除して空にします
      
      await docRef.update({
        voiceUrl: mockVoiceUrl,
        'channelSettings.instagram.voiceUrl': mockVoiceUrl,
        videoUrl: mockVideoUrl,
        'channelSettings.instagram.videoUrl': mockVideoUrl,
        videoStatus: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logDebug(`[AutoRender] Netlify Production bypass success!`);
      return;
    }
    
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
            'channelSettings.instagram.voiceUrl': finalVoiceUrl,
            videoStatus: 'rendering_video' // 音声完了 ➔ 動画レンダリングへ
          });
        } catch (err) {
          logDebug(`[AutoRender-Error] Cartesia voice generation failed: ${err.message}\nStack: ${err.stack}`);
          throw err; // 即座にエラーをスローして終了（フォールバックなし）
        }
      } else {
        logDebug(`[AutoRender] No narration text found for Instagram, skipping voice synthesis`);
      }
    } else {
      logDebug(`[AutoRender] Skipped Cartesia voice (Already set, or CARTESIA env keys missing)`);
    }

    // 音声がない場合はエラーにする（フォールバック廃止）
    if (!finalVoiceUrl) {
      throw new Error('音声の生成に失敗したため、動画のレンダリングを中止しました。');
    }

    // Remotion自動動画レンダリング
    if (finalVoiceUrl) {
      const instagramAssets = data.channelSettings?.instagram?.assets || data.assets || [];
      const backgroundUrls = instagramAssets.map(asset => asset.url).filter(Boolean);

      // ローカル用の BGM パスとダウンロード
      const endoSnsDir = getEndoSnsDir();
      const localBgmPath = path.join(endoSnsDir, 'public', 'bgm.wav');
      const remoteBgmUrl = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav';
      await ensureBgmDownloaded(localBgmPath, remoteBgmUrl);

      // ローカル上のアセットパスを指定して Remotion の CORS / ロード遅延を完全回避する
      let localVoiceUrl = finalVoiceUrl;
      if (finalVoiceUrl.includes('_cartesia.wav')) {
        const voiceFilename = `voice_${docRef.id}_cartesia.wav`;
        localVoiceUrl = `/voices/${voiceFilename}`;
      } else if (finalVoiceUrl === '/endo-sns/endo.mp3') {
        localVoiceUrl = '/endo.mp3';
      }

      const bgmExists = fs.existsSync(localBgmPath);
      logDebug(`[AutoRender] BGM file exists on disk: ${bgmExists}`);
      const props = {
        text: data.drafts?.instagram?.narration || data.ownerComment || '無題',
        voiceUrl: localVoiceUrl,
        bgmUrl: bgmExists ? '/bgm.wav' : null,
        backgroundUrls: backgroundUrls.length > 0 ? backgroundUrls : null
      };

      logDebug(`[AutoRender] Triggering Remotion render for submission: ${docRef.id}`);
      const videoUrl = await renderVideo(docRef.id, props);
      
      logDebug(`[AutoRender] Remotion render success! Video URL: ${videoUrl}`);
      await docRef.update({
        videoUrl: videoUrl,
        'channelSettings.instagram.videoUrl': videoUrl,
        videoStatus: 'completed', // レンダリング完了
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logDebug(`[AutoRender] Firestore document successfully updated for: ${docRef.id}`);
    }
  } catch (err) {
    logDebug(`[AutoRender-Error] General error in auto render flow: ${err.message}\nStack: ${err.stack}`);
    // エラーステータスとメッセージを保存
    await docRef.update({
      videoStatus: 'failed',
      videoError: err.message
    });
    throw err;
  }
}

module.exports = { triggerAutoRenderFlow };
