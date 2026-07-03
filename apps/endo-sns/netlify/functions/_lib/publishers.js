const { BRAND } = require('./brand');

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Webhook publish failed');
  }
  return response.json().catch(() => ({ ok: true }));
}

async function publishToChannel(channel, submission) {
  const chSetting = submission.channelSettings?.[channel] || {};
  const videoUrl = submission.videoUrl || chSetting.videoUrl || '';

  const payload = {
    ownerName: BRAND.ownerName,
    hotelName: BRAND.hotelName,
    submissionId: submission.id,
    text: submission.drafts?.[channel]?.text || '',
    assets: chSetting.assets || submission.assets || [],
    videoUrl: videoUrl, // 合成された動画URLを追加
    altText: submission.altText,
    hashtags: submission.hashtags || [],
    officialSite: BRAND.site
  };

  const envMap = {
    instagram: process.env.INSTAGRAM_WEBHOOK_URL,
    x: process.env.X_WEBHOOK_URL
  };

  if (!envMap[channel]) {
    return { 
      channel, 
      mode: 'mock', 
      publishedAt: new Date().toISOString(), 
      message: `${channel} webhook is not configured`,
      sentPayload: payload
    };
  }

  const result = await postWebhook(envMap[channel], payload);
  return { 
    channel, 
    mode: 'live', 
    publishedAt: new Date().toISOString(), 
    result,
    sentPayload: payload
  };
}

module.exports = { publishToChannel };
