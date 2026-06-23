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
  const payload = {
    hotelName: BRAND.hotelName,
    submissionId: submission.id,
    text: submission.drafts?.[channel]?.text || '',
    assets: chSetting.assets || submission.assets || [],
    altText: submission.altText,
    hashtags: submission.hashtags || [],
    officialSite: BRAND.site,
    phone: BRAND.phone
  };

  const envMap = {
    instagram: process.env.INSTAGRAM_WEBHOOK_URL,
    gbp: process.env.GBP_WEBHOOK_URL,
    x: process.env.X_WEBHOOK_URL,
    youtube: process.env.YOUTUBE_WEBHOOK_URL
  };

  if (!envMap[channel]) {
    return { channel, mode: 'mock', publishedAt: new Date().toISOString(), message: `${channel} webhook is not configured` };
  }

  const result = await postWebhook(envMap[channel], payload);
  return { channel, mode: 'live', publishedAt: new Date().toISOString(), result };
}

module.exports = { publishToChannel };
