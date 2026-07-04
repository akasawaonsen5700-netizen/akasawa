const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getBucket } = require('./firebase-admin');

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
    // ローカル開発環境（Netlify Dev）では、ヘッドレスブラウザ（Puppeteer）が起動しない問題を回避するため、
    // 実際のレンダリング処理をスキップしてモック動画URLを即座に返します。
    if (process.env.NETLIFY_DEV === 'true' || !process.env.NETLIFY) {
      logDebug(`[RenderVideo] Local environment detected. Skipping actual Remotion render to prevent browser freeze/timeout.`);
      logDebug(`[RenderVideo] Mocking video render success for submission: ${submissionId}`);
      
      // テスト用のサンプル動画URL
      const mockVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      
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

    exec(command, { cwd }, async (error, stdout, stderr) => {
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
