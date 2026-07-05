const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getBucket } = require('./firebase-admin');

// 物理的な apps/endo-sns ディレクトリを確実に取得するヘルパー
function getEndoSnsDir() {
  // __dirname から apps/endo-sns までの物理パスを安全に切り出す (絶対に無限ループしない)
  const match = __dirname.match(/(.*[\\/]apps[\\/]endo-sns)/i);
  if (match) {
    return match[1];
  }
  
  // フォールバック（プロジェクトルートから探す）
  const rootDir = process.cwd();
  const directPath = path.join(rootDir, 'apps', 'endo-sns');
  if (!rootDir.includes('.netlify') && fs.existsSync(directPath)) {
    return directPath;
  }
  return path.resolve(__dirname, '..', '..', '..', 'apps', 'endo-sns');
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
 * Remotionを使用して動画を自動レンダリングし、Firebase StorageにアップロードしてそのURLを返します。
 * @param {string} submissionId 投稿ID
 * @param {object} props Remotionに渡すプロパティ (text, voiceUrl, bgmUrl, backgroundUrl)
 */
async function renderVideo(submissionId, props) {
  return new Promise((resolve, reject) => {
    // AWS Lambda でレンダリングを呼び出す設定がある場合
    const awsAccessKey = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

    if (process.env.REMOTION_AWS_FUNCTION_NAME && awsAccessKey) {
      logDebug(`[RenderVideo] AWS Lambda Render detected. Triggering remote render on AWS...`);
      const { renderMediaOnLambda, waitForVideoRender } = require('@remotion/lambda/client');
      (async () => {
        try {
          const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';
          const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;
          const serveUrl = process.env.REMOTION_AWS_SERVE_URL;
          const bucketName = process.env.REMOTION_AWS_BUCKET;

          // 暗黙的にSDKが参照する環境変数をセット
          process.env.AWS_ACCESS_KEY_ID = awsAccessKey;
          process.env.AWS_SECRET_ACCESS_KEY = awsSecretKey;

          const renderResult = await renderMediaOnLambda({
            region,
            functionName,
            serveUrl,
            composition: 'EndoInstagramReel',
            inputProps: props,
            codec: 'h264',
            privacy: 'public',
            imageFormat: 'jpeg',
          });

          logDebug(`[RenderVideo] Render started on Lambda. Render ID: ${renderResult.renderId}`);

          // レンダー完了をポーリングで待機 (Netlify関数の制限時間内に終わるようタイムアウト管理)
          const finalResult = await waitForVideoRender({
            region,
            bucketName,
            renderId: renderResult.renderId,
            functionName,
            timeoutInMilliseconds: 45000, // 最大45秒待機
          });

          const videoUrl = finalResult.url;
          logDebug(`[RenderVideo] AWS Lambda render success! URL: ${videoUrl}`);
          resolve(videoUrl);
        } catch (lambdaErr) {
          logDebug(`[RenderVideo-Error] AWS Lambda render failed: ${lambdaErr.message}`);
          reject(lambdaErr);
        }
      })();
      return;
    }

    // 本番（Netlifyクラウド）環境かつAWS設定がない場合はブラウザ起動エラー（タイムアウト・フリーズ）を回避するため、
    // 実際のレンダリング処理をスキップしてモック動画URLを即座に返します。
    const isNetlifyProduction = process.env.NETLIFY_DEV !== 'true';
    if (isNetlifyProduction) {
      logDebug(`[RenderVideo] Skipping actual Remotion render on Netlify production (No AWS Credentials).`);
      logDebug(`[RenderVideo] Mocking video render success for submission: ${submissionId}`);
      
      const mockVideoUrl = ''; // 本番では空URLを返し、フロントのシミュレーションプレイヤーを動作させます
      
      setTimeout(() => {
        resolve(mockVideoUrl);
      }, 1000);
      return;
    }

    const cwd = getEndoSnsDir();

    const outputFilename = `${submissionId}.mp4`;
    const outputPath = path.join(cwd, 'public', 'renders', outputFilename);

    // 出力先ディレクトリの作成
    const rendersDir = path.dirname(outputPath);
    if (!fs.existsSync(rendersDir)) {
      fs.mkdirSync(rendersDir, { recursive: true });
    }

    // propsを一時的にJSONファイルとして保存 (Windowsコマンドのエスケープ問題を完全回避するため)
    const propsFilename = `props_${submissionId}.json`;
    const propsPath = path.join(cwd, 'public', 'renders', propsFilename);
    
    try {
      fs.writeFileSync(propsPath, JSON.stringify(props));
      logDebug(`[RenderVideo] Wrote temp props file: ${propsPath}`);
    } catch (writeErr) {
      logDebug(`[RenderVideo-Error] Failed to write temp props file: ${writeErr.message}`);
      return reject(writeErr);
    }
    
    // Windows環境のバックスラッシュ/スペース問題を避けるため、コマンド内ではcwdからの相対パス（スラッシュ指定）を利用する
    const relativeOutputPath = `public/renders/${outputFilename}`;
    const relativePropsPath = `public/renders/${propsFilename}`;
    const command = `npx remotion render src/remotion/index.tsx EndoInstagramReel "${relativeOutputPath}" --props="${relativePropsPath}"`;

    logDebug(`[RenderVideo] Starting Remotion rendering in cwd: ${cwd}`);
    logDebug(`[RenderVideo] Command: ${command}`);

    // 120秒 (2分) のタイムアウトを設定してフリーズを回避
    exec(command, { cwd, timeout: 120000 }, async (error, stdout, stderr) => {
      // 一時JSONファイルをクリーンアップ
      if (fs.existsSync(propsPath)) {
        fs.unlinkSync(propsPath);
        logDebug(`[RenderVideo] Cleaned up temp props file: ${propsFilename}`);
      }

      if (error) {
        logDebug(`[RenderVideo-Error] Remotion render CLI process failed: ${error.message}`);
        logDebug(`[RenderVideo-Error] CLI stderr: ${stderr}`);
        logDebug(`[RenderVideo-Error] CLI stdout: ${stdout}`);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        return reject(error);
      }
      
      logDebug(`[RenderVideo] Remotion render CLI process success!`);
      logDebug(`[RenderVideo] CLI stdout snippet: ${stdout.substring(0, 300)}...`);

      try {
        if (fs.existsSync(outputPath)) {
          logDebug(`[RenderVideo] Uploading rendered video ${outputFilename} to Firebase Storage...`);
          const bucket = getBucket();
          const storagePath = `submissions/videos/${outputFilename}`;
          const file = bucket.file(storagePath);
          
          await file.save(fs.readFileSync(outputPath), {
            metadata: {
              contentType: 'video/mp4',
              cacheControl: 'public, max-age=31536000'
            }
          });

          // 一般公開URLとしてアクセスできるようにする
          await file.makePublic().catch(err => {
            logDebug(`[RenderVideo-Warn] makePublic failed: ${err.message}`);
          });

          const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
          logDebug(`[RenderVideo] Video uploaded successfully. URL: ${videoUrl}`);

          // ローカルの一時ファイルを削除
          fs.unlinkSync(outputPath);
          logDebug(`[RenderVideo] Cleaned up local video file: ${outputPath}`);

          resolve(videoUrl);
        } else {
          const missingFileErr = new Error(`Rendered video file not found at expected path: ${outputPath}`);
          logDebug(`[RenderVideo-Error] ${missingFileErr.message}`);
          reject(missingFileErr);
        }
      } catch (uploadErr) {
        logDebug(`[RenderVideo-Error] Storage upload failed: ${uploadErr.message}`);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(uploadErr);
      }
    });
  });
}

module.exports = { renderVideo };
