const { BRAND } = require('./brand');
const crypto = require('crypto');

// OAuth 1.0a 署名と認証ヘッダーを生成するヘルパー (X API v2 投稿用)
function getTwitterOAuthHeader(method, url, params, consumerKey, consumerSecret, token, tokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(32).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0'
  };

  const allParams = { ...params, ...oauthParams };
  const sortedKeys = Object.keys(allParams).sort();
  
  const parameterString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(parameterString)
  ].join('&');

  const signingKey = [
    encodeURIComponent(consumerSecret),
    encodeURIComponent(tokenSecret)
  ].join('&');

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

// X (Twitter) API v2 への直接投稿
async function publishToXDirect(text) {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const token = process.env.X_ACCESS_TOKEN;
  const tokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error('X API keys (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) are not configured');
  }

  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const body = { text };

  const authHeader = getTwitterOAuthHeader(method, url, {}, consumerKey, consumerSecret, token, tokenSecret);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Instagram Graph API への直接リール投稿
async function publishToInstagramDirect(videoUrl, caption) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !businessId) {
    throw new Error('Instagram API keys (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID) are not configured');
  }

  // 1. メディアコンテナ（リール用）の作成
  const containerUrl = `https://graph.facebook.com/v19.0/${businessId}/media`;
  const containerResponse = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      share_to_feed: true,
      access_token: accessToken
    })
  });

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text();
    throw new Error(`Instagram media container creation failed: ${errorText}`);
  }

  const containerData = await containerResponse.json();
  const creationId = containerData.id;

  // リールのアップロード完了を簡易ポーリング待機 (最大5回)
  let isReady = false;
  const statusUrl = `https://graph.facebook.com/v19.0/${creationId}`;
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusResponse = await fetch(`${statusUrl}?fields=status_code&access_token=${accessToken}`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      if (statusData.status_code === 'FINISHED') {
        isReady = true;
        break;
      }
    }
  }

  if (!isReady) {
    throw new Error('Instagram video processing timeout (Not ready to publish yet)');
  }

  // 2. メディアの公開
  const publishUrl = `https://graph.facebook.com/v19.0/${businessId}/media_publish`;
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
    throw new Error(`Instagram publishing failed: ${errorText}`);
  }

  return publishResponse.json();
}

// Instagram Graph API への直接画像フィード投稿
async function publishInstagramFeedDirect(imageUrl, caption) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !businessId) {
    throw new Error('Instagram API keys (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID) are not configured');
  }

  // 1. メディアコンテナ（画像用）の作成
  const containerUrl = `https://graph.facebook.com/v19.0/${businessId}/media`;
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
    throw new Error(`Instagram image container creation failed: ${errorText}`);
  }

  const containerData = await containerResponse.json();
  const creationId = containerData.id;

  // 2. メディアの公開
  const publishUrl = `https://graph.facebook.com/v19.0/${businessId}/media_publish`;
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
    throw new Error(`Instagram image publishing failed: ${errorText}`);
  }

  return publishResponse.json();
}

async function publishToChannel(channel, submission) {
  const chSetting = submission.channelSettings?.[channel] || {};
  const videoUrl = submission.videoUrl || chSetting.videoUrl || '';
  const text = submission.drafts?.[channel]?.text || '';
  const instagramType = submission.instagramType || 'reels';

  try {
    if (channel === 'x') {
      const result = await publishToXDirect(text);
      return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
    } else if (channel === 'instagram') {
      if (instagramType === 'feed') {
        const assets = chSetting.assets || submission.assets || [];
        const imageUrl = assets[0]?.url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e';
        const result = await publishInstagramFeedDirect(imageUrl, text);
        return { channel, mode: 'live', publishedAt: new Date().toISOString(), result, instagramType };
      } else {
        // 本番のモック時は動画URLが空になるため、その場合はデモ用の動画URLを使用します
        const targetVideoUrl = videoUrl || 'https://vjs.zencdn.net/v/oceans.mp4';
        const result = await publishToInstagramDirect(targetVideoUrl, text);
        return { channel, mode: 'live', publishedAt: new Date().toISOString(), result, instagramType };
      }
    }
  } catch (err) {
    console.error(`Direct API publishing failed for ${channel}:`, err.message);
    // APIキーが未設定、またはエラー時はデモ動作のためにモックへ安全にフォールバック
    return {
      channel,
      mode: 'mock',
      publishedAt: new Date().toISOString(),
      message: `Direct API failed (${err.message}). Defaulted to mock success.`,
      sentPayload: { text, videoUrl, instagramType }
    };
  }

  throw new Error(`Unsupported channel: ${channel}`);
}

module.exports = { publishToChannel };
