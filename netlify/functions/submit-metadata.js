const { z } = require('zod');
const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { buildDraftPackage } = require('./_lib-endo/ai');
const { triggerAutoRenderFlow } = require('./_lib-endo/auto-render-flow');

const schema = z.object({
  hookText: z.string().optional().default(''),
  ownerComment: z.string().optional().default(''),
  shotDate: z.string().nullable().optional(),
  location: z.string().optional().default(''),
  catName: z.string().optional().default(''),
  simpleTag: z.string().nullable().optional(),
  publishAt: z.string().nullable().optional(),
  visibility: z.enum(['review', 'auto_if_safe']).default('review'),
  ngMemo: z.string().optional().default(''),
  instagramType: z.enum(['reels', 'feed']).optional().default('reels'),
  channels: z.array(z.string()).min(1),
  assets: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    storagePath: z.string(),
    url: z.string().url()
  })).optional(),
  postAttachAssets: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    storagePath: z.string(),
    url: z.string().url()
  })).optional(),
  channelSettings: z.record(z.string(), z.object({
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

    await ref.set(data);

    // 動画生成キックはフロントエンドからの非同期呼び出し(generate-assets-background)に委譲するため、ここではスキップします

    return ok({ id: ref.id, status: draftPackage.status, publishAt: draftPackage.publishAt });
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Internal error' });
  }
};
