const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getBucket } = require('./firebase-admin');

/**
 * Remotionを使用して動画を自動レンダリングし、Firebase StorageにアップロードしてそのURLを返します。
 * @param {string} submissionId 投稿ID
 * @param {object} props Remotionに渡すプロパティ (text, voiceUrl, bgmUrl, backgroundUrl)
 */
async function renderVideo(submissionId, props) {
  return new Promise((resolve, reject) => {
    // パスの解決
    const appDir = path.resolve(__dirname, '..', '..', '..', 'apps', 'endo-sns');
    const localAppDir = path.resolve(__dirname, '..', '..'); // apps/endo-sns (ローカル実行時)
    const cwd = fs.existsSync(path.join(localAppDir, 'package.json')) ? localAppDir : appDir;

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
    fs.writeFileSync(propsPath, JSON.stringify(props));
    
    // Remotion レンダリングコマンドの構築 (相対パスでJSONファイルを指定)
    const command = `npx remotion render src/remotion/index.tsx EndoInstagramReel public/renders/${outputFilename} --props=public/renders/${propsFilename}`;

    console.log(`Starting Remotion rendering in cwd: ${cwd}`);
    console.log(`Command: ${command}`);

    exec(command, { cwd }, async (error, stdout, stderr) => {
      // 一時JSONファイルをクリーンアップ
      if (fs.existsSync(propsPath)) {
        fs.unlinkSync(propsPath);
      }

      if (error) {
        console.error('Remotion render CLI error:', stderr || error.message);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        return reject(error);
      }
      console.log('Remotion render CLI success:\n', stdout);

      try {
        if (fs.existsSync(outputPath)) {
          console.log(`Uploading rendered video ${outputFilename} to Firebase Storage...`);
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
            console.warn('makePublic failed for video asset, using default storage URL access:', err);
          });

          const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
          console.log(`Video uploaded successfully. URL: ${videoUrl}`);

          // ローカルの一時ファイルを削除
          fs.unlinkSync(outputPath);

          resolve(videoUrl);
        } else {
          reject(new Error(`Rendered video file not found at expected path: ${outputPath}`));
        }
      } catch (uploadErr) {
        console.error('Failed to upload rendered video:', uploadErr);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(uploadErr);
      }
    });
  });
}

module.exports = { renderVideo };
