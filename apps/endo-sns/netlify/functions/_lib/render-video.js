const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getBucket } = require('./firebase-admin');

function getEndoSnsDir() {
  const match = __dirname.match(/(.*[\\/]apps[\\/]endo-sns)/i);
  if (match) return match[1];
  const rootDir = process.cwd();
  const directPath = path.join(rootDir, 'apps', 'endo-sns');
  if (!rootDir.includes('.netlify') && fs.existsSync(directPath)) return directPath;
  return path.resolve(__dirname, '..', '..', '..', 'apps', 'endo-sns');
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
 * 動画レンダリングを開始します。
 * AWS環境変数がある場合は即時にAWSのレンダー情報を返します。
 * ローカル開発環境の場合は同期的に実行し、アップロードした動画URLを返します。
 */
async function startRenderVideo(submissionId, props) {
  const awsAccessKey = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (process.env.REMOTION_AWS_FUNCTION_NAME && awsAccessKey) {
    logDebug(`[RenderVideo] AWS Lambda Render detected. Kicking remote render on AWS...`);
    const { renderMediaOnLambda } = require('@remotion/lambda-client');

    const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';
    const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;
    const serveUrl = process.env.REMOTION_AWS_SERVE_URL;

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

    logDebug(`[RenderVideo] Render successfully kicked on Lambda. ID: ${renderResult.renderId}`);
    return {
      mode: 'aws',
      renderId: renderResult.renderId,
      bucketName: renderResult.bucketName,
      region
    };
  }

  // AWSキーがなく、Netlify本番環境である場合はモックを即時返却
  const isNetlifyProduction = process.env.NETLIFY_DEV !== 'true';
  if (isNetlifyProduction) {
    logDebug(`[RenderVideo] Netlify Production detected (No AWS). Returning mock URL.`);
    return { mode: 'mock', videoUrl: '' };
  }

  // ローカル開発環境（Netlify Dev等）の場合は、従来通り同期的にローカルでビルドしてStorageにアップロードして返す
  logDebug(`[RenderVideo] Local development detected. Running local Remotion CLI...`);
  const cwd = getEndoSnsDir();
  const outputFilename = `${submissionId}.mp4`;
  const outputPath = path.join(cwd, 'public', 'renders', outputFilename);

  const rendersDir = path.dirname(outputPath);
  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
  }

  const propsFilename = `props_${submissionId}.json`;
  const propsPath = path.join(cwd, 'public', 'renders', propsFilename);
  fs.writeFileSync(propsPath, JSON.stringify(props));

  const relativeOutputPath = `public/renders/${outputFilename}`;
  const relativePropsPath = `public/renders/${propsFilename}`;
  const command = `npx remotion render src/remotion/index.tsx EndoInstagramReel "${relativeOutputPath}" --props="${relativePropsPath}"`;

  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout: 120000 }, async (error, stdout, stderr) => {
      if (fs.existsSync(propsPath)) fs.unlinkSync(propsPath);

      if (error) {
        logDebug(`[RenderVideo-Error] CLI process failed: ${error.message}`);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return reject(error);
      }

      try {
        if (fs.existsSync(outputPath)) {
          logDebug(`[RenderVideo] Uploading local render to Firebase Storage...`);
          const bucket = getBucket();
          const storagePath = `submissions/videos/${outputFilename}`;
          const file = bucket.file(storagePath);

          await file.save(fs.readFileSync(outputPath), {
            metadata: {
              contentType: 'video/mp4',
              cacheControl: 'public, max-age=31536000'
            }
          });
          await file.makePublic().catch(() => {});

          const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
          fs.unlinkSync(outputPath);
          logDebug(`[RenderVideo] Local render successfully completed. URL: ${videoUrl}`);
          resolve({ mode: 'local', videoUrl });
        } else {
          reject(new Error(`Rendered video not found at ${outputPath}`));
        }
      } catch (err) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(err);
      }
    });
  });
}

module.exports = { startRenderVideo };
