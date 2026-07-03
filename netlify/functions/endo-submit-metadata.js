const { z } = require('zod');
const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { buildDraftPackage } = require('./_lib-endo/ai');
const { generateVoiceFromCartesia } = require('./_lib-endo/cartesia-tts');

const schema = z.object({
  ownerComment: z.string().optional().default(''),
  shotDate: z.string().nullable().optional(),
  location: z.string().optional().default(''),
  catName: z.string().optional().default(''),
  simpleTag: z.string().nullable().optional(),
  publishAt: z.string().nullable().optional(),
  visibility: z.enum(['review', 'auto_if_safe']).default('review'),
  ngMemo: z.string().optional().default(''),
  channels: z.array(z.string()).min(1),
  assets: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    storagePath: z.string(),
    url: z.string().url()
  })).optional(),
  channelSettings: z.record(z.object({
    assets: z.array(z.object({
      name: z.string(),
      type: z.string(),
      size: z.number(),
      storagePath: z.string(),
      url: z.string().url()
    })).optional(),
    publishAt: z.string().nullable().optional()
  })).optional(),
  brandSnapshot: z.object({
    ownerName: z.string().optional(),
    hotelName: z.string().optional(),
    officialSite: z.string().optional(),
    phone: z.string().optional(),
    brandCopy: z.string().optional()
  }).optional(),
  voiceUrl: z.string().url().nullable().optional()
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const payload = schema.parse(parseBody(event));
    const draftPackage = await buildDraftPackage(payload);
    const db = getDb();
    const ref = db.collection('submissions').doc();
    const data = {
      ...payload,
      ...draftPackage,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 音声ファイルが指定されている場合はそれを使用
    let finalVoiceUrl = payload.voiceUrl;

    // 音声ファイルが指定されておらず、Cartesiaの設定が存在し、かつInstagramのナレーション台本が生成された場合、
    // 自動的にCartesiaでクローン音声を生成して紐づける
    if (!finalVoiceUrl && process.env.CARTESIA_API_KEY && process.env.CARTESIA_VOICE_ID) {
      const narrationText = draftPackage.drafts?.instagram?.narration;
      if (narrationText) {
        try {
          console.log('Cartesia API key and Voice ID found. Automatically generating narration voice from script...');
          const filename = `voice_${ref.id}_cartesia.wav`;
          finalVoiceUrl = await generateVoiceFromCartesia(narrationText, filename);
        } catch (err) {
          console.error('Failed to automatically generate voice from Cartesia, falling back to endo.mp3:', err);
          finalVoiceUrl = '/endo-sns/endo.mp3';
        }
      }
    }

    // いずれにも当てはまらない、もしくはCartesia未設定・エラー時の最終フォールバック
    if (!finalVoiceUrl) {
      finalVoiceUrl = '/endo-sns/endo.mp3';
    }

    data.voiceUrl = finalVoiceUrl;
    if (data.channelSettings && data.channelSettings.instagram) {
      data.channelSettings.instagram.voiceUrl = finalVoiceUrl;
    }

    await ref.set(data);
    return ok({ id: ref.id, status: draftPackage.status, publishAt: draftPackage.publishAt });
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Internal error' });
  }
};
