const { deployFunction, deploySite, getOrCreateBucket } = require('@remotion/lambda');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';

async function deploy() {
  console.log('--- Remotion Lambda Deployment Tool ---');
  console.log(`Region: ${region}`);

  const awsAccessKey = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!awsAccessKey || !awsSecretKey) {
    console.error('Error: AWS Credentials (REMOTION_AWS_ACCESS_KEY_ID / AWS_ACCESS_KEY_ID) not defined in .env file.');
    process.exit(1);
  }

  console.log(`[Debug] Using AWS_ACCESS_KEY_ID: ${awsAccessKey.substring(0, 8)}...`);

  // 暗黙的にSDKが参照できるように環境変数に再割り当て
  process.env.AWS_ACCESS_KEY_ID = awsAccessKey;
  process.env.AWS_SECRET_ACCESS_KEY = awsSecretKey;

  try {
    // 1. S3バケットの取得または作成
    console.log('1. Accessing or creating Remotion S3 bucket...');
    const { bucketName } = await getOrCreateBucket({ region });
    console.log(`Bucket Name: ${bucketName}`);

    // 2. AWS Lambda 関数のデプロイ
    console.log('2. Deploying Remotion Lambda function (this may take a minute)...');
    const { functionName } = await deployFunction({
      createCloudWatchLogGroup: true,
      memorySizeInMb: 3008, // Chromiumのクラッシュを防ぐためメモリを増強
      region,
      timeoutInSeconds: 240,
      diskSizeInMb: 2048, // 一時領域も最大化
    });
    console.log(`Lambda Function Deployed: ${functionName}`);

    // 3. Remotion ビルド（S3へのアップロード）
    console.log('3. Bundling and uploading Remotion site to S3...');
    const { serveUrl } = await deploySite({
      entryPoint: path.join(__dirname, 'src/remotion/index.tsx'),
      bucketName,
      region,
    });
    console.log(`Serve URL (S3): ${serveUrl}`);

    console.log('\nUpdating .env file automatically...');
    const envPath = path.join(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // 環境変数を置換
    envContent = envContent.replace(/^REMOTION_AWS_FUNCTION_NAME=.*$/m, `REMOTION_AWS_FUNCTION_NAME=${functionName}`);
    envContent = envContent.replace(/^REMOTION_AWS_BUCKET=.*$/m, `REMOTION_AWS_BUCKET=${bucketName}`);
    envContent = envContent.replace(/^REMOTION_AWS_SERVE_URL=.*$/m, `REMOTION_AWS_SERVE_URL=${serveUrl}`);
    
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('\nDeployment and .env update completed successfully!');
    console.log(`REMOTION_AWS_FUNCTION_NAME=${functionName}`);
    console.log(`REMOTION_AWS_BUCKET=${bucketName}`);
    console.log(`REMOTION_AWS_SERVE_URL=${serveUrl}`);

  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
