const { IAMClient, PutRolePolicyCommand } = require('@aws-sdk/client-iam');
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
  const bucketName = process.env.REMOTION_AWS_BUCKET;
  
  const client = new IAMClient({
    region,
    credentials: {
      accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const roleName = 'remotion-lambda-role';

  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"],
        Resource: [
          `arn:aws:s3:::${bucketName}`,
          `arn:aws:s3:::${bucketName}/*`
        ]
      }
    ]
  };

  console.log(`Adding S3 permissions to role: ${roleName}...`);

  try {
    await client.send(new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'AllowRemotionS3Access',
      PolicyDocument: JSON.stringify(policyDocument)
    }));
    console.log('Successfully added S3 permissions!');
  } catch (err) {
    console.error('Failed to add S3 permissions:', err.message);
  }
}

main();
