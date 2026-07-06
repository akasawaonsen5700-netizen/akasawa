const { IAMClient, ListRolePoliciesCommand, GetRolePolicyCommand, AttachRolePolicyCommand } = require('@aws-sdk/client-iam');
const fs = require('fs');
const path = require('path');

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
  
  const client = new IAMClient({
    region,
    credentials: {
      accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const roleName = 'remotion-lambda-role';

  try {
    const { PolicyNames } = await client.send(new ListRolePoliciesCommand({ RoleName: roleName }));
    console.log(`Inline Policies on ${roleName}:`, PolicyNames);

    // 強制的に AWS管理ポリシーの AWSLambdaRole と AmazonS3FullAccess をアタッチする
    console.log('Attaching AWS managed policies directly...');
    await client.send(new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaRole'
    }));
    await client.send(new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess'
    }));
    console.log('Successfully attached AWSLambdaRole and AmazonS3FullAccess!');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
