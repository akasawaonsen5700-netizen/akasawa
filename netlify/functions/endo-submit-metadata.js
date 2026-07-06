const { z } = require('zod');
const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { buildDraftPackage } = require('./_lib-endo/ai');

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

    // NetlifyのBackground Functionsを叩いて、非同期で長時間の生成処理を開始（最大15分保証）
    const host = event.headers.host || 'localhost:8891';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const functionName = host.includes('localhost') ? 'generate-assets-background' : 'endo-generate-assets-background';
    const bgUrl = `${protocol}://${host}/.netlify/functions/${functionName}`;

    fetch(bgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ref.id, voiceUrl: payload.voiceUrl })
    }).catch(err => {
      console.error('[Background Kick Error]:', err);
    });

    return ok({ id: ref.id, status: draftPackage.status, publishAt: draftPackage.publishAt });
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Internal error' });
  }
};
