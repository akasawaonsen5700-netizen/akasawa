const fs = require('fs');
const path = require('path');
const { renderMediaOnLambda, getRenderProgress } = require('@remotion/lambda-client');

// 簡単な .env パーサー
try {
  const envPath = path.join(__dirname, '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim();
      process.env[key] = val;
    }
  });
} catch (e) {
  console.warn('.env file not found or unreadable:', e.message);
}

// AWS SDK 用に環境変数をマッピング
if (process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
}
if (process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}

async function main() {
  const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';
  const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_AWS_SERVE_URL;
  const forceBucketName = process.env.REMOTION_AWS_BUCKET;

  if (!functionName || !serveUrl || !forceBucketName) {
    console.error("Missing AWS environment variables in .env");
    console.error({ functionName, serveUrl, forceBucketName });
    return;
  }

  const props = {
    text: 'テスト用のナレーションです。',
    voiceUrl: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', // 確実にアクセスできる音声URL
    bgmUrl: '',
    backgroundUrl: '',
    backgroundUrls: null
  };

  console.log("Kicking render on AWS Lambda...");
  
  try {
    const renderResult = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      forceBucketName,
      composition: 'EndoInstagramReel',
      inputProps: props,
      codec: 'h264',
      privacy: 'public',
      imageFormat: 'jpeg',
      concurrency: 5, // AWS Lambdaの同時実行制限（Rate Exceeded）を回避
      logLevel: 'verbose', // 詳細ログを出力
      dumpBrowserLogs: true // ブラウザ内部のエラーを取得
    });

    console.log(`Render started with ID: ${renderResult.renderId}`);
    
    let done = false;
    while (!done) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const progress = await getRenderProgress({
        region,
        bucketName: renderResult.bucketName,
        renderId: renderResult.renderId,
        functionName
      });
      
      console.log(`Progress: Math.round(progress.overallProgress * 100)%`);
      if (progress.fatalErrorEncountered) {
        console.error("FATAL ERROR ENCOUNTERED!");
        console.error(JSON.stringify(progress.errors, null, 2));
        break;
      }
      done = progress.done;
      if (done) {
        console.log("Render completed! URL:", progress.outputFile);
      }
    }
  } catch (err) {
    console.error("Render failed to start or crashed:", err);
  }
}

main();
