const fs = require('fs');
const path = require('path');
const { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

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

const region = process.env.REMOTION_AWS_REGION || 'ap-northeast-1';
const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;
const logGroupName = `/aws/lambda/${functionName}`;

const client = new CloudWatchLogsClient({
  region,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY,
  }
});

async function main() {
  console.log(`Fetching CloudWatch logs for: ${logGroupName}...`);
  try {
    const { logStreams } = await client.send(new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1
    }));

    if (!logStreams || logStreams.length === 0) {
      console.log('No log streams found.');
      return;
    }

    const streamName = logStreams[0].logStreamName;
    console.log(`Latest log stream: ${streamName}`);

    const { events } = await client.send(new GetLogEventsCommand({
      logGroupName,
      logStreamName: streamName,
      limit: 50
    }));

    if (!events || events.length === 0) {
      console.log('No events in this stream.');
      return;
    }

    console.log('\n--- LOG EVENTS ---');
    events.forEach(e => {
      console.log(e.message.trim());
    });
    console.log('------------------\n');
  } catch (err) {
    console.error('Failed to fetch logs:', err.message);
  }
}

main();
