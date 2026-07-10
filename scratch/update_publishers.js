const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\user\\Desktop\\akasawa\\apps\\akasawa-sns\\netlify\\functions\\_lib\\publishers.js';
let content = fs.readFileSync(filePath, 'utf8');

const newFunction = `// Instagram Graph API への画像フィード投稿
async function publishToInstagramFeed(imageUrl, caption) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !businessId) {
    throw new Error('Instagram API keys (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID) are not configured');
  }

  // 1. メディアコンテナ（画像用）の作成
  const containerUrl = \`https://graph.facebook.com/v19.0/\${businessId}/media\`;
  const containerResponse = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken
    })
  });

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text();
    throw new Error(\`Instagram feed container creation failed: \${errorText}\`);
  }

  const containerData = await containerResponse.json();
  const creationId = containerData.id;

  // 画像は即時準備完了になることが多いが、一応1秒待つ
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. メディアの公開
  const publishUrl = \`https://graph.facebook.com/v19.0/\${businessId}/media_publish\`;
  const publishResponse = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken
    })
  });

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(\`Instagram feed publishing failed: \${errorText}\`);
  }

  return publishResponse.json();
}

async function publishToChannel`;

content = content.replace('async function publishToChannel', newFunction);

const oldChannelLogic = `async function publishToChannel(channel, submission) {
  const chSetting = submission.channelSettings?.[channel] || {};
  const videoUrl = submission.videoUrl || chSetting.videoUrl || '';
  const text = submission.drafts?.[channel]?.text || '';

  try {
    if (channel === 'x') {
      const result = await publishToXDirect(text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    } else if (channel === 'instagram') {
      // 本番のモック時は動画URLが空になるため、その場合はデモ用の動画URLを使用します
      const targetVideoUrl = videoUrl || 'https://vjs.zencdn.net/v/oceans.mp4';
      const result = await publishToInstagramDirect(targetVideoUrl, text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    }
  } catch (err) {
    console.error(\`Direct API publishing failed for \${channel}:\`, err.message);
    // APIキーが未設定、またはエラー時はデモ動作のためにモックへ安全にフォールバック
    return {
      channel,
      mode: 'mock',
      publishedAt: new Date().toISOString(),
      message: \`Direct API failed (\${err.message}). Defaulted to mock success.\`,
      sentPayload: { text, videoUrl }
    };
  }

  throw new Error(\`Unsupported channel: \${channel}\`);
}`;

const newChannelLogic = `async function publishToChannel(channel, submission) {
  const chSetting = submission.channelSettings?.[channel] || {};
  const text = submission.drafts?.[channel]?.text || '';

  try {
    if (channel === 'x') {
      const result = await publishToXDirect(text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    } else if (channel === 'instagram_reel') {
      const videoUrl = submission.videoUrl || chSetting.videoUrl || '';
      const targetVideoUrl = videoUrl || 'https://vjs.zencdn.net/v/oceans.mp4';
      const result = await publishToInstagramDirect(targetVideoUrl, text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    } else if (channel === 'instagram_feed') {
      const assets = chSetting.assets || submission.assets || [];
      let imageUrl = 'https://dummyimage.com/600x600/000/fff&text=Demo';
      if (assets.length > 0) {
        imageUrl = assets[0].url;
      }
      const result = await publishToInstagramFeed(imageUrl, text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    }
  } catch (err) {
    console.error(\`Direct API publishing failed for \${channel}:\`, err.message);
    // APIキーが未設定、またはエラー時はデモ動作のためにモックへ安全にフォールバック
    return {
      channel,
      mode: 'mock',
      publishedAt: new Date().toISOString(),
      message: \`Direct API failed (\${err.message}). Defaulted to mock success.\`,
      sentPayload: { text }
    };
  }

  throw new Error(\`Unsupported channel: \${channel}\`);
}`;

content = content.replace(oldChannelLogic, newChannelLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated publishers.js');
