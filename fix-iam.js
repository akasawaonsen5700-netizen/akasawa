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
        Action: "lambda:InvokeFunction",
        Resource: "*"
      }
    ]
  };

  console.log(`Adding lambda:InvokeFunction permission to role: ${roleName}...`);

  try {
    await client.send(new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'AllowLambdaInvokeSelf',
      PolicyDocument: JSON.stringify(policyDocument)
    }));
    console.log('Successfully added permission!');
  } catch (err) {
    console.error('Failed to add permission:', err.message);
  }
}

main();
