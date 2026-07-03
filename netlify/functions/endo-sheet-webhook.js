const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { buildDraftPackage } = require('./_lib-endo/ai');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    if (process.env.SHEET_SHARED_SECRET && event.headers['x-sheet-secret'] !== process.env.SHEET_SHARED_SECRET) {
      return badRequest('Invalid secret');
    }

    const payload = parseBody(event);
    if (!payload.mediaUrl) return badRequest('mediaUrl is required');

    const normalized = {
      ownerComment: payload.ownerComment || '',
      shotDate: payload.shotDate || null,
      location: payload.location || '',
      catName: payload.catName || '',
      simpleTag: payload.simpleTag || null,
      publishAt: payload.publishAt || null,
      visibility: payload.visibility || 'review',
      ngMemo: payload.ngMemo || '',
      channels: (payload.channels || 'instagram,x').split(',').map(v => v.trim()).filter(Boolean),
      assets: [{
        name: payload.mediaName || 'sheet-media',
        type: payload.mediaType || 'image/jpeg',
        size: Number(payload.mediaSize || 0),
        storagePath: payload.storagePath || '',
        url: payload.mediaUrl
      }],
      brandSnapshot: payload.brandSnapshot || {}
    };

    const draftPackage = await buildDraftPackage(normalized);
    const db = getDb();
    const ref = db.collection('submissions').doc();
    await ref.set({
      ...normalized,
      ...draftPackage,
      source: 'google-sheet',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return ok({ id: ref.id, status: draftPackage.status });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
