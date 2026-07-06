const fs = require('fs');
const path = require('path');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

try {
  const envPath = path.join(__dirname, '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx !== -1) {
      process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  });
} catch (e) {}

async function main() {
  const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';
  const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;

  const client = new LambdaClient({
    region,
    credentials: {
      accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY,
    }
  });

  // Remotion Lambda が送るダミーペイロードを直接送信して、生のエラーログを取得
  const payload = {
    type: "render",
    renderId: "test-render-id",
    bucketName: process.env.REMOTION_AWS_BUCKET,
    serveUrl: process.env.REMOTION_AWS_SERVE_URL,
    composition: "EndoInstagramReel",
    inputProps: {},
    codec: "h264",
    imageFormat: "jpeg",
    privacy: "public"
  };

  console.log(`Directly invoking ${functionName} with LogType: Tail...`);

  try {
    const res = await client.send(new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payload)),
      InvocationType: "RequestResponse",
      LogType: "Tail" // これでクラッシュ時の生ログ（末尾4KB）が取得できます
    }));

    if (res.FunctionError) {
      console.log(`FunctionError: ${res.FunctionError}`);
      if (res.LogResult) {
        const decodedLog = Buffer.from(res.LogResult, 'base64').toString('utf-8');
        console.log(`\n--- TAIL LOGS ---`);
        console.log(decodedLog);
        console.log(`-----------------\n`);
      }
    } else {
      console.log("Success! No FunctionError.");
      const decodedPayload = new TextDecoder("utf-8").decode(res.Payload);
      console.log("Payload:", decodedPayload);
    }
  } catch (err) {
    console.error('Invoke failed:', err.message);
  }
}

main();
